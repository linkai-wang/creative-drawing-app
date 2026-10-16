const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'icons.css'), 'utf8');

test('interface icons load from local CSS without a font or stylesheet CDN', () => {
  assert.ok(html.includes('href="./css/icons.css"'));
  assert.ok(!html.includes('font-awesome'));
  assert.ok(!/@font-face|@import|https?:\/\//.test(css.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));
  assert.ok(css.includes('mask: var(--app-icon)'));
});

test('every icon referenced by the application has a local SVG definition', () => {
  const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js'));
  const sources = [html, ...jsFiles.map(name => fs.readFileSync(path.join(root, 'js', name), 'utf8'))].join('\n');
  const classes = new Set(sources.match(/\bfa-[a-z][a-z-]+\b/g));
  classes.delete('fa-spin');
  for (const name of classes) assert.ok(css.includes('.' + name + ' { --app-icon:'), name);
});
