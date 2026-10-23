const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
test('main informational footer hides in existing smartphone layouts',()=>assert.ok(source.includes("@media (max-width:720px), (max-height:560px) and (orientation:landscape) and (max-width:1000px) { body > footer { display: none; } }")));
