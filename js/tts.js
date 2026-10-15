// Browser speech synthesis, voice preferences, and playback cancellation.
// Depends on: state.js. User feedback uses app.js functions at interaction time.

const tts = {
  voices: [],
  utterance: null,
  isPlaying: false,
  requestId: 0,
  pending: null,
  voiceLoadTimer: null,
  settings: {
    voiceName: null,
    rate: 0.95
  }
};

function isSpeechSupported() {
  return 'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';
}

function normalizedVoiceLanguage(voice) {
  return (voice.lang || '').replace(/_/g, '-').toLowerCase();
}

function isChineseVoice(voice) {
  const lang = normalizedVoiceLanguage(voice);
  return /^(zh|cmn|yue)(-|$)/.test(lang) ||
    (!lang && /chinese|mandarin|中文|普通话|国语/i.test(voice.name || ''));
}

function isMandarinVoice(voice) {
  const lang = normalizedVoiceLanguage(voice);
  if (/^(yue|zh-(hk|mo))(-|$)/.test(lang)) return false;
  return isChineseVoice(voice) && !/cantonese|粤语|廣東話/i.test(voice.name || '');
}

// The API has no quality field. Use explicit quality labels in voice names;
// being a remote voice alone does not mean that it sounds more natural.
function isNaturalVoice(voice) {
  return /natural|neural|premium|enhanced|自然|神经|高品质|增强/i.test(voice.name || '');
}

function voicePreferenceScore(voice) {
  const lang = normalizedVoiceLanguage(voice);
  let score = isMandarinVoice(voice) ? 10000 : 0;
  if (isNaturalVoice(voice)) score += 1000;
  if (/^(zh-(cn|sg|hans)|cmn)(-|$)/.test(lang)) score += 100;
  if (/google.*(普通话|中文|chinese|mandarin)/i.test(voice.name || '')) score += 50;
  if (voice.default) score += 5;
  return score;
}

function voiceKey(voice) {
  return voice.voiceURI || voice.name;
}

function getChineseVoices() {
  const seen = new Set();
  return tts.voices.filter(voice => {
    const key = voiceKey(voice);
    if (!key || !isChineseVoice(voice) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => voicePreferenceScore(b) - voicePreferenceScore(a) ||
    (a.name || '').localeCompare(b.name || ''));
}

function getPreferredVoice() {
  const voices = getChineseVoices();
  const saved = tts.settings.voiceName;
  return voices.find(voice => saved && (voice.name === saved || voice.voiceURI === saved)) ||
    voices[0] || null;
}

function loadVoices() {
  if (!isSpeechSupported()) return [];
  tts.voices = window.speechSynthesis.getVoices() || [];
  populateVoiceList();
  if (tts.pending && getChineseVoices().length > 0) {
    const pending = tts.pending;
    beginSpeech(pending.text, pending.requestId);
  }
  return tts.voices;
}

function loadTtsSettings() {
  try {
    const raw = localStorage.getItem('ttsSettings');
    if (raw) {
      const settings = JSON.parse(raw);
      if (settings && typeof settings.voiceName === 'string' && settings.voiceName.length <= 200) {
        tts.settings.voiceName = settings.voiceName || null;
      }
      if (settings && typeof settings.rate === 'number' &&
          Number.isFinite(settings.rate) && settings.rate >= 0.75 && settings.rate <= 1.15) {
        tts.settings.rate = Math.round(settings.rate * 20) / 20;
      }
    }
  } catch (error) {
    console.warn('loadTtsSettings error', error);
  }
  updateRateUi();
}

function saveTtsSettings() {
  try {
    localStorage.setItem('ttsSettings', JSON.stringify(tts.settings));
    return true;
  } catch (error) {
    console.warn('saveTtsSettings error', error);
    return false;
  }
}

function updateRateUi() {
  const input = document.getElementById('tts-rate');
  const output = document.getElementById('tts-rate-value');
  if (input) input.value = String(tts.settings.rate);
  if (output) output.textContent = tts.settings.rate.toFixed(2) + ' ×';
}

function updateVoiceHint() {
  const hint = document.getElementById('tts-voice-hint');
  if (!hint) return;
  const voice = getPreferredVoice();
  if (!voice) {
    hint.textContent = '暂未检测到中文音色，播放时将尝试系统默认中文朗读。';
  } else if (tts.settings.voiceName &&
      voice.name !== tts.settings.voiceName && voice.voiceURI !== tts.settings.voiceName) {
    hint.textContent = '之前保存的音色暂不可用，当前自动使用：' + voice.name + '。';
  } else if (!isMandarinVoice(voice)) {
    hint.textContent = '当前只检测到其他中文音色；如需普通话，可换浏览器或安装普通话语音后试听。';
  } else if (isNaturalVoice(voice)) {
    hint.textContent = '当前音色：' + voice.name + '。可以先试听，再保存喜欢的声音。';
  } else if (!getChineseVoices().some(isNaturalVoice)) {
    hint.textContent = '当前使用：' + voice.name + '。未检测到标有“自然”的音色，可换浏览器或安装更多中文语音后试听。';
  } else {
    hint.textContent = '当前使用：' + voice.name + '。列表中也有自然音色，可以切换试听。';
  }
}

function populateVoiceList() {
  const select = document.getElementById('tts-voice-select');
  if (!select) return;
  select.innerHTML = '';

  const recommended = getPreferredVoice();
  const automatic = document.createElement('option');
  automatic.value = '';
  const best = getChineseVoices()[0];
  automatic.textContent = '自动推荐' + (best ? '（' + best.name + '）' : '（系统默认中文）');
  select.appendChild(automatic);

  getChineseVoices().forEach(voice => {
    const option = document.createElement('option');
    option.value = voiceKey(voice);
    option.textContent = (voice.name || voice.lang) +
      (isNaturalVoice(voice) ? ' · 自然音色' : '') +
      (voice.localService === false ? ' · 需联网' : '') +
      (voice.lang ? ' (' + voice.lang + ')' : '');
    select.appendChild(option);
  });

  // Old preferences stored the name; new ones use the stable voice URI.
  const saved = tts.settings.voiceName;
  select.value = saved && recommended &&
    (recommended.name === saved || recommended.voiceURI === saved) ? voiceKey(recommended) : '';
  updateVoiceHint();
}

function finishSpeech(utterance, requestId) {
  // A canceled utterance can dispatch events after a newer one has started.
  if (requestId !== tts.requestId || tts.utterance !== utterance) return false;
  tts.isPlaying = false;
  tts.utterance = null;
  togglePlayInstructionUi(false);
  return true;
}

function beginSpeech(text, requestId) {
  if (requestId !== tts.requestId) return;
  clearTimeout(tts.voiceLoadTimer);
  tts.voiceLoadTimer = null;
  tts.pending = null;
  loadVoices();

  const voice = getPreferredVoice();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = voice ? (voice.lang || 'zh-CN').replace(/_/g, '-') : 'zh-CN';
  if (voice) utterance.voice = voice;
  utterance.volume = 1;
  utterance.rate = tts.settings.rate;
  // Keep the voice's original timbre; random pitch changes distort some engines.
  utterance.pitch = 1;

  utterance.onstart = () => {
    if (requestId !== tts.requestId || tts.utterance !== utterance) return;
    tts.isPlaying = true;
    togglePlayInstructionUi(true);
  };
  utterance.onend = () => finishSpeech(utterance, requestId);
  utterance.onerror = event => {
    if (!finishSpeech(utterance, requestId)) return;
    if (event && ['canceled', 'interrupted'].includes(event.error)) return;
    console.warn('TTS playback failed', event);
    if (typeof showToast === 'function') {
      showToast('这个音色暂时无法播放，请检查网络或换一个声音后重试。', 'warning');
    }
  };

  tts.utterance = utterance;
  tts.isPlaying = true;
  togglePlayInstructionUi(true);
  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    utterance.onerror(error);
  }
}

function speakText(text) {
  if (!isSpeechSupported()) return;
  const content = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!content) return;

  stopSpeech();
  const requestId = tts.requestId;
  loadVoices();
  if (getChineseVoices().length > 0) {
    beginSpeech(content, requestId);
    return;
  }

  // Voices often arrive asynchronously on the first visit. Give the browser a
  // short chance to provide them before trying its language-based default.
  tts.pending = { text: content, requestId };
  tts.isPlaying = true;
  togglePlayInstructionUi(true);
  tts.voiceLoadTimer = setTimeout(() => beginSpeech(content, requestId), 1200);
}

function stopSpeech() {
  tts.requestId += 1;
  clearTimeout(tts.voiceLoadTimer);
  tts.voiceLoadTimer = null;
  tts.pending = null;
  tts.isPlaying = false;
  tts.utterance = null;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  togglePlayInstructionUi(false);
}

function toggleSpeech(textToRead) {
  if (!isSpeechSupported()) {
    if (elements.playInstruction) elements.playInstruction.disabled = true;
    showToast('当前浏览器暂不支持语音播放。', 'warning');
    return;
  }
  if (tts.isPlaying) {
    stopSpeech();
    return;
  }
  const text = textToRead || (elements.teacherInstructions ? elements.teacherInstructions.textContent : '');
  speakText(text);
}

(function initTtsUi() {
  const select = document.getElementById('tts-voice-select');
  const rate = document.getElementById('tts-rate');
  const sample = document.getElementById('tts-sample');
  const save = document.getElementById('tts-save');
  if (!isSpeechSupported()) {
    [elements.playInstruction, select, rate, sample, save].forEach(control => {
      if (control) control.disabled = true;
    });
    const hint = document.getElementById('tts-voice-hint');
    if (hint) hint.textContent = '当前浏览器暂不支持语音播放。';
    return;
  }

  loadTtsSettings();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
  loadVoices();
  window.addEventListener('pagehide', stopSpeech);

  if (select) select.addEventListener('change', event => {
    stopSpeech();
    tts.settings.voiceName = event.target.value || null;
    updateVoiceHint();
  });
  if (rate) {
    rate.addEventListener('input', event => {
      const value = Number(event.target.value);
      if (Number.isFinite(value) && value >= 0.75 && value <= 1.15) {
        tts.settings.rate = value;
        updateRateUi();
      }
    });
    rate.addEventListener('change', stopSpeech);
  }
  if (sample) sample.addEventListener('click', () => {
    toggleSpeech('小画家，你好呀！我们慢慢来。先画一个圆，再给它涂上你喜欢的颜色。');
  });
  if (save) save.addEventListener('click', () => {
    if (!saveTtsSettings()) {
      showToast('暂时无法保存语音偏好，本次选择仍然有效。', 'warning');
      return;
    }
    save.textContent = '已保存';
    showToast('声音和语速已保存', 'success');
    setTimeout(() => { save.textContent = '保存偏好'; }, 1200);
  });
})();

function togglePlayInstructionUi(isPlaying) {
  const button = elements.playInstruction;
  if (button) {
    button.classList.toggle('bg-primary', isPlaying);
    button.classList.toggle('text-white', isPlaying);
    button.innerHTML = isPlaying ?
      '<i class="fa fa-stop mr-2"></i> 停止讲解' :
      '<i class="fa fa-volume-up mr-2"></i> 听老师讲解';
    button.setAttribute('aria-pressed', String(isPlaying));
  }
  if (elements.ttsSample) {
    elements.ttsSample.textContent = isPlaying ? '停止播放' : '试听声音';
    elements.ttsSample.setAttribute('aria-pressed', String(isPlaying));
  }
}

function setupTtsInstructionListener() {
  if (!elements.playInstruction) return;
  elements.playInstruction.setAttribute('aria-pressed', 'false');
  if (!isSpeechSupported()) {
    elements.playInstruction.disabled = true;
    elements.playInstruction.title = '此浏览器不支持语音播放';
  }
  elements.playInstruction.addEventListener('click', () => toggleSpeech());
}
