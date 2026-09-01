import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const must=(cond,label)=>{if(!cond)throw new Error(`Repository cleanup regression failed: ${label}`)};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/index.template.html');
const built=read('presentation-remote.html');
const app=JSON.parse(read('app.config.json'));

must(app.name==='Presentation Remote','neutral English product name');
must(app.nameJa==='プレゼンテーションリモート','neutral Japanese product name');
must(source.includes("function refreshLoadedDocumentText()"),'loaded-document text refresh helper exists');
must(source.includes("refreshLoadedDocumentText();renderRemotePresenterView()"),'language switch refreshes loaded-document labels');
must(source.includes("function installMapCompatibility()"),'PDF.js Map compatibility shim exists');
must(source.includes("Map.prototype.getOrInsertComputed"),'Map.getOrInsertComputed shim is installed');
must(source.includes("installMapCompatibility();\n if(state.pdfLib)return state.pdfLib;"),'PDF.js installs compatibility before module use');
must(built.includes("function installMapCompatibility()"),'generated readable HTML carries PDF compatibility shim');
must(built.includes("function refreshLoadedDocumentText()"),'generated readable HTML carries language refresh fix');

for(const img of ['assets/screenshot.png','assets/screenshot-en.png','assets/screenshot-mobile.png','assets/screenshot-mobile-en.png'])must(fs.statSync(path.join(root,img)).size>20_000,`${img} refreshed`);

console.log('Repository branding / PDF compatibility / language refresh checks passed.');
