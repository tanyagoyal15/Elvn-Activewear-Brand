/**
 * Step 1: Discover all unique variant colors across every product in your store.
 *
 * Run:
 *   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node list-variant-colors.js
 *
 * Output:
 *   colors.csv  — fill in the base_color column, then run apply-base-colors.js
 */

import { writeFileSync } from 'fs';
import fetch from 'node-fetch';

const SHOP    = process.env.SHOP;
const TOKEN   = process.env.TOKEN;
const API_VER = '2024-01';

if (!SHOP || !TOKEN) {
  console.error('Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node list-variant-colors.js');
  process.exit(1);
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── FETCH ALL PRODUCTS (handles pagination) ──────────────────────────────────

async function getAllProducts() {
  const all = [];
  let cursor = null;
  let page = 1;

  while (true) {
    console.log(`  Fetching page ${page}...`);
    const data = await gql(
      `query($cursor: String) {
         products(first: 250, after: $cursor) {
           edges {
             node {
               id
               title
               productType
               variants(first: 100) {
                 edges {
                   node {
                     id
                     title
                   }
                 }
               }
             }
           }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { cursor }
    );

    for (const edge of data.products.edges) {
      all.push(edge.node);
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    page++;
    await sleep(300);
  }

  return all;
}

// ─── EXTRACT COLOR FROM VARIANT TITLE ────────────────────────────────────────
// Variant titles are usually "Color / Size" e.g. "Midnight Blue / S"
// Some products only have sizes (no color) — we skip those

const SIZE_WORDS = new Set([
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL',
  'ONE SIZE', 'OS', 'FREE SIZE',
  '24', '25', '26', '27', '28', '29', '30', '32', '34', '36', // waist sizes
]);

function extractColor(variantTitle) {
  const parts = variantTitle.split('/').map((s) => s.trim());

  if (parts.length >= 2) {
    // "Midnight Blue / S"  →  "Midnight Blue"
    return parts[0];
  }

  // Single value — skip if it looks like a size
  const upper = parts[0].toUpperCase();
  if (SIZE_WORDS.has(upper)) return null;

  return parts[0];
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nFetching all products from ${SHOP}...\n`);
  const products = await getAllProducts();
  console.log(`\nTotal products: ${products.length}`);

  // color → Set of product titles (for reference)
  const colorMap = {};

  for (const product of products) {
    for (const { node: variant } of product.variants.edges) {
      const color = extractColor(variant.title);
      if (!color) continue;

      if (!colorMap[color]) colorMap[color] = new Set();
      colorMap[color].add(product.title);
    }
  }

  const colors = Object.keys(colorMap).sort((a, b) => a.localeCompare(b));
  console.log(`Unique colors found: ${colors.length}\n`);

  // Print them so you can see them immediately
  colors.forEach((c) => console.log(`  · ${c}`));

  // Write CSV — user fills in base_color column
  const rows = ['variant_color,base_color,example_products'];
  for (const color of colors) {
    const examples = [...colorMap[color]].slice(0, 3).join(' | ');
    // Escape quotes in values
    const safe = (s) => `"${s.replace(/"/g, '""')}"`;
    rows.push(`${safe(color)},,${safe(examples)}`);
  }

  writeFileSync('./colors.csv', rows.join('\n') + '\n');

  console.log('\n✅  Written to colors.csv');
  console.log('\nNext steps:');
  console.log('  1. Open colors.csv in Numbers or Google Sheets');
  console.log('  2. Fill in the base_color column for each row');
  console.log('     Valid base colors: Black, Purple, Pink, Red, Butter Yellow,');
  console.log('                        Green, Brown, Blue, Beige, White');
  console.log('  3. Save the file, then run apply-base-colors.js');
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
