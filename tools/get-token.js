/**
 * Shopify OAuth Token Getter
 * Run: CLIENT_SECRET=your_secret node get-token.js
 * Then approve the browser popup — token prints automatically.
 */

import http from 'http';
import { exec } from 'child_process';

const SHOP          = 'ejjge0-zf.myshopify.com';
const CLIENT_ID     = '1641343a64c6dc265db4325d9c83b5e8';
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3000/callback';
const SCOPES        = 'read_products,write_metaobjects,read_metaobjects';

if (!CLIENT_SECRET) {
  console.error('\n❌  Missing CLIENT_SECRET');
  console.error('    Run as: CLIENT_SECRET=your_secret node get-token.js\n');
  process.exit(1);
}

const authUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=elvn`;

// ─── Start local server to capture the OAuth callback ────────────────────────

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) return;

  const params  = new URL(req.url, 'http://localhost:3000').searchParams;
  const code    = params.get('code');
  const shop    = params.get('shop');

  if (!code) {
    res.end('No code received.');
    server.close();
    return;
  }

  // Exchange code for token
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    });
    const data = await tokenRes.json();

    if (data.access_token) {
      console.log('\n' + '─'.repeat(50));
      console.log('✅  Access token:');
      console.log(`\n    ${data.access_token}\n`);
      console.log('Copy the token above, then share it to create your matching sets.');
      console.log('─'.repeat(50) + '\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h2 style="font-family:sans-serif;padding:40px">✅ Token copied to terminal!<br><br><small>You can close this tab.</small></h2>`);
    } else {
      console.error('\n❌  Token exchange failed:', JSON.stringify(data));
      res.end('Token exchange failed — check terminal.');
    }
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    res.end('Error — check terminal.');
  }

  server.close();
});

server.listen(3000, () => {
  console.log('\n' + '─'.repeat(50));
  console.log('  Opening browser for Shopify approval...');
  console.log('  (approve the install prompt, then come back here)');
  console.log('─'.repeat(50) + '\n');

  // Open browser automatically
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${open} "${authUrl}"`);
});
