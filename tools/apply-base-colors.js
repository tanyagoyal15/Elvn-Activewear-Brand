/**
 * Step 2: Apply base_color metafield to every matching variant in your store.
 *
 * Prerequisites:
 *   - Run list-variant-colors.js first to generate colors.csv
 *   - Fill in the base_color column in colors.csv
 *   - The variant metafield must already exist in Shopify
 *     (Settings → Custom data → Variants → your metafield)
 *
 * Run:
 *   SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node apply-base-colors.js
 *
 * Optional env vars:
 *   NAMESPACE=custom   (default: custom)
 *   KEY=base_color     (default: base_color — must match your metafield key exactly)
 *   DRY_RUN=true       (preview changes without writing anything)
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import fetch from "node-fetch";

const SHOP = process.env.SHOP;
const TOKEN = process.env.TOKEN;
const NAMESPACE = process.env.NAMESPACE || "custom";
const KEY = process.env.KEY || "base_color";
const DRY_RUN = process.env.DRY_RUN === "true";
const API_VER = "2024-01";

if (!SHOP || !TOKEN) {
  console.error(
    "Run as: SHOP=yourstore.myshopify.com TOKEN=shpat_xxx node apply-base-colors.js",
  );
  process.exit(1);
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── LOAD MAPPING CSV ─────────────────────────────────────────────────────────

async function loadMapping() {
  return new Promise((resolve, reject) => {
    const map = {}; // "Midnight Blue" → "Blue"
    createReadStream("./colors.csv")
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row) => {
        const variantColor = row.variant_color?.trim();
        const baseColor = row.base_color?.trim();
        if (variantColor && baseColor) {
          map[variantColor] = baseColor;
        }
      })
      .on("end", () => resolve(map))
      .on("error", reject);
  });
}

// ─── FETCH ALL PRODUCTS ───────────────────────────────────────────────────────

async function getAllProducts() {
  const all = [];
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
                   }
                 }
               }
             }
           }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { cursor },
    );

    for (const edge of data.products.edges) {
      all.push(edge.node);
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    page++;
    await sleep(400);
  }

  return all;
}

// ─── UPDATE VARIANT METAFIELD ─────────────────────────────────────────────────

async function setVariantMetafield(variantGid, baseColor) {
  const data = await gql(
    `mutation($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { id value }
         userErrors  { field message }
       }
     }`,
    {
      metafields: [
        {
          ownerId: variantGid,
          namespace: NAMESPACE,
          key: KEY,
          value: baseColor,
          type: "single_line_text_field",
        },
      ],
    },
  );

  const { userErrors } = data.metafieldsSet;
  if (userErrors.length) throw new Error(JSON.stringify(userErrors));
}

// ─── EXTRACT COLOR FROM VARIANT TITLE ────────────────────────────────────────

const SIZE_WORDS = new Set([
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "3XL",
  "XXXL",
  "ONE SIZE",
  "OS",
  "FREE SIZE",
]);

function extractColor(variantTitle) {
  const parts = variantTitle.split("/").map((s) => s.trim());
  if (parts.length >= 2) return parts[0];
  if (SIZE_WORDS.has(parts[0].toUpperCase())) return null;
  return parts[0];
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Apply Base Colors`);
  console.log(`  Shop      : ${SHOP}`);
  console.log(`  Metafield : ${NAMESPACE}.${KEY}`);
  if (DRY_RUN)
    console.log("  MODE      : DRY RUN — no changes will be written");
  console.log(`${"─".repeat(55)}\n`);

  // Load mapping
  console.log("Loading colors.csv...");
  const mapping = await loadMapping().catch(() => {
    console.error(
      "❌  Cannot read colors.csv — run list-variant-colors.js first",
    );
    process.exit(1);
  });

  const mappedColors = Object.keys(mapping);
  console.log(`Loaded ${mappedColors.length} color mappings\n`);

  if (mappedColors.length === 0) {
    console.error(
      "❌  No mappings found. Fill in the base_color column in colors.csv",
    );
    process.exit(1);
  }

  // Fetch all products
  console.log("Fetching products...");
  const products = await getAllProducts();
  console.log(`Found ${products.length} products\n`);

  // Track results
  let updated = 0,
    skipped = 0,
    unmapped = 0,
    failed = 0;
  const unmappedColors = new Set();

  for (const product of products) {
    for (const { node: variant } of product.variants.edges) {
      const color = extractColor(variant.title);
      if (!color) {
        skipped++;
        continue;
      }

      const baseColor = mapping[color];

      if (!baseColor) {
        unmapped++;
        unmappedColors.add(color);
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  [DRY RUN] ${product.title} — "${variant.title}" → ${baseColor}`,
        );
        updated++;
        continue;
      }

      try {
        await setVariantMetafield(variant.id, baseColor);
        console.log(`  ✅ ${product.title} — "${color}" → ${baseColor}`);
        updated++;
      } catch (err) {
        console.error(`  ❌ ${product.title} — "${color}": ${err.message}`);
        failed++;
      }

      await sleep(250); // stay under rate limits
    }
  }

  // Summary
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  Done!`);
  console.log(`  Updated  : ${updated} variants`);
  console.log(`  Skipped  : ${skipped} (size-only variants)`);
  console.log(`  No mapping: ${unmapped} variants`);
  console.log(`  Failed   : ${failed}`);
  console.log(`${"─".repeat(55)}`);

  if (unmappedColors.size > 0) {
    console.log(
      `\n⚠️  These colors were NOT in your mapping — add them to colors.csv:`,
    );
    [...unmappedColors].sort().forEach((c) => console.log(`   · ${c}`));
  }
})().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
