const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'export.js'), 'utf8');

// Test export orchestration with simulated image decoding and download APIs.
// These checks do not measure PNG rendering or browser download behavior.
function exporter({ imageData = 'data:image/webp;base64,abc', pngFails = false, clickFails = false } = {}) {
  const images = [];
  const canvases = [];
  const links = [];
  const urls = [];
  const revoked = [];
  const timers = [];
  const toasts = [];
  const attributes = new Map();
  const button = {
    innerHTML: 'Download PNG', disabled: false, listeners: {},
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
  let hidden = false;
  const context = vm.createContext({
    appState: { currentScene: 'beach', completedTasks: { beach: { shell: imageData, crab: 'data:image/png;base64,def' } } },
    artworkTaskToRedraw: { id: 'shell' },
    elements: { artworkModal: { classList: { contains: () => hidden } } },
    Image: class {
      constructor() { this.naturalWidth = 320; this.naturalHeight = 200; images.push(this); }
      set src(value) { this.loadedUrl = value; }
    },
    URL: {
      createObjectURL(blob) { urls.push(blob); return 'blob:local-artwork'; },
      revokeObjectURL: url => revoked.push(url)
    },
    document: {
      getElementById: id => id === 'artwork-download' ? button : null,
      body: { appendChild: link => { link.attached = true; } },
      createElement(name) {
        if (name === 'canvas') {
          const canvas = {
            getContext: () => ({ drawImage(image) { canvas.image = image; } }),
            toBlob(callback, type) { this.mimeType = type; callback(pngFails ? null : { type }); }
          };
          canvases.push(canvas);
          return canvas;
        }
        const link = {
          click() { if (clickFails) throw new Error('Download unavailable'); this.clicked = true; },
          remove() { this.attached = false; this.removed = true; }
        };
        links.push(link);
        return link;
      }
    },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    showToast: (...args) => toasts.push(args),
    console: { warn() {} }
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  return {
    run, context, images, canvases, links, urls, revoked, timers, toasts, button, attributes,
    close() { hidden = true; },
    decode() { images.at(-1).onload(); }
  };
}

test('the download button converts the saved artwork to PNG at its original dimensions', async () => {
  const e = exporter();
  e.run('setupArtworkExportListener()');
  const result = e.button.listeners.click();
  assert.equal(e.button.disabled, true);
  assert.equal(e.attributes.get('aria-busy'), 'true');
  assert.equal(e.images[0].loadedUrl, e.context.appState.completedTasks.beach.shell);
  e.decode();
  assert.equal(await result, true);
  assert.equal(e.canvases[0].width, 320);
  assert.equal(e.canvases[0].height, 200);
  assert.equal(e.canvases[0].mimeType, 'image/png');
  assert.equal(e.links[0].download, 'creative-drawing-beach-shell.png');
  assert.equal(e.links[0].clicked, true);
  assert.equal(e.links[0].removed, true);
  assert.equal(e.button.disabled, false);
  assert.equal(e.button.innerHTML, 'Download PNG');
  assert.equal(e.attributes.has('aria-busy'), false);
  assert.equal(e.revoked.length, 0);
  e.timers[0].callback();
  assert.deepEqual(e.revoked, ['blob:local-artwork']);
});

test('missing artwork and remote or unsupported image sources do not start a download', async () => {
  for (const imageData of [null, '', 'https://example.com/image.png', 'data:image/svg+xml;base64,abc']) {
    const e = exporter({ imageData });
    assert.equal(await e.run('downloadCompletedArtwork()'), false);
    assert.equal(e.images.length, 0);
    assert.equal(e.links.length, 0);
    assert.equal(e.toasts[0][1], 'warning');
  }
});

test('a decode failure restores the button and allows a retry', async () => {
  const e = exporter();
  const failed = e.run('downloadCompletedArtwork()');
  e.images[0].onerror();
  assert.equal(await failed, false);
  assert.equal(e.button.disabled, false);
  assert.equal(e.run('artworkExportBusy'), false);
  const retry = e.run('downloadCompletedArtwork()');
  e.decode();
  assert.equal(await retry, true);
});

test('failed PNG conversion does not claim to start a download', async () => {
  const e = exporter({ pngFails: true });
  const result = e.run('downloadCompletedArtwork()');
  e.decode();
  assert.equal(await result, false);
  assert.equal(e.links.length, 0);
  assert.equal(e.toasts.at(-1)[1], 'warning');
  assert.equal(e.button.disabled, false);
});

test('repeated clicks while preparing an export produce one download', async () => {
  const e = exporter();
  const first = e.run('downloadCompletedArtwork()');
  assert.equal(await e.run('downloadCompletedArtwork()'), false);
  assert.equal(e.images.length, 1);
  e.decode();
  assert.equal(await first, true);
  assert.equal(e.links.length, 1);
});

test('closing the dialog or switching artwork cancels a pending export', async () => {
  for (const change of ['close', 'task', 'scene', 'saved-data']) {
    const e = exporter();
    const result = e.run('downloadCompletedArtwork()');
    if (change === 'close') e.close();
    if (change === 'task') e.context.artworkTaskToRedraw = { id: 'crab' };
    if (change === 'scene') e.context.appState.currentScene = 'forest';
    if (change === 'saved-data') e.context.appState.completedTasks.beach.shell = 'data:image/png;base64,new';
    e.decode();
    assert.equal(await result, false);
    assert.equal(e.links.length, 0);
    assert.equal(e.toasts.length, 0);
    assert.equal(e.button.disabled, false);
  }
});

test('a download error cleans up its URL and restores the controls', async () => {
  const e = exporter({ clickFails: true });
  const result = e.run('downloadCompletedArtwork()');
  e.decode();
  assert.equal(await result, false);
  assert.equal(e.links[0].removed, true);
  assert.equal(e.toasts.at(-1)[1], 'warning');
  assert.equal(e.button.disabled, false);
  e.timers[0].callback();
  assert.deepEqual(e.revoked, ['blob:local-artwork']);
});

test('download filenames remove path separators and have a PNG extension', () => {
  const e = exporter();
  assert.equal(e.run('artworkDownloadFilename("../beach", "shell/../../")'), 'creative-drawing-beach-shell.png');
  assert.equal(e.run('artworkDownloadFilename("", null)'), 'creative-drawing-scene-artwork.png');
});
