/**
 * Sync Color Collections
 *
 * Reads every product's variant base_color_family metafield and
 * adds it to the matching color collection automatically.
 *
 * Run AFTER apply-base-colors.js has set metafields on all variants.
 *
 * Run:
 *   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node sync-color-collections.js
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
  console.error('Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node sync-color-collections.js');
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

// ─── FETCH ALL COLOR COLLECTIONS ──────────────────────────────────────────────
// Finds collections that have the custom.color_display_name metafield set
// (these are your color editorial pages)

async function getColorCollections() {
  const collections = [];
  let cursor = null;

  while (true) {
    const data = await gql(
      `query($cursor: String) {
         collections(first: 50, after: $cursor) {
           edges {
             node {
               id
               title
               handle
               metafield(namespace: "custom", key: "color_display_name") {
                 value
               }
             }
           }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { cursor }
    );

    for (const { node } of data.collections.edges) {
      if (node.metafield?.value) {
        collections.push({
          gid:         node.id,
          title:       node.title,
          handle:      node.handle,
          colorName:   node.metafield.value,           // e.g. "Pink"
          colorHandle: node.metafield.value.toLowerCase().replace(/\s+/g, '-'), // e.g. "pink"
        });
      }
    }

    if (!data.collections.pageInfo.hasNextPage) break;
    cursor = data.collections.pageInfo.endCursor;
    await sleep(300);
  }

  return collections;
}

// ─── FETCH ALL PRODUCTS WITH VARIANT METAFIELDS ───────────────────────────────

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
               variants(first: 100) {
                 edges {
                   node {
                     id
                     title
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

// ─── GET EXISTING PRODUCTS IN COLLECTION ────────────────────────────────────
// So we don't add duplicates

async function getCollectionProductIds(collectionGid) {
  const ids = new Set();
  let cursor = null;

  while (true) {
    const data = await gql(
      `query($id: ID!, $cursor: String) {
         collection(id: $id) {
           products(first: 250, after: $cursor) {
             edges { node { id } }
             pageInfo { hasNextPage endCursor }
           }
         }
       }`,
      { id: collectionGid, cursor }
    );

    for (const { node } of data.collection.products.edges) {
      ids.add(node.id);
    }

    if (!data.collection.products.pageInfo.hasNextPage) break;
    cursor = data.collection.products.pageInfo.endCursor;
    await sleep(200);
  }

  return ids;
}

// ─── ADD PRODUCTS TO COLLECTION ───────────────────────────────────────────────

async function addProductsToCollection(collectionGid, productGids) {
  const data = await gql(
    `mutation($id: ID!, $productIds: [ID!]!) {
       collectionAddProducts(id: $id, productIds: $productIds) {
         collection { id title }
         userErrors  { field message }
       }
     }`,
    { id: collectionGid, productIds: productGids }
  );

  const { userErrors } = data.collectionAddProducts;
  if (userErrors.length) throw new Error(JSON.stringify(userErrors));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${'─'.repeat(55)}`);
  console.log('  Sync Color Collections');
  console.log(`  Shop    : ${SHOP}`);
  if (DRY_RUN) console.log('  MODE    : DRY RUN — nothing will be written');
  console.log(`${'─'.repeat(55)}\n`);

  // 1. Load color collections
  console.log('Loading color collections...');
  const colorCollections = await getColorCollections();

  if (!colorCollections.length) {
    console.error('❌  No collections found with custom.color_display_name metafield set.');
    console.error('   Make sure each color collection has this metafield filled in Shopify admin.');
    process.exit(1);
  }

  console.log(`Found ${colorCollections.length} color collections:`);
  colorCollections.forEach((c) => console.log(`  · ${c.colorName}  (${c.handle})`));

  // 2. Load all products
  console.log('\nLoading all products...');
  const products = await getAllProducts();
  console.log(`Found ${products.length} products\n`);

  // 3. Build map: colorHandle → [productGids]
  //    A product is included in a color collection if ANY of its variants
  //    has base_color_family matching that color.
  const colorToProducts = {}; // "pink" → Set of product GIDs
  const productBaseColors = {}; // productGid → Set of color handles

  for (const product of products) {
    const colorsForProduct = new Set();

    for (const { node: variant } of product.variants.edges) {
      const baseColor = variant.metafield?.value;
      if (!baseColor) continue;

      const colorHandle = baseColor.toLowerCase().replace(/\s+/g, '-');
      colorsForProduct.add(colorHandle);

      if (!colorToProducts[colorHandle]) colorToProducts[colorHandle] = new Set();
      colorToProducts[colorHandle].add(product.id);
    }

    if (colorsForProduct.size > 0) {
      productBaseColors[product.id] = colorsForProduct;
    }
  }

  // Summary
  console.log('Products per color (from metafields):');
  for (const col of colorCollections) {
    const count = colorToProducts[col.colorHandle]?.size || 0;
    console.log(`  ${col.colorName.padEnd(14)} → ${count} products`);
  }

  // 4. For each color collection, add missing products
  console.log('\nSyncing collections...\n');
  let totalAdded = 0;

  for (const col of colorCollections) {
    const shouldHave = colorToProducts[col.colorHandle] || new Set();

    if (shouldHave.size === 0) {
      console.log(`  ${col.colorName}: no products with this base color — skipping`);
      continue;
    }

    // Find which products are already in this collection
    console.log(`  ${col.colorName}: checking existing products...`);
    const alreadyIn = await getCollectionProductIds(col.gid);
    await sleep(300);

    const toAdd = [...shouldHave].filter((gid) => !alreadyIn.has(gid));

    if (toAdd.length === 0) {
      console.log(`  ${col.colorName}: already up to date (${alreadyIn.size} products) ✓`);
      continue;
    }

    console.log(`  ${col.colorName}: adding ${toAdd.length} products (already has ${alreadyIn.size})`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] would add ${toAdd.length} products to ${col.title}`);
      totalAdded += toAdd.length;
      continue;
    }

    // Shopify allows max 250 products per API call — chunk if needed
    const CHUNK = 250;
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const chunk = toAdd.slice(i, i + CHUNK);
      try {
        await addProductsToCollection(col.gid, chunk);
        console.log(`  ✅ ${col.colorName}: added ${chunk.length} products`);
        totalAdded += chunk.length;
      } catch (err) {
        console.error(`  ❌ ${col.colorName}: ${err.message}`);
      }
      await sleep(500);
    }
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  Done! ${totalAdded} products added across all color collections.`);
  if (DRY_RUN) console.log('  (DRY RUN — no changes were written)');
  console.log('─'.repeat(55) + '\n');
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
