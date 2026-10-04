// Rend les affiches en PNG pour contrôle (les URL raw sont servies depuis les fichiers locaux)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const BASE = 'https://raw.githubusercontent.com/thomasdankou-beep/loc-connect/claude/project-thread-qolnhy/campagne-dst/assets/';
const out = process.env.OUT || 'renders';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const cache = {};
  const viaCurl = async r => { const u = r.request().url(); if (!cache[u]) cache[u] = require('child_process').execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', u]); r.fulfill({ body: cache[u], contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2' }); };
  const keys = process.argv.slice(2);
  for (const k of keys) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, viaCurl);
    await p.route(BASE + '**', r => r.fulfill({ path: path.join(__dirname, 'assets', r.request().url().slice(BASE.length)) }));
    await p.goto('file://' + path.join(__dirname, 'posters', k + '.html'), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await (await p.$('.page')).screenshot({ path: path.join(out, k + '.png') });
    await p.close();
  }
  await b.close();
})();
