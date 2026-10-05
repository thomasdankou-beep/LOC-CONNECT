// Rendu local de contrôle (images servies depuis assets/)
const { chromium } = require('playwright');
const path = require('path');
const cache = {};
const viaCurl = async r => { const u = r.request().url(); if (!cache[u]) cache[u] = require('child_process').execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', u]); r.fulfill({ body: cache[u], contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2' }); };
(async () => {
  const b = await chromium.launch();
  for (const k of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1700, height: 1200 } });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, viaCurl);
    await p.route(/raw\.githubusercontent\.com/, r => r.fulfill({ path: path.join(__dirname, 'assets', path.basename(r.request().url())) }));
    await p.goto('file://' + path.join(__dirname, k + '.html'), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await (await p.$('.page')).screenshot({ path: process.env.OUT + '/' + k + '.png' });
  }
  await b.close();
})();
