#!/usr/bin/env node
/**
 * Elvn Reviews Refresher
 * Run: node refresh-reviews.js
 *
 * Fetches latest reviews from Judge.me and uploads to Shopify theme asset.
 * No npm install needed — uses Node.js built-in https module.
 */

const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const JUDGEME_TOKEN  = 'eQqnPJZkoTo8DIVtlfIT1O1zHT4';   // private token (server-side only)
const SHOP_DOMAIN    = 'ejjge0-zf.myshopify.com';
const THEME_ID       = '162017706226';                     // draft theme
const MIN_RATING     = 3;
const COUNT          = 8;

// Create a Shopify Admin API token:
// Shopify Admin → Settings → Apps → Develop apps → Create app → Admin API → write_themes scope
// Paste the token below:
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN || 'PASTE_YOUR_SHOPIFY_ADMIN_TOKEN_HERE';
// ─────────────────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function put(host, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: host,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Shopify-Access-Token': token,
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`Shopify API ${res.statusCode}: ${data}`));
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (SHOPIFY_TOKEN === 'PASTE_YOUR_SHOPIFY_ADMIN_TOKEN_HERE') {
    console.error('\n❌  Add your Shopify Admin API token to refresh-reviews.js (line 22) then re-run.\n');
    console.error('   How to get it: Shopify Admin → Settings → Apps → Develop apps');
    console.error('   → Create private app → Admin API access scopes → write_themes → Install\n');
    process.exit(1);
  }

  console.log('📥  Fetching reviews from Judge.me…');
  const url = `https://judge.me/api/v1/reviews`
    + `?api_token=${JUDGEME_TOKEN}`
    + `&shop_domain=${SHOP_DOMAIN}`
    + `&per_page=${COUNT}`
    + `&rating[gte]=${MIN_RATING}`
    + `&sort_by=published_at&sort_dir=desc`;

  const data = await get(url);
  const reviews = (data.reviews || []).map(r => ({
    rating:         r.rating,
    body:           r.body,
    reviewer:       r.reviewer,
    product_title:  r.product_title,
    verified_buyer: r.verified_buyer,
  }));

  console.log(`✅  Got ${reviews.length} reviews (${MIN_RATING}★+)`);

  if (reviews.length === 0) {
    console.log('⚠️   No reviews found — skipping upload.');
    return;
  }

  console.log('📤  Uploading reviews-data.json to Shopify…');
  await put(
    SHOP_DOMAIN,
    `/admin/api/2024-01/themes/${THEME_ID}/assets.json`,
    { asset: { key: 'assets/reviews-data.json', value: JSON.stringify(reviews) } },
    SHOPIFY_TOKEN
  );

  console.log('🎉  Done! Homepage reviews updated.\n');
  reviews.forEach((r, i) => {
    const name = r.reviewer?.name || 'Customer';
    console.log(`   ${i+1}. ${name} — ${r.rating}★ — "${(r.body || '').slice(0, 60)}…"`);
  });
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
