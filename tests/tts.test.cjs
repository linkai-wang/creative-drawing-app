const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'tts.js'), 'utf8');

function voice(name, lang = 'zh-CN', extra = {}) {
  return { name, lang, voiceURI: 'voice:' + name, localService: true, ...extra };
}

function browser({ voices = [], settings = null, supported = true, storageFails = false, speakFails = false } = {}) {
  class Element {
    constructor() {
      this.value = '';
      this.textContent = '';
      this.options = [];
      this.listeners = {};
      this.attributes = {};
      this.disabled = false;
      this.classList = { toggle() {} };
    }
    set innerHTML(value) { this.options = []; this.html = value; }
    get innerHTML() { return this.html; }
    appendChild(child) { this.options.push(child); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    emit(name, value) {
      if (value !== undefined) this.value = String(value);
      for (const listener of this.listeners[name] || []) listener({ target: this });
    }
  }
  const ids = ['play-instruction', 'tts-voice-select', 'tts-rate', 'tts-rate-value',
    'tts-sample', 'tts-save', 'tts-voice-hint', 'teacher-instructions'];
  const controls = Object.fromEntries(ids.map(id => [id, new Element()]));
  controls['teacher-instructions'].textContent = '先画一个圆，再涂上你喜欢的颜色。';
  const timers = new Map();
  let timerId = 0;
  let saved = settings ? JSON.stringify(settings) : null;
  const events = {};
  const pageEvents = {};
  const toasts = [];
  const synth = {
    voices,
    spoken: [],
    canceled: 0,
    getVoices() { return this.voices; },
    addEventListener(name, callback) { events[name] = callback; },
    cancel() { this.canceled++; },
    speak(utterance) {
      if (speakFails) throw new Error('engine unavailable');
      this.spoken.push(utterance);
    }
  };
  const window = { addEventListener(name, callback) { pageEvents[name] = callback; } };
  if (supported) {
    window.speechSynthesis = synth;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  }
  const context = vm.createContext({
    window,
    document: { getElementById: id => controls[id] || null, createElement: () => new Element() },
    elements: { playInstruction: controls['play-instruction'], ttsSample: controls['tts-sample'],
      teacherInstructions: controls['teacher-instructions'] },
    localStorage: {
      getItem() { return saved; },
      setItem(key, value) { if (storageFails) throw new Error('storage blocked'); saved = value; }
    },
    showToast: (...args) => toasts.push(args),
    console: { warn() {} },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(source, context);
  vm.runInContext('setupTtsInstructionListener()', context);
  return {
    controls, synth, toasts, pageEvents,
    click(id = 'play-instruction') { controls[id].emit('click'); },
    say(text) { vm.runInContext('speakText(' + JSON.stringify(text) + ')', context); },
    voicesChanged(list) { synth.voices = list; events.voiceschanged(); },
    flushTimers() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach(callback => callback());
    },
    saved() { return JSON.parse(saved); }
  };
}

test('auto selection finds a natural Mandarin voice beyond the first three voices', () => {
  const natural = voice('Mandarin Natural', 'zh-CN', { localService: false });
  const voices = [voice('Basic A'), voice('Basic B'), voice('Basic C'), voice('Basic D'),
    natural, voice('Cantonese Natural', 'zh-HK'), voice('English Natural', 'en-US')];
  const app = browser({ voices });
  app.click();
  assert.equal(app.synth.spoken[0].voice, natural);
  assert.equal(app.controls['tts-voice-select'].options.length, 7);
  assert.ok(app.controls['tts-voice-select'].options.some(option =>
    option.value === natural.voiceURI && option.textContent.includes('需联网')));
});

test('speech uses the voice language, stable original pitch, and a measured default pace', () => {
  const chosen = voice('Mandarin Natural', 'zh_CN');
  const app = browser({ voices: [chosen] });
  app.click();
  const utterance = app.synth.spoken[0];
  assert.equal(utterance.lang, 'zh-CN');
  assert.equal(utterance.pitch, 1);
  assert.equal(utterance.rate, 0.95);
  assert.equal(utterance.text, app.controls['teacher-instructions'].textContent);
});

test('a saved name from the old app remains selected ahead of automatic recommendations', () => {
  const saved = voice('My chosen voice');
  const app = browser({ voices: [saved, voice('Other Natural')], settings: { voiceName: saved.name } });
  assert.equal(app.controls['tts-voice-select'].value, saved.voiceURI);
  app.click();
  assert.equal(app.synth.spoken[0].voice, saved);
});

test('a selected voice URI and pace survive save and a new visit', () => {
  const chosen = voice('My voice');
  const voices = [chosen, voice('Natural')];
  const app = browser({ voices });
  app.controls['tts-voice-select'].emit('change', chosen.voiceURI);
  app.controls['tts-rate'].emit('input', '0.8');
  app.click('tts-save');
  const again = browser({ voices, settings: app.saved() });
  again.click();
  assert.equal(again.synth.spoken[0].voice, chosen);
  assert.equal(again.synth.spoken[0].rate, 0.8);
  assert.equal(again.controls['tts-rate-value'].textContent, '0.80 ×');
});

test('an unavailable saved voice falls back and is restored when it becomes available', () => {
  const saved = voice('Saved voice');
  const natural = voice('Natural');
  const app = browser({ voices: [natural], settings: { voiceName: saved.name } });
  app.click();
  assert.equal(app.synth.spoken[0].voice, natural);
  assert.match(app.controls['tts-voice-hint'].textContent, /暂不可用/);
  app.voicesChanged([natural, saved]);
  app.say('下一条讲解');
  assert.equal(app.synth.spoken[1].voice, saved);
});

test('a first click waits for asynchronous voices and speaks only once', () => {
  const app = browser();
  app.click();
  assert.equal(app.synth.spoken.length, 0);
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'true');
  const natural = voice('Late Natural');
  app.voicesChanged([natural]);
  app.flushTimers();
  assert.equal(app.synth.spoken.length, 1);
  assert.equal(app.synth.spoken[0].voice, natural);
});

test('stopping during voice loading prevents deferred playback', () => {
  const app = browser();
  app.click();
  app.click();
  app.voicesChanged([voice('Late Natural')]);
  app.flushTimers();
  assert.equal(app.synth.spoken.length, 0);
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'false');
});

test('without a Chinese voice, the fallback requests Chinese instead of choosing an English voice', () => {
  const app = browser({ voices: [voice('English', 'en-US')] });
  app.click();
  app.flushTimers();
  assert.equal(app.synth.spoken[0].voice, undefined);
  assert.equal(app.synth.spoken[0].lang, 'zh-CN');
  assert.equal(app.controls['tts-voice-select'].options.length, 1);
});

test('late end and error events from canceled speech do not stop newer speech', () => {
  const app = browser({ voices: [voice('Natural')] });
  app.say('第一段');
  const old = app.synth.spoken[0];
  app.say('第二段');
  old.onend();
  old.onerror({ error: 'interrupted' });
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'true');
  app.synth.spoken[1].onend();
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'false');
  assert.equal(app.toasts.length, 0);
});

test('switching voices stops playback and the next preview uses the new selection', () => {
  const other = voice('Other');
  const app = browser({ voices: [voice('Natural'), other] });
  app.click();
  app.controls['tts-voice-select'].emit('change', other.voiceURI);
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'false');
  app.click('tts-sample');
  assert.equal(app.synth.spoken[1].voice, other);
  assert.match(app.synth.spoken[1].text, /小画家/);
});

test('failed speech resets playback controls and gives feedback', () => {
  const app = browser({ voices: [voice('Natural')], speakFails: true });
  app.click();
  assert.equal(app.controls['play-instruction'].attributes['aria-pressed'], 'false');
  assert.equal(app.toasts.length, 1);
  assert.equal(app.toasts[0][1], 'warning');
});

test('an unsupported browser disables every speech control', () => {
  const app = browser({ supported: false });
  for (const id of ['play-instruction', 'tts-voice-select', 'tts-rate', 'tts-sample', 'tts-save']) {
    assert.equal(app.controls[id].disabled, true, id);
  }
});

test('blocked preference storage does not claim the settings were saved', () => {
  const app = browser({ voices: [voice('Natural')], storageFails: true });
  app.click('tts-save');
  assert.equal(app.toasts[0][1], 'warning');
  assert.notEqual(app.controls['tts-save'].textContent, '已保存');
});

test('invalid saved rate is ignored, while the chosen voice remains usable', () => {
  const selected = voice('Chosen');
  const app = browser({ voices: [selected], settings: { voiceName: selected.name, rate: 50 } });
  app.click();
  assert.equal(app.synth.spoken[0].rate, 0.95);
});

test('duplicate voices are hidden and a named Mandarin voice without a language still works', () => {
  const selected = voice('Mandarin Natural', '');
  const app = browser({ voices: [selected, selected] });
  assert.equal(app.controls['tts-voice-select'].options.length, 2);
  app.click();
  assert.equal(app.synth.spoken[0].lang, 'zh-CN');
});

test('leaving the page cancels pending speech', () => {
  const app = browser();
  app.click();
  app.pageEvents.pagehide();
  app.voicesChanged([voice('Late Natural')]);
  app.flushTimers();
  assert.equal(app.synth.spoken.length, 0);
});

test('blank text does not cancel current narration and longer narration is preserved', () => {
  const app = browser({ voices: [voice('Natural')] });
  const story = '小画家发现了一只小螃蟹。'.repeat(50);
  app.say(story);
  const canceled = app.synth.canceled;
  app.say('  ');
  assert.equal(app.synth.canceled, canceled);
  assert.equal(app.synth.spoken[0].text, story);
});
