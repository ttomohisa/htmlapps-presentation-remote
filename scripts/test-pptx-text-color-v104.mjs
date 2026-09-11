import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('src/index.template.html');
const built=read('presentation-remote.html');
const notices=read('THIRD_PARTY_NOTICES.md');
const must=(cond,label)=>{if(!cond)throw new Error(`PPTX text-color v1.0.4 regression failed: ${label}`)};

const oldExpr='i != null && i.fontRefColor ? Q = tt ? H.color : i.fontRefColor : i != null && i.cellTextColor && !tt ? Q = i.cellTextColor : Q = H.color';
const newExpr='i != null && i.fontRefColor ? Q = H.color ?? i.fontRefColor : i != null && i.cellTextColor && !tt ? Q = H.color ?? i.cellTextColor : Q = H.color';

for(const source of [html,built]){
  must(source.includes('function patchPptxRendererTextColorPrecedence(source)'), 'compatibility patch function');
  must(source.includes(oldExpr), 'exact pinned renderer expression marker');
  must(source.includes(newExpr), 'replacement expression');
  must(source.includes("StandaloneAssets.textAsync('pptx-renderer','browser')"), 'renderer source loaded as embedded text');
  must(source.includes('patchPptxRendererTextColorPrecedence(await StandaloneAssets.textAsync'), 'patch applied before import');
}

const marker='const assetBundle = ';
const start=built.indexOf(marker);
must(start>=0,'embedded asset bundle exists');
const jsonStart=start+marker.length;
const jsonEnd=built.indexOf(';\n',jsonStart);
must(jsonEnd>jsonStart,'embedded asset bundle terminator');
const bundle=JSON.parse(built.slice(jsonStart,jsonEnd));
const asset=bundle.dependencies?.['pptx-renderer']?.assets?.browser;
must(asset?.base64,'embedded pptx-renderer browser asset');
const bytes=Buffer.from(asset.base64,'base64');
const decoded=asset.compression==='gzip'?zlib.gunzipSync(bytes):bytes;
const renderer=decoded.toString('utf8');
must(renderer.includes(oldExpr),'pinned 1.2.4 renderer still contains exact upstream precedence expression');
const patched=renderer.replace(oldExpr,newExpr);
must(!patched.includes(oldExpr),'old precedence removed by compatibility patch');
must(patched.includes(newExpr),'new precedence inserted by compatibility patch');
must(notices.includes('Local text-color compatibility patch'),'third-party notice documents in-memory patch');

console.log('Presentation Remote v1.0.4 PPTX text-color compatibility checks passed.');
