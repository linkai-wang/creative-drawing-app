// Speech synthesis state, preferences, compatibility events, and cancellation.
// Depends on: state.js. User feedback uses app.js functions at interaction time.

  // ================================
  // 🗣️ Text-to-Speech (TTS) helpers
  // 使用浏览器自带 SpeechSynthesis API：Chrome / Edge 支持
  // ================================
  const tts = {
    voices: [],
    utterance: null,
    isPlaying: false,
    settings: {
      voiceName: null
    }
  };

  function isSpeechSupported() {
    return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function loadVoices() {
    tts.voices = window.speechSynthesis.getVoices() || [];
    populateVoiceList();
    return tts.voices;
  }

  function loadTtsSettings() {
    try {
      const raw = localStorage.getItem('ttsSettings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s.voiceName === 'string' && s.voiceName.length <= 200) {
          tts.settings.voiceName = s.voiceName;
        }
      }
    } catch (e) {
      console.warn('loadTtsSettings error', e);
    }
    // reflect into UI if present (only voice select now)
    const vEl = document.getElementById('tts-voice-select');
    if (vEl && tts.settings.voiceName) vEl.value = tts.settings.voiceName;
  }

  function saveTtsSettings() {
    try {
      localStorage.setItem('ttsSettings', JSON.stringify(tts.settings));
    } catch (e) {
      console.warn('saveTtsSettings error', e);
    }
  }

  function populateVoiceList() {
    const select = document.getElementById('tts-voice-select');
    if (!select) return;
    // clear
    select.innerHTML = '';
    // only keep Chinese-language voices (limit to a few)
    const zh = tts.voices.filter(v => v.lang && /zh|chi|cn/i.test(v.lang));
    let list = zh;
    if (!list || list.length === 0) {
      // fallback: try name-based match
      list = tts.voices.filter(v => v.name && /zh|china|mandarin|yue/i.test(v.name));
    }
    // if still empty, fallback to first three voices
    if (!list || list.length === 0) list = tts.voices.slice(0, 3);
    // limit to max 3 options
    list.slice(0, 3).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name || v.voiceURI || v.localService || v.lang;
      opt.textContent = `${v.name || v.lang} ${v.lang ? '('+v.lang+')' : ''}`;
      select.appendChild(opt);
    });
    // If user had a saved choice, try to select it
    if (tts.settings.voiceName) {
      const found = Array.from(select.options).find(o => o.value === tts.settings.voiceName);
      if (found) select.value = tts.settings.voiceName;
    }
  }

  // Speak text using the browser's TTS (improved with voice loading)
  function speakText(text) {
    if (!isSpeechSupported()) {
      console.warn('TTS not supported in this browser');
      return;
    }

    stopSpeech();

    // Ensure voices are loaded before speaking
    if (!tts.voices || tts.voices.length === 0) {
      loadVoices();
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = document.documentElement.lang || 'zh-CN';
    utter.volume = 1; // 0 to 1

    // base settings (fixed) with subtle jitter for naturalness
    const baseRate = 0.95;
    const basePitch = 1.05;
    const rateJitter = (Math.random() - 0.5) * 0.06; // ±3%
    const pitchJitter = (Math.random() - 0.5) * 0.04; // ±2%
    utter.rate = Math.max(0.5, Math.min(2.0, baseRate * (1 + rateJitter)));
    utter.pitch = Math.max(0.5, Math.min(2.0, basePitch * (1 + pitchJitter)));

    // choose voice by saved name or match language
    if (tts.voices && tts.voices.length > 0) {
      let chosen = null;
      if (tts.settings.voiceName) {
        chosen = tts.voices.find(v => v.name === tts.settings.voiceName || v.voiceURI === tts.settings.voiceName);
      }
      if (!chosen) {
        // prefer Chinese voices matching lang
        chosen = tts.voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
      }
      if (!chosen) chosen = tts.voices[0];
      if (chosen) utter.voice = chosen;
    }

    utter.onstart = () => {
      tts.isPlaying = true;
      togglePlayInstructionUi(true);
    };
    utter.onend = () => {
      tts.isPlaying = false;
      togglePlayInstructionUi(false);
    };
    utter.onerror = (err) => {
      if (!err || !['canceled', 'interrupted'].includes(err.error)) {
        console.warn('TTS playback failed', err);
      }
      tts.isPlaying = false;
      togglePlayInstructionUi(false);
    };

    tts.utterance = utter;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeech() {
    if (!isSpeechSupported()) return;
    window.speechSynthesis.cancel();
    tts.isPlaying = false;
    tts.utterance = null;
    togglePlayInstructionUi(false);
  }

    function toggleSpeech(textToRead) {
      if (!isSpeechSupported()) {
        if (elements.playInstruction) {
          elements.playInstruction.setAttribute('disabled', 'true');
        }
        showToast('当前浏览器暂不支持语音播放。', 'warning');
        return;
    }

    if (tts.isPlaying) {
      stopSpeech();
      return;
    }

    const text = textToRead || (elements.teacherInstructions ? elements.teacherInstructions.textContent : '');
    if (!text || text.trim().length === 0) return;
    speakText(text);
  }

  // 初始化：加载偏好、绑定控件事件、启动 voice 列表加载
  (function initTtsUi() {
    if (!isSpeechSupported()) {
      const btn = document.getElementById('play-instruction');
      if (btn) {
        btn.setAttribute('disabled', 'true');
        btn.title = '此浏览器不支持语音播放';
      }
      [elements.ttsVoiceSelect, elements.ttsSample, elements.ttsSave].forEach(control => {
        if (control) control.disabled = true;
      });
      const controls = document.getElementById('tts-controls');
      if (controls) {
        const message = document.createElement('p');
        message.className = 'text-orange-600 text-xs';
        message.textContent = '当前浏览器暂不支持语音播放。';
        controls.appendChild(message);
      }
      return;
    }

    loadTtsSettings();

    // when voices list changes
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    // try to load voices now
    loadVoices();

    // bind UI (voice select, sample, save)
    const select = document.getElementById('tts-voice-select');
    const sampleBtn = document.getElementById('tts-sample');
    const saveBtn = document.getElementById('tts-save');
    if (select) select.addEventListener('change', (e) => { tts.settings.voiceName = e.target.value; });
    if (sampleBtn) sampleBtn.addEventListener('click', () => { toggleSpeech('这是语音示例，声音是否更自然一些？'); });
    if (saveBtn) saveBtn.addEventListener('click', () => {
      saveTtsSettings();
      saveBtn.textContent = '已保存';
      showToast('语音偏好已保存', 'success');
      setTimeout(()=>saveBtn.textContent='保存偏好',1200);
    });
  })();

  function togglePlayInstructionUi(isPlaying) {
    const btn = elements.playInstruction;
    if (btn) {
      if (isPlaying) {
        btn.classList.add('bg-primary','text-white');
        btn.innerHTML = `<i class="fa fa-stop mr-2"></i> 停止讲解`;
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('bg-primary','text-white');
        btn.innerHTML = `<i class="fa fa-volume-up mr-2"></i> 听老师讲解`;
        btn.setAttribute('aria-pressed', 'false');
      }
    }
    if (elements.ttsSample) {
      elements.ttsSample.textContent = isPlaying ? '停止播放' : '示例播放';
      elements.ttsSample.setAttribute('aria-pressed', String(isPlaying));
    }
  }

function setupTtsInstructionListener() {
      // 听老师讲解（TTS）
      if (elements.playInstruction) {
        // 初始可访问性状态
        elements.playInstruction.setAttribute('aria-pressed', 'false');
        if (!isSpeechSupported()) {
          elements.playInstruction.setAttribute('disabled', 'true');
          elements.playInstruction.title = '此浏览器不支持语音播放';
        }
        elements.playInstruction.addEventListener('click', () => {
          if (isSpeechSupported()) {
            loadVoices();
            toggleSpeech();
          } else {
            showToast('当前浏览器暂不支持语音播放。', 'warning');
          }
        });
      }
}
