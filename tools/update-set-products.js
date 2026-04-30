/**
 * Elvn — Update matching_set metaobjects to include ALL collection products.
 * First 2 products stay as the main pair (top + bottom).
 * The rest become the "also pair it with" items.
 * Also sets every entry to ACTIVE.
 *
 * Run: SHOP=x.myshopify.com TOKEN=shpat_xxx node update-set-products.js
 */

import fetch from 'node-fetch';

const SHOP    = process.env.SHOP;
const TOKEN   = process.env.TOKEN;
const API_VER = '2024-01';
const TYPE    = 'matching_set';
const DELAY   = 700;

if (!SHOP || !TOKEN) {
  console.error('Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node update-set-products.js');
  process.exit(1);
}

// Metaobject title prefix → Shopify collection handle
// Add more entries here when new collections are added.
const COLLECTION_MAP = {
  'MatchPoint':      'matchpoint',
  'FlowStudio':      'flowstudio',
  'AirCourt':        'aircourt',
  'ContrastSculpt':  'contrastsculpt',
  'Advantage':       'advantage-set',
  'TruePerformance': 'trueperformance',
  'PowerCurve':      'power-curve',
  'HalterFlow':      'halter-flow',
  'Halter Flow':     'halter-flow',
  'BodySculpt':      'bodysculpt-top',
  'CourtMuse':       'court-muse',
  'AeroSculpt':      'aerosculpt',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── API ─────────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ─── Fetch all matching_set metaobjects ───────────────────────────────────────

async function getAllMetaobjects() {
  const all = [];
  let cursor = null;
  while (true) {
    const data = await gql(`
      query($type: String!, $cursor: String) {
        metaobjects(type: $type, first: 50, after: $cursor) {
          edges {
            node {
              id
              handle
              fields { key value }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { type: TYPE, cursor });

    for (const { node } of data.metaobjects.edges) all.push(node);
    if (!data.metaobjects.pageInfo.hasNextPage) break;
    cursor = data.metaobjects.pageInfo.endCursor;
    await sleep(DELAY);
  }
  return all;
}

// ─── Fetch all product GIDs from a collection (cached) ───────────────────────

const collectionCache = {};

async function getCollectionProductGids(handle) {
  if (collectionCache[handle]) return collectionCache[handle];

  const gids = [];
  let cursor = null;
  while (true) {
    const data = await gql(`
      query($handle: String!, $cursor: String) {
        collectionByHandle(handle: $handle) {
          products(first: 50, after: $cursor) {
            edges { node { id } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `, { handle, cursor });

    const col = data.collectionByHandle;
    if (!col) return [];
    for (const { node } of col.products.edges) gids.push(node.id);
    if (!col.products.pageInfo.hasNextPage) break;
    cursor = col.products.pageInfo.endCursor;
    await sleep(DELAY);
  }

  collectionCache[handle] = gids;
  return gids;
}

// ─── Update metaobject ────────────────────────────────────────────────────────

async function updateMetaobject(id, fields) {
  const data = await gql(`
    mutation($id: ID!, $m: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $m) {
        metaobject { id handle }
        userErrors { field message }
      }
    }
  `, {
    id,
    m: {
      fields,
      capabilities: { publishable: { status: 'ACTIVE' } },
    },
  });

  const { metaobject, userErrors } = data.metaobjectUpdate;
  if (userErrors?.length) throw new Error(JSON.stringify(userErrors, null, 2));
  return metaobject;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Elvn — Update Matching Set Products`);
  console.log(`  Shop: ${SHOP}`);
  console.log(`${'─'.repeat(60)}\n`);

  const metaobjects = await getAllMetaobjects();
  console.log(`Found ${metaobjects.length} matching_set entries\n`);

  let updated = 0, skipped = 0, failed = 0;

  for (const mo of metaobjects) {
    const titleField = mo.fields.find(f => f.key === 'title');
    const title = titleField?.value || mo.handle;

    // Extract collection name from "CollectionName | Top + Bottom"
    const collectionName = title.split('|')[0].trim();
    const collectionHandle = COLLECTION_MAP[collectionName];

    if (!collectionHandle) {
      console.log(`  ⚠️  No handle mapping for "${collectionName}" — skipping: ${title}`);
      skipped++;
      continue;
    }

    // Parse current products field
    const productsField = mo.fields.find(f => f.key === 'products');
    let currentGids = [];
    try { currentGids = JSON.parse(productsField?.value || '[]'); } catch {}

    if (currentGids.length < 2) {
      console.log(`  ⚠️  Less than 2 products — skipping: ${title}`);
      skipped++;
      continue;
    }

    const [topGid, bottomGid] = currentGids;

    // Fetch all products from collection
    const allCollectionGids = await getCollectionProductGids(collectionHandle);
    await sleep(DELAY);

    if (!allCollectionGids.length) {
      console.log(`  ⚠️  Collection "${collectionHandle}" empty — skipping: ${title}`);
      skipped++;
      continue;
    }

    // top + bottom first, then every other product in the collection
    const otherGids = allCollectionGids.filter(g => g !== topGid && g !== bottomGid);
    const newGids   = [topGid, bottomGid, ...otherGids];

    const alreadyComplete = JSON.stringify(newGids) === JSON.stringify(currentGids);

    try {
      // Always call update to ensure ACTIVE status is set
      await updateMetaobject(mo.id, [
        { key: 'products', value: JSON.stringify(newGids) },
      ]);
      if (alreadyComplete) {
        console.log(`  ✓ Activated (already had full products): ${title}`);
      } else {
        console.log(`  ✅ Updated + Activated: ${title}  (${newGids.length} products — ${otherGids.length} added)`);
      }
      updated++;
    } catch (err) {
      console.error(`  ❌ Failed: ${title}\n     ${err.message}`);
      failed++;
    }

    await sleep(DELAY);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅  Done: ${updated} updated/activated, ${skipped} skipped, ${failed} failed`);
  console.log(`${'─'.repeat(60)}\n`);
})().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
