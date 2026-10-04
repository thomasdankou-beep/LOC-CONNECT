const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
 for (const f of fs.readdirSync(path.join(__dirname,'icons-src'))) {
  const svg = fs.readFileSync(path.join(__dirname,'icons-src',f),'utf8');
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await (await p.$('svg')).screenshot({ path: path.join(__dirname,'assets','ico-'+f.replace('.svg','.png')), omitBackground: true });
 } await b.close(); })();
