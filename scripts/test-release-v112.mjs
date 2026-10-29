import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=JSON.parse(readFileSync('app.config.json','utf8'));
const spec=readFileSync('APP_SPEC.md','utf8');
const source=readFileSync('src/index.template.html','utf8');
const changeLog=readFileSync('CHANGELOG.md','utf8');
const english=readFileSync('README.md','utf8');
const japanese=readFileSync('README.ja.md','utf8');
const notes=readFileSync('.github/releases/v1.1.2.md','utf8');
const workflow=readFileSync('.github/workflows/release-v112.yml','utf8');

assert.equal(root.version,'1.1.2');
assert.ok(spec.includes('- Version: `1.1.2`'));
assert.ok(source.includes('id="versionBadge">v1.1.2</span>'));
assert.ok(changeLog.startsWith('# Changelog\n\n## 1.1.2 - 2026-10-29'));
assert.ok(english.includes('Current release: **v1.1.2**'));
assert.ok(japanese.includes('現在のリリース：**v1.1.2**'));
assert.ok(notes.includes('Presentation Remote v1.1.2'));
assert.ok(workflow.includes('gh release create v1.1.2'));
assert.ok(workflow.includes('--target "$env:GITHUB_SHA"'));
assert.ok(workflow.includes('branches:\n      - main'));
assert.ok(workflow.includes('contents: write'));
assert.ok(workflow.includes('SHA256SUMS.txt'));
assert.ok(workflow.includes('./scripts/package-release-v112.ps1'));
const packageScript=readFileSync('scripts/package-release-v112.ps1','utf8');
assert.ok(packageScript.includes('Compress-Archive'));
assert.ok(packageScript.includes('Get-FileHash'));
assert.ok(packageScript.includes('htmlapps-presentation-remote-v1.1.2.zip'));
for(const required of ['パソコンで開いたスライドをスマホで操作','PowerPointやPDFに対応。','Nearby devices','付近のデバイス']) {
  assert.ok(source.includes(required),'Missing introduction or permission detail: '+required);
}
console.log('v1.1.2 release metadata and workflow contracts passed');
