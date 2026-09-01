import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const html = read('src/index.template.html');
const app = JSON.parse(read('app.config.json'));
const readme = read('README.md');
const readmeJa = read('README.ja.md');
const spec = read('APP_SPEC.md');
const changelog = read('CHANGELOG.md');
const must = (cond,label)=>{ if(!cond) throw new Error(`Release v1.0.3 invariant failed: ${label}`); };

must(app.version === '1.0.3','app.config version');
must(html.includes('id="versionBadge">v1.0.3'),'visible version badge');
must(readme.includes('## Features'),'English README feature section');
must(readmeJa.includes('## 主な機能'),'Japanese README feature section');
must(readme.includes('## Privacy and networking'),'English README privacy section');
must(readmeJa.includes('## プライバシーと通信'),'Japanese README privacy section');
must(spec.includes('- Version: `1.0.3`'),'APP_SPEC release target');
must(changelog.includes('## 1.0.3 - 2026-09-01'),'CHANGELOG 1.0.0 entry');

for (const file of ['assets/favicon.svg','assets/screenshot.png','assets/screenshot-en.png','assets/screenshot-mobile.png']) {
  const stat = fs.statSync(path.join(root,file));
  must(stat.size > (file.endsWith('.png') ? 20_000 : 100), `${file} exists and is nontrivial`);
}
must(readme.includes('assets/screenshot-en.png'),'English README screenshot');
must(readmeJa.includes('assets/screenshot.png'),'Japanese README screenshot');
must(readme.includes('## Browser support'),'English browser support section');
must(readmeJa.includes('## 対応ブラウザー'),'Japanese browser support section');

must(html.includes("connect-src 'none'"),'runtime network blocked by CSP');
must(!/<script[^>]+src=["']https?:/i.test(html),'no runtime external script');
must(!/<link[^>]+href=["']https?:/i.test(html),'no runtime external stylesheet/font');
must(!/fetch\(\s*["']https?:/i.test(html),'no direct external fetch');
must(html.includes("fetch(`/__bkdev/signal/"),'development signaling remains explicitly local-path only');

must(html.includes('PPTX / PDF本体は発表用PCのブラウザー内で処理します。'),'Japanese privacy wording');
must(html.includes('The PPTX / PDF itself stays in the presenting browser.'),'English privacy wording');
must(html.includes('現在・次スライドの低解像度プレビュー'),'preview disclosure');
must(html.includes('発表者ノート'),'speaker notes disclosure');
must(html.includes('iceServers:[]'),'serverless WebRTC ICE configuration marker');
must(html.includes('const PROTOCOL_VERSION=4'),'stable protocol v4');
must(html.includes('const MAX_FILE_BYTES=150*1024*1024'),'150 MB local file limit');

const placeholders = [...html.matchAll(/__[A-Z0-9_]+__/g)].map(m=>m[0]);
const allowed = new Set(['__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__','__BK_DEV__','__PRESENTATION_APP_BOOT__']);
for (const token of placeholders) must(allowed.has(token),`unexpected placeholder ${token}`);

console.log('v1.0.3 release metadata / screenshots / privacy / offline invariants passed.');
