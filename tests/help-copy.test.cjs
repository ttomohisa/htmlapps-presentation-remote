const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "本文をスクロールして最後まで読めます。見出しと「閉じる」は表示されたままです。",
  "Scroll within the Help body to read to the end. The heading and Close button stay visible. "
];
for (const file of ["src/index.template.html", "presentation-remote.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
