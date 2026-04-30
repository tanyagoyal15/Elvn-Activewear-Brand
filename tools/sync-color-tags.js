/**
 * Sync Color Tags
 *
 * Reads every product's variant base_color_family metafield and adds
 * "color-{base_color_handle}" tags to the product so that smart collections
 * (with condition: Tag = color-black, Tag = color-pink, etc.) pick them up.
 *
 * A product with both a Black variant and a Pink variant will receive
 * BOTH "color-black" AND "color-pink" tags.
 *
 * Run AFTER apply-base-colors.js has set metafields on all variants.
 *
 * Run:
 *   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node sync-color-tags.js
 *
 * Optional:
 *   DRY_RUN=true   — preview changes, nothing written
 */

import fetch from 'node-fetch';

const SHOP    = process.env.SHOP;
const TOKEN   = process.env.TOKEN;
const DRY_RUN = process.env.DRY_RUN === 'true';
const API_VER = '2024-01';

if (!SHOP || !TOKEN) {
  console.error('Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node sync-color-tags.js');
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

// ─── FETCH ALL PRODUCTS WITH VARIANT METAFIELDS AND EXISTING TAGS ─────────────

async function getAllProducts() {
  const products = [];
  let cursor = null;
  let page = 1;

  while (true) {
    console.log(`  Fetching products page ${page}...`);
    const data = await gql(
      `query($cursor: String) {
         products(first: 250, after: $cursor) {
           edges {
             node {
               id
               title
               tags
               variants(first: 100) {
                 edges {
                   node {
                     metafield(namespace: "custom", key: "base_color_family") {
                       value
                     }
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

    for (const { node } of data.products.edges) {
      products.push(node);
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    page++;
    await sleep(400);
  }

  return products;
}

// ─── ADD TAGS TO A PRODUCT ────────────────────────────────────────────────────

async function addTagsToProduct(productGid, allTags) {
  const data = await gql(
    `mutation($id: ID!, $tags: [String!]!) {
       tagsAdd(id: $id, tags: $tags) {
         node { id }
         userErrors { field message }
       }
     }`,
    { id: productGid, tags: allTags }
  );

  const { userErrors } = data.tagsAdd;
  if (userErrors.length) throw new Error(JSON.stringify(userErrors));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${'─'.repeat(55)}`);
  console.log('  Sync Color Tags');
  console.log(`  Shop    : ${SHOP}`);
  if (DRY_RUN) console.log('  MODE    : DRY RUN — nothing will be written');
  console.log(`${'─'.repeat(55)}\n`);

  console.log('Loading all products...');
  const products = await getAllProducts();
  console.log(`Found ${products.length} products\n`);

  let updated = 0, alreadyOk = 0, failed = 0;

  for (const product of products) {
    // Collect all base colors this product has (across all variants)
    const neededColors = new Set();

    for (const { node: variant } of product.variants.edges) {
      const baseColor = variant.metafield?.value;
      if (!baseColor) continue;
      // e.g. "Butter Yellow" → "color-butter-yellow"
      const tag = 'color-' + baseColor.toLowerCase().replace(/\s+/g, '-');
      neededColors.add(tag);
    }

    if (neededColors.size === 0) {
      // No base_color_family set on any variant — skip
      continue;
    }

    // Check which tags are already on the product
    const existingTags = new Set(product.tags);
    const toAdd = [...neededColors].filter((t) => !existingTags.has(t));

    if (toAdd.length === 0) {
      console.log(`  ✓ "${product.title}" — already tagged (${[...neededColors].join(', ')})`);
      alreadyOk++;
      continue;
    }

    console.log(`  + "${product.title}" — adding: ${toAdd.join(', ')}`);

    if (DRY_RUN) {
      updated++;
      continue;
    }

    try {
      await addTagsToProduct(product.id, toAdd);
      updated++;
    } catch (err) {
      console.error(`  ❌ "${product.title}": ${err.message}`);
      failed++;
    }

    await sleep(300);
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  Done!`);
  console.log(`  Updated  : ${updated} products (tags added)`);
  console.log(`  Already OK: ${alreadyOk} products`);
  console.log(`  Failed   : ${failed}`);
  if (DRY_RUN) console.log('  (DRY RUN — no changes were written)');
  console.log('─'.repeat(55) + '\n');

  console.log('Next: make sure each color collection has the right tag condition.');
  console.log('  e.g. Black collection → Condition: Tag = color-black');
  console.log('       Pink collection  → Condition: Tag = color-pink');
  console.log('       Butter Yellow   → Condition: Tag = color-butter-yellow\n');
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
