const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sources = ['storage.js', 'drawing.js'].map(name =>
  fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8'));

// Exercise the real drawing and storage scripts with controlled browser events.
// Canvas pixels and image loading are simulated; this is not a rendering test.
function drawing({ data = new Map(), blocked = false } = {}) {
  const timers = new Map();
  const images = [];
  const windowEvents = {};
  const documentEvents = {};
  let nextTimer = 0;
  const writes = [];
  class Element {
    constructor() {
      this.listeners = {};
      this.style = {};
      this.dataset = {};
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
      };
    }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    setAttribute() {}
    removeAttribute() {}
  }
  class Canvas extends Element {
    constructor() {
      super();
      this.width = 100;
      this.height = 100;
      this.pixels = '';
      this.parentElement = { clientWidth: 100, clientHeight: 100 };
      this.context = {
        save() {}, restore() {}, setTransform() {}, beginPath() {}, moveTo() {}, quadraticCurveTo() {},
        clearRect: () => { this.pixels = ''; },
        stroke: () => { this.pixels += 'stroke;'; },
        drawImage: source => { this.pixels = source.pixels; },
        getImageData: () => ({ data: [0, 0, 0, this.pixels ? 255 : 0] })
      };
    }
    getContext() { return this.context; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
    toDataURL(type = 'image/png') { return `data:${type};base64,${Buffer.from(this.pixels).toString('base64')}`; }
  }
  const canvas = new Canvas();
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const elements = new Proxy({ drawingCanvas: canvas, brushBtns: [], colorBtns: [] }, {
    get(target, key) { return target[key] ?? element(key); }
  });
  const document = {
    visibilityState: 'visible',
    getElementById: element,
    querySelectorAll: () => [],
    createElement: name => name === 'canvas' ? new Canvas() : new Element(),
    addEventListener: (name, handler) => { documentEvents[name] = handler; }
  };
  const window = {
    devicePixelRatio: 1,
    addEventListener: (name, handler) => { windowEvents[name] = handler; }
  };
  const appState = {
    currentScene: 'beach', currentTask: { id: 'shell' },
    completedTasks: {}, elementPositions: {}, drawingHistory: []
  };
  const context = vm.createContext({
    window, document, elements, appState,
    scenes: { beach: { tasks: [{ id: 'shell' }], bg: 'local.webp', backgrounds: [] } },
    Image: class {
      constructor() { images.push(this); }
      set src(url) { this.pixels = Buffer.from(url.split(',')[1], 'base64').toString(); }
    },
    localStorage: {
      getItem: key => data.get(key) ?? null,
      setItem(key, value) {
        if (blocked) throw new Error('Quota exceeded');
        writes.push(key);
        data.set(key, value);
      }
    },
    setTimeout: handler => { timers.set(++nextTimer, handler); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    console: { warn() {} },
    showToast() {},
    history: { state: { sectionId: 'drawing' }, back() { this.returned = true; } }
  });
  for (const source of sources) vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  run('initCanvas(false); setupDrawingPersistenceListeners()');
  function stroke({ finish = true } = {}) {
    run('startDrawing({ clientX: 10, clientY: 10 }); draw({ clientX: 30, clientY: 30 }); activePointerId = 7');
    if (finish) run('stopDrawing()');
  }
  function hidden() {
    document.visibilityState = 'hidden';
    documentEvents.visibilitychange();
  }
  function tick() {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach(handler => handler());
  }
  return { run, data, canvas, images, writes, windowEvents, documentEvents, document, context, elements, element, stroke, hidden, tick };
}

test('a finished stroke is saved by the debounced autosave', () => {
  const d = drawing();
  d.stroke();
  assert.equal(d.data.size, 0);
  d.tick();
  assert.equal(d.run('getCurrentDraft().imageData'), d.canvas.toDataURL('image/webp'));
  assert.equal(d.run('currentDrawingDirty'), false);
});

test('hiding the page saves a first stroke before pointerup', () => {
  const d = drawing();
  d.stroke({ finish: false });
  d.hidden();
  assert.equal(d.run('getCurrentDraft()?.imageData'), d.canvas.toDataURL('image/webp'));
  assert.equal(d.run('isDrawing'), false);
  assert.equal(d.run('activePointerId'), null);
  const count = d.writes.length;
  d.tick();
  assert.equal(d.writes.length, count);
});

test('leaving the page saves the newest active stroke after an earlier autosave', () => {
  const d = drawing();
  d.stroke();
  d.tick();
  const previous = d.run('getCurrentDraft().imageData');
  d.stroke({ finish: false });
  d.windowEvents.beforeunload();
  assert.notEqual(d.run('getCurrentDraft().imageData'), previous);
  assert.equal(d.run('getCurrentDraft().imageData'), d.canvas.toDataURL('image/webp'));
});

test('pagehide saves pending changes even if beforeunload is skipped', () => {
  const d = drawing();
  d.stroke();
  assert.equal(typeof d.windowEvents.pagehide, 'function');
  d.windowEvents.pagehide();
  assert.equal(d.run('getCurrentDraft().imageData'), d.canvas.toDataURL('image/webp'));
});

test('a visible page event does not interrupt drawing or write a draft', () => {
  const d = drawing();
  d.stroke({ finish: false });
  d.documentEvents.visibilitychange();
  assert.equal(d.data.size, 0);
  assert.equal(d.run('isDrawing'), true);
});

test('a draft saved on exit can be restored in a new session', () => {
  const first = drawing();
  first.stroke({ finish: false });
  first.hidden();
  const second = drawing({ data: first.data });
  second.run('restoreCanvasSnapshot(getCurrentDraft().imageData)');
  assert.equal(second.run('Boolean(pendingCanvasRestore)'), true);
  second.images.at(-1).onload();
  assert.equal(second.canvas.pixels, first.canvas.pixels);
  assert.equal(second.run('canvasHasContent'), true);
  assert.equal(second.run('pendingCanvasRestore'), null);
});

test('a delayed restore cannot repaint a cleared canvas', () => {
  const d = drawing();
  d.stroke();
  d.tick();
  d.run('restoreCanvasSnapshot(getCurrentDraft().imageData); clearCanvas()');
  d.images.at(-1).onload();
  assert.equal(d.canvas.pixels, '');
  assert.equal(d.run('canvasHasContent'), false);
  assert.equal(d.run('getCurrentDraft()'), null);
});

test('failed exit saves keep the drawing dirty and preserve the previous saved draft', () => {
  const first = drawing();
  first.stroke();
  first.tick();
  const previous = first.data.get('creative-draw-drafts:v1');
  const d = drawing({ data: first.data, blocked: true });
  d.stroke({ finish: false });
  d.hidden();
  assert.equal(d.run('currentDrawingDirty'), true);
  assert.equal(d.data.get('creative-draw-drafts:v1'), previous);
  assert.notEqual(d.canvas.pixels, '');
});
