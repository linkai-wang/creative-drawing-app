const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');
const image = 'data:image/png;base64,aGVsbG8=';

function storage({ drafts, saved, blocked = false } = {}) {
  const data = new Map();
  if (drafts !== undefined) data.set('creative-draw-drafts:v1', typeof drafts === 'string' ? drafts : JSON.stringify(drafts));
  if (saved !== undefined) data.set('creative-draw-app:v1', JSON.stringify(saved));
  const context = vm.createContext({
    scenes: { beach: { tasks: [{ id: 'shell' }], bg: 'local.webp', backgrounds: [{ url: 'local.webp' }] } },
    appState: { currentScene: 'beach', completedTasks: {}, elementPositions: {} },
    localStorage: {
      getItem(key) { if (blocked) throw new Error('Storage unavailable'); return data.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error('Quota exceeded'); data.set(key, value); }
    },
    console: { warn() {} }
  });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), data, context };
}

test('valid drafts survive loading without changing image or timestamp', () => {
  const s = storage({ drafts: { 'beach:shell': { imageData: image, savedAt: 100 } } });
  assert.equal(s.run('loadDrafts()["beach:shell"].imageData'), image);
  assert.equal(s.run('loadDrafts()["beach:shell"].savedAt'), 100);
});

test('draft keys must identify exactly one known scene and task', () => {
  const draft = { imageData: image, savedAt: 100 };
  const s = storage({ drafts: { 'beach:shell:extra': draft, 'unknown:shell': draft, 'beach:missing': draft, 'toString:shell': draft, 'beach:shell': draft } });
  assert.equal(s.run('Object.keys(loadDrafts()).join()'), 'beach:shell');
});

test('invalid dates are repaired to finite positive timestamps', () => {
  for (const savedAt of ['Infinity', -1, 'not a date', 0]) {
    const s = storage({ drafts: { 'beach:shell': { imageData: image, savedAt } } });
    assert.equal(s.run('Number.isFinite(loadDrafts()["beach:shell"].savedAt) && loadDrafts()["beach:shell"].savedAt > 0'), true);
  }
});

test('malformed, oversized and unsupported draft data fails safely', () => {
  for (const drafts of ['{broken', '[]', 'x'.repeat(6_000_001), { 'beach:shell': { imageData: 'data:image/svg+xml;base64,abc' } }, { 'beach:shell': { imageData: image + 'a'.repeat(1_500_000) } }]) {
    assert.equal(storage({ drafts }).run('Object.keys(loadDrafts()).length'), 0);
  }
});

test('blocked storage returns failure rather than throwing', () => {
  const s = storage({ blocked: true });
  assert.equal(s.run('Object.keys(loadDrafts()).length'), 0);
  assert.equal(s.run('writeDrafts({})'), false);
  assert.equal(s.run('saveAppState()'), false);
  assert.doesNotThrow(() => s.run('loadAppState()'));
});

test('saving drafts retains the four newest and preserves their contents', () => {
  const s = storage();
  s.context.input = Object.fromEntries([1, 5, 2, 4, 3].map(n => ['draft' + n, { imageData: image, savedAt: n }]));
  assert.equal(s.run('writeDrafts(input)'), true);
  const saved = JSON.parse(s.data.get('creative-draw-drafts:v1'));
  assert.deepEqual(Object.keys(saved), ['draft5', 'draft4', 'draft3', 'draft2']);
  assert.equal(saved.draft5.imageData, image);
});

test('state restoration validates artwork, clamps positions and rejects unknown backgrounds', () => {
  const s = storage({ saved: { currentScene: 'unknown', completedTasks: { beach: { shell: image, missing: image }, unknown: { shell: image } }, elementPositions: { beach: { shell: { x: -2, y: 3 }, missing: { x: 0, y: 0 } } }, selectedBackgrounds: { beach: 'https://unknown.example/image.png' } } });
  s.run('loadAppState()');
  assert.equal(s.run('appState.currentScene'), 'beach');
  assert.equal(s.run('Object.keys(appState.completedTasks.beach).join()'), 'shell');
  assert.equal(s.run('Object.keys(appState.completedTasks).join()'), 'beach');
  assert.equal(s.run('appState.elementPositions.beach.shell.x'), 0);
  assert.equal(s.run('appState.elementPositions.beach.shell.y'), 1);
  assert.equal(s.run('scenes.beach.bg'), 'local.webp');
});
