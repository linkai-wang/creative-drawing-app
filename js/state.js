// Shared application state and the single DOM element cache.
// Depends on: scenes.js.

    // 应用状态
    const appState = {
      currentScene: null,
      completedTasks: {},
      elementPositions: {},
      currentTask: null,
      drawingHistory: []
    };

    // Persistence key and helpers (localStorage)

    // DOM 元素
    const elements = {
      // 场景选择和任务
      sceneSelection: document.getElementById('scene-selection'),
      sceneTasks: document.getElementById('scene-tasks'),
      
      // 场景预览
      sceneTitle: document.getElementById('scene-title'),
      sceneBg: document.getElementById('scene-bg'),
      backgroundSelector: document.getElementById('background-selector'),
      progressBar: document.getElementById('progress-bar'),
      progressText: document.getElementById('progress-text'),
      tasksContainer: document.getElementById('tasks-container'),
      completedElements: document.getElementById('completed-elements'),
      completedBadge: document.getElementById('completed-badge'),
      zoomInBtn: document.getElementById('zoom-in'),
      zoomOutBtn: document.getElementById('zoom-out'),
      toggleElementDrag: document.getElementById('toggle-element-drag'),
      
      // 绘画模式
      drawingMode: document.getElementById('drawing-mode'),
      drawingTitle: document.getElementById('drawing-title'),
      drawingCanvas: document.getElementById('drawing-canvas'),
      referenceMaterials: document.getElementById('reference-materials'),
      
      // 绘画工具
      brushSize: document.getElementById('brush-size'),
      sizeValue: document.getElementById('size-value'),
      brushBtns: document.querySelectorAll('.brush-btn'),
      brushPreview: document.getElementById('brush-preview'),
      colorBtns: document.querySelectorAll('.color-btn'),
      traceMode: document.getElementById('trace-mode'),
      freeMode: document.getElementById('free-mode'),
      traceLayer: document.getElementById('trace-layer'),
      traceImage: document.getElementById('trace-image'),
      saveDrawing: document.getElementById('save-drawing'),
      undoBtn: document.getElementById('undo-btn'),
      clearBtn: document.getElementById('clear-btn'),
      drawingStatus: document.getElementById('drawing-status'),
      
      // 成功模态框
      successModal: document.getElementById('success-modal'),
      successMessage: document.getElementById('success-message'),
      closeModal: document.getElementById('close-modal'),
      choiceModal: document.getElementById('choice-modal'),
      choiceTitle: document.getElementById('choice-title'),
      choiceMessage: document.getElementById('choice-message'),
      choiceIcon: document.getElementById('choice-icon'),
      choicePrimary: document.getElementById('choice-primary'),
      choiceSecondary: document.getElementById('choice-secondary'),
      artworkModal: document.getElementById('artwork-modal'),
      artworkTitle: document.getElementById('artwork-title'),
      artworkImage: document.getElementById('artwork-image'),
      artworkClose: document.getElementById('artwork-close'),
      artworkRedraw: document.getElementById('artwork-redraw'),
      appToast: document.getElementById('app-toast'),
      
      // 教师指导和故事模式
      teacherInstructions: document.getElementById('teacher-instructions'),
      playInstruction: document.getElementById('play-instruction'),
      enterStory: document.getElementById('enter-story-mode'),
      storyMode: document.getElementById('story-mode'),
      storyContent: document.getElementById('story-content'),
      
      // TTS 语音合成
      ttsVoiceSelect: document.getElementById('tts-voice-select'),
      ttsSample: document.getElementById('tts-sample'),
      ttsSave: document.getElementById('tts-save')
    };
    
