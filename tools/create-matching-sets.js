/**
 * Bulk Matching Set Creator for Shopify
 * Run: SHOP=x.myshopify.com TOKEN=shpat_xxx node create-matching-sets.js
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';

const SHOP    = process.env.SHOP;
const TOKEN   = process.env.TOKEN;
const API_VER = '2024-01';
const TYPE    = 'matching_set';
const CSV     = './matching-sets.csv';
const DELAY   = 700; // ms between requests (stay under Shopify rate limits)

if (!SHOP || !TOKEN) {
  console.error('❌  Missing env vars. Run as:');
  console.error('   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node create-matching-sets.js');
  process.exit(1);
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VER}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ─── PRODUCT LOOKUP (cached) ──────────────────────────────────────────────────

const cache = {};

async function getProduct(handle) {
  if (cache[handle]) return cache[handle];
  const data = await gql(
    `query($h: String!) { productByHandle(handle: $h) { id title } }`,
    { h: handle }
  );
  if (!data.productByHandle) {
    throw new Error(`Product not found: "${handle}" — check the handle in your CSV`);
  }
  cache[handle] = { gid: data.productByHandle.id, title: data.productByHandle.title };
  return cache[handle];
}

// ─── DUPLICATE CHECK ─────────────────────────────────────────────────────────

async function metaobjectExists(handle) {
  const data = await gql(
    `query($h: MetaobjectHandleInput!) { metaobjectByHandle(handle: $h) { id } }`,
    { h: { type: TYPE, handle } }
  );
  return !!data.metaobjectByHandle;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

async function createMetaobject(handle, fields) {
  const data = await gql(
    `mutation($m: MetaobjectCreateInput!) {
       metaobjectCreate(metaobject: $m) {
         metaobject { id handle }
         userErrors  { field message }
       }
     }`,
    { m: { type: TYPE, handle, fields } }
  );
  const { metaobject, userErrors } = data.metaobjectCreate;
  if (userErrors.length) throw new Error(JSON.stringify(userErrors, null, 2));
  return metaobject;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function splitPipe(str) {
  return (str || '').split('|').map((s) => s.trim()).filter(Boolean);
}

// Makes a short product name for the set title
// e.g. "Advantage Set Zipper T-Shirt Grape Purple" → "Zipper T-Shirt"
// Removes collection prefix and color suffix (color is usually last 1-2 words)
function shortName(productTitle, collection, color) {
  let name = productTitle;
  // Remove collection prefix (case insensitive)
  const collectionPattern = new RegExp(`^${collection}\\s*[-–]?\\s*`, 'i');
  name = name.replace(collectionPattern, '');
  // Remove color suffix (case insensitive)
  const colorPattern = new RegExp(`\\s*[-–]?\\s*${color}\\s*$`, 'i');
  name = name.replace(colorPattern, '');
  return name.trim() || productTitle;
}

// ─── PROCESS ONE CSV ROW ──────────────────────────────────────────────────────
// Colors cycle across all top×bottom combos so each set gets a unique theme color.
// If combos > colors, colors repeat from the beginning.

async function processRow(row) {
  const collection    = row.collection.trim();
  const topHandles    = splitPipe(row.top_handles);
  const bottomHandles = splitPipe(row.bottom_handles);

  // Support both old format (top_colors/bottom_colors) and new format (all_colors)
  let colorPool;
  if (row.all_colors) {
    colorPool = splitPipe(row.all_colors);
  } else {
    // Fallback: merge top_colors + bottom_colors and dedupe
    colorPool = [...new Set([
      ...splitPipe(row.top_colors),
      ...splitPipe(row.bottom_colors),
    ])];
  }
  if (!colorPool.length) colorPool = ['Default'];

  if (!collection || !topHandles.length || !bottomHandles.length) {
    console.warn('  ⚠️  Empty row — skipping');
    return;
  }

  const total = topHandles.length * bottomHandles.length;
  console.log(`\n📦 ${collection}  →  ${topHandles.length} tops × ${bottomHandles.length} bottoms = ${total} sets  (${colorPool.length} colors cycling)`);

  // Fetch all products for this row
  console.log('   Looking up products...');
  const tops    = [];
  const bottoms = [];

  for (const h of topHandles) {
    const p = await getProduct(h);
    tops.push(p);
    console.log(`   ✓ top   "${p.title}"  (${h})`);
    await sleep(DELAY);
  }
  for (const h of bottomHandles) {
    const p = await getProduct(h);
    bottoms.push(p);
    console.log(`   ✓ bot   "${p.title}"  (${h})`);
    await sleep(DELAY);
  }

  // All GIDs in this row (used to populate "also pair it with")
  const allRowGids = [...tops.map(p => p.gid), ...bottoms.map(p => p.gid)];

  // Generate one metaobject per top × bottom combo, cycling colors
  let created = 0, skipped = 0, failed = 0;
  let comboIndex = 0;

  for (let t = 0; t < tops.length; t++) {
    for (let b = 0; b < bottoms.length; b++, comboIndex++) {
      const top    = tops[t];
      const bottom = bottoms[b];
      const color  = colorPool[comboIndex % colorPool.length];

      // Build clean display title: e.g. "Advantage Set | Zipper T-Shirt + Leggings"
      const topShort    = shortName(top.title, collection, color);
      const bottomShort = shortName(bottom.title, collection, color);
      const title       = `${collection} | ${topShort} + ${bottomShort}`;
      const handle      = slugify(title);

      // Skip if already exists (safe to re-run the script)
      const exists = await metaobjectExists(handle);
      await sleep(DELAY);

      if (exists) {
        console.log(`   ⏭️  Already exists — skipping: ${title}`);
        skipped++;
        continue;
      }

      // top + bottom first, then every other product (shown in "also pair it with")
      const otherGids  = allRowGids.filter(g => g !== top.gid && g !== bottom.gid);
      const productGids = [top.gid, bottom.gid, ...otherGids];

      const fields = [
        { key: 'title',                value: title },
        { key: 'hotspot_top_x',        value: String(row.htx) },
        { key: 'hotspot_top_y',        value: String(row.hty) },
        { key: 'hotspot_bottom_x',     value: String(row.hbx) },
        { key: 'hotspot_bottom_y',     value: String(row.hby) },
        { key: 'default_top_color',    value: color },
        { key: 'default_bottom_color', value: color },
        // NOTE: image is intentionally blank — add lifestyle photos manually in Shopify admin
        { key: 'products', value: JSON.stringify(productGids) },
      ];

      try {
        await createMetaobject(handle, fields);
        console.log(`   ✅ Created: ${title}  [color: ${color}]`);
        created++;
      } catch (err) {
        console.error(`   ❌ Failed:  ${title}\n      ${err.message}`);
        failed++;
      }

      await sleep(DELAY);
    }
  }

  console.log(`   → Done: ${created} created, ${skipped} skipped (already existed), ${failed} failed`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(file)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (r) => rows.push(r))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

(async () => {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Elvn Matching Sets — Bulk Creator`);
  console.log(`  Shop : ${SHOP}`);
  console.log(`${'─'.repeat(50)}`);

  const rows = await parseCSV(CSV).catch((err) => {
    console.error(`Cannot read ${CSV}: ${err.message}`);
    process.exit(1);
  });

  console.log(`\nFound ${rows.length} collection row(s)`);

  for (const row of rows) {
    await processRow(row);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('✅  All done!');
  console.log('');
  console.log('Next step: Add lifestyle images');
  console.log('  Shopify Admin → Content → Metaobjects → matching_set');
  console.log('  Open each entry → click the Image field → upload photo');
  console.log('─'.repeat(50) + '\n');
})();
