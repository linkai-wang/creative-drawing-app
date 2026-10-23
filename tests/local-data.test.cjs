const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const LocalData = require('../js/local-data.js');

function storage() {
  const data = new Map(LocalData.keys.map(key => [key, 'saved record']));
  data.set('another-app', 'keep me');
  return { data, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) };
}

test('reset removes every app bucket and preserves unrelated origin storage', () => {
  const store = storage();
  assert.equal(LocalData.clear(store), true);
  assert.deepEqual([...store.data], [['another-app', 'keep me']]);
  assert.equal(LocalData.clear(store), true);
});

test('reset attempts remaining keys when one removal throws', () => {
  const store = storage();
  store.removeItem = key => {
    if (key === LocalData.keys[0]) throw new Error('blocked');
    store.data.delete(key);
  };
  assert.equal(LocalData.clear(store), false);
  assert.equal(store.data.size, 2);
  assert.equal(store.data.get('another-app'), 'keep me');
});

test('reset detects silent refusal and unreadable storage', () => {
  assert.equal(LocalData.clear({ getItem: () => 'still saved', removeItem() {} }), false);
  assert.equal(LocalData.clear({ getItem() { throw new Error('blocked'); }, removeItem() {} }), false);
});

for (const [file, calls] of [
  ['storage.js', ['saveAppState()', 'writeDrafts({})', 'persistCurrentDraft()', 'scheduleDraftSave()']],
  ['classroom.js', ['classroomPersist()']],
  ['tts.js', ['saveTtsSettings()']]
]) {
  test(file + ' refuses late writes while a reset is in progress', () => {
    let writes = 0;
    const context = vm.createContext({
      LocalData: { resetting: true },
      localStorage: { getItem: () => null, setItem() { writes++; } },
      elements: {},
      document: { getElementById: () => null },
      window: { addEventListener() {} },
      console
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
    for (const call of calls) assert.equal(vm.runInContext(call, context), false);
    assert.equal(writes, 0);
  });
}
