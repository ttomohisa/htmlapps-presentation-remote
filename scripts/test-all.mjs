import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const scripts=fs.readdirSync(new URL('./',import.meta.url)).filter(name=>/^test-.*\.mjs$/.test(name)&&name!=='test-all.mjs').sort();
const failed=[];
for(const script of scripts){
 console.log(`\n=== ${script} ===`);
 const result=spawnSync(process.execPath,[`scripts/${script}`],{cwd:root,stdio:'inherit'});
 if(result.error||result.status!==0)failed.push(script);
}
if(failed.length){console.error(`\nFailed ${failed.length}/${scripts.length} suites: ${failed.join(', ')}`);process.exitCode=1}
else console.log(`\nAll ${scripts.length} regression suites passed.`);
