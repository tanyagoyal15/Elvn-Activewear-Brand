/**
 * Elvn — Matching Sets CSV Auto-Generator
 *
 * Fetches products from each collection, groups tops vs bottoms,
 * extracts all colors, and writes matching-sets.csv ready for create-matching-sets.js
 *
 * Run:
 *   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node discover-sets.js
 *
 * Optional — only run specific collections:
 *   SHOP=... TOKEN=... COLLECTIONS=matchpoint,aircourt node discover-sets.js
 */

import { writeFileSync } from "fs";
import fetch from "node-fetch";

const SHOP = process.env.SHOP;
const TOKEN = process.env.TOKEN;
const API_VER = "2024-01";

if (!SHOP || !TOKEN) {
  console.error(
    "Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node discover-sets.js",
  );
  process.exit(1);
}

// ─── The 11 collections to scan ──────────────────────────────────────────────
// These are the Shopify collection handles (lowercase, hyphenated).
// If a collection handle differs from the default, edit it here.
const COLLECTION_HANDLES = (
  process.env.COLLECTIONS ||
  [
    "court-muse",
    "matchpoint",
    "power-curve",
    "flowstudio",
    "aircourt",
    "contrastsculpt",
    "halter-flow",
    "advantage-set",
    "bodysculpt-top",
    "aerosculpt",
    "trueperformance",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Default hotspot positions (percentage of image width/height).
// Adjust per collection in the output CSV if needed.
const DEFAULT_HTX = 40; // top hotspot X
const DEFAULT_HTY = 28; // top hotspot Y
const DEFAULT_HBX = 55; // bottom hotspot X
const DEFAULT_HBY = 72; // bottom hotspot Y

// Keywords that identify a product as a "top"
const TOP_KEYWORDS = [
  "top",
  "bra",
  "shirt",
  "tee",
  "jacket",
  "hoodie",
  "sweatshirt",
  "vest",
  "blouse",
  "bodysuit",
];
// Keywords that identify a product as a "bottom"
const BOTTOM_KEYWORDS = [
  "legging",
  "leggings",
  "short",
  "shorts",
  "skirt",
  "pant",
  "pants",
  "jogger",
  "joggers",
  "sweatpant",
  "sweatpants",
  "trouser",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── API ─────────────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ─── Fetch all products in a collection (paginated) ──────────────────────────

async function getCollectionProducts(handle) {
  const products = [];
  let cursor = null;

  while (true) {
    const data = await gql(
      `
      query($handle: String!, $cursor: String) {
        collectionByHandle(handle: $handle) {
          title
          products(first: 50, after: $cursor) {
            edges {
              node {
                id
                title
                handle
                productType
                variants(first: 30) {
                  edges {
                    node { title }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { handle, cursor },
    );

    const col = data.collectionByHandle;
    if (!col) return { collectionTitle: null, products: [] };

    for (const { node } of col.products.edges) products.push(node);

    if (!col.products.pageInfo.hasNextPage) {
      return { collectionTitle: col.title, products };
    }
    cursor = col.products.pageInfo.endCursor;
    await sleep(400);
  }
}

// ─── Classify product as top / bottom / unknown ──────────────────────────────

function classifyProduct(product) {
  const haystack = (product.productType + " " + product.title).toLowerCase();
  if (TOP_KEYWORDS.some((k) => haystack.includes(k))) return "top";
  if (BOTTOM_KEYWORDS.some((k) => haystack.includes(k))) return "bottom";
  return "unknown";
}

// ─── Extract unique colors from variant titles ("Black / S" → "Black") ───────

const SIZE_WORDS = new Set([
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "ONE SIZE",
  "OS",
  "FREE SIZE",
]);

function extractColors(product) {
  const colors = new Set();
  for (const { node: v } of product.variants.edges) {
    const parts = v.title.split("/").map((s) => s.trim());
    const first = parts[0];
    if (!SIZE_WORDS.has(first.toUpperCase())) {
      colors.add(first);
    }
  }
  return [...colors];
}

// ─── Build CSV rows for one collection ───────────────────────────────────────
// Outputs ONE row per collection: ALL tops × ALL bottoms will be combined by
// create-matching-sets.js. Colors cycle across the full combo list.

function buildRows(collectionName, tops, bottoms) {
  if (!tops.length || !bottoms.length) return [];

  const topHandles = tops.map((p) => p.handle);
  const bottomHandles = bottoms.map((p) => p.handle);

  // All unique colors across every top and bottom in the collection
  const colorPool = [
    ...new Set([
      ...tops.flatMap((p) => extractColors(p)),
      ...bottoms.flatMap((p) => extractColors(p)),
    ]),
  ].filter(Boolean);

  if (!colorPool.length) {
    console.log(`  ⚠️  No color variants found — using "Default"`);
    colorPool.push("Default");
  }

  return [
    {
      collection: collectionName,
      top_handles: topHandles.join("|"),
      bottom_handles: bottomHandles.join("|"),
      all_colors: colorPool.join("|"),
      htx: DEFAULT_HTX,
      hty: DEFAULT_HTY,
      hbx: DEFAULT_HBX,
      hby: DEFAULT_HBY,
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Elvn — Discover Matching Sets`);
  console.log(`  Shop: ${SHOP}`);
  console.log(`  Collections: ${COLLECTION_HANDLES.join(", ")}`);
  console.log(`${"─".repeat(60)}\n`);

  const csvRows = [];
  const warnings = [];

  for (const handle of COLLECTION_HANDLES) {
    console.log(`\n📂 Collection: ${handle}`);
    const { collectionTitle, products } = await getCollectionProducts(handle);

    if (!collectionTitle) {
      console.log(`  ❌ Not found — check handle: "${handle}"`);
      warnings.push(`Collection not found: ${handle}`);
      continue;
    }

    console.log(`  Found ${products.length} products in "${collectionTitle}"`);

    const tops = [];
    const bottoms = [];
    const unknown = [];

    for (const p of products) {
      const type = classifyProduct(p);
      const colors = extractColors(p);
      const colorStr = colors.length
        ? colors.join(", ")
        : "(no color variants)";
      console.log(
        `  · [${type.padEnd(7)}] ${p.title.padEnd(45)} — ${colorStr}`,
      );

      if (type === "top") tops.push(p);
      else if (type === "bottom") bottoms.push(p);
      else unknown.push(p);
    }

    if (unknown.length) {
      console.log(
        `\n  ⚠️  Could not classify ${unknown.length} product(s) — review manually:`,
      );
      unknown.forEach((p) =>
        console.log(`     · ${p.title} (type: "${p.productType}")`),
      );
      warnings.push(
        `${collectionTitle}: ${unknown.length} unclassified products — ${unknown.map((p) => p.title).join(", ")}`,
      );
    }

    if (!tops.length) {
      console.log(`  ⚠️  No tops found`);
      warnings.push(`${collectionTitle}: no tops found`);
    }
    if (!bottoms.length) {
      console.log(`  ⚠️  No bottoms found`);
      warnings.push(`${collectionTitle}: no bottoms found`);
    }

    const rows = buildRows(collectionTitle, tops, bottoms);
    csvRows.push(...rows);

    console.log(`  → ${rows.length} CSV row(s) generated`);
    await sleep(400);
  }

  // ─── Write CSV ──────────────────────────────────────────────────────────────

  const header =
    "collection,top_handles,bottom_handles,all_colors,htx,hty,hbx,hby";
  const lines = csvRows.map((r) =>
    [
      r.collection,
      r.top_handles,
      r.bottom_handles,
      r.all_colors,
      r.htx,
      r.hty,
      r.hbx,
      r.hby,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );

  writeFileSync("./matching-sets.csv", [header, ...lines].join("\n") + "\n");

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅  Written ${csvRows.length} row(s) to matching-sets.csv`);

  if (warnings.length) {
    console.log(`\n⚠️  Warnings to review:`);
    warnings.forEach((w) => console.log(`   · ${w}`));
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Open matching-sets.csv — review products & color pool`);
  console.log(`  2. Adjust hotspot positions (htx/hty/hbx/hby) per collection`);
  console.log(
    `  3. Move any products between top_handles/bottom_handles if misclassified`,
  );
  console.log(
    `  4. Edit all_colors if you want to limit/reorder colors cycled across sets`,
  );
  console.log(
    `  5. Run: SHOP=${SHOP} TOKEN=<token> node create-matching-sets.js`,
  );
  console.log(
    `  6. Add lifestyle images in Shopify Admin → Content → Metaobjects`,
  );
  console.log(`${"─".repeat(60)}\n`);
})().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
