import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=JSON.parse(readFileSync('app.config.json','utf8'));
const version=app.version,tag=`v${version}`;
const spec=readFileSync('APP_SPEC.md','utf8');
const source=readFileSync('src/index.template.html','utf8');
const changeLog=readFileSync('CHANGELOG.md','utf8');
const en=readFileSync('README.md','utf8');
const ja=readFileSync('README.ja.md','utf8');
const notes=readFileSync(`.github/releases/${tag}.md`,'utf8');
const workflow=readFileSync('.github/workflows/release.yml','utf8');
const guard=readFileSync('scripts/verify-release-state.ps1','utf8');
const packager=readFileSync('scripts/package-release.ps1','utf8');
const ci=readFileSync('.github/workflows/build-standalone.yml','utf8');

assert.match(version,/^\d+\.\d+\.\d+$/);
assert.ok(spec.includes(`- Version: \`${version}\``));
assert.ok(source.includes(`id="versionBadge">${tag}</span>`));
assert.ok(changeLog.startsWith(`# Changelog\n\n## ${version} - `));
assert.ok(en.includes(`Current release: **${tag}**`));
assert.ok(ja.includes(`現在のリリース：**${tag}**`));
assert.ok(notes.includes(`Presentation Remote ${tag}`));
assert.ok(workflow.includes("branches:\n      - main"));
assert.ok(workflow.includes("contents: write"));
assert.ok(workflow.includes('scripts/verify-release-state.ps1'));
assert.ok(workflow.includes('scripts/package-release.ps1'));
assert.ok(workflow.includes('gh release create "$tag"'));
assert.ok(workflow.includes('--target "$env:GITHUB_SHA"'));
assert.ok(workflow.includes('SHA256SUMS.txt'));
assert.ok(guard.includes('if ($DryRun)'));
assert.ok(guard.includes('$tag = "v$version"'));
assert.ok(guard.includes('releases?per_page=100'));
assert.ok(guard.includes('git/refs/tags?per_page=100'));
assert.ok(packager.includes('Compress-Archive'));
assert.ok(packager.includes('Get-FileHash'));
assert.ok(packager.includes('"htmlapps-presentation-remote-v$version.zip"'));
assert.ok(ci.includes('scripts/package-release.ps1'));
assert.ok(ci.includes('scripts/verify-release-state.ps1'));
assert.ok(!workflow.includes('v1.1.2'));
for(const required of ['パソコンで開いたスライドをスマホで操作','PowerPointやPDFに対応。','Nearby devices','付近のデバイス']) {
  assert.ok(source.includes(required),'Missing introduction or permission detail: '+required);
}
console.log('Version-independent release metadata and workflow checks passed.');
