// Application-level UI helpers, one-time listener registration, history, and startup.
// Loaded last after every feature script.

    let toastTimer = null;

    let choicePrimaryAction = null;
    let choiceSecondaryAction = null;

    function showToast(message, tone = 'info') {
      if (!elements.appToast || !message) return;
      clearTimeout(toastTimer);
      const tones = {
        info: 'bg-gray-900',
        success: 'bg-emerald-600',
        warning: 'bg-orange-500'
      };
      elements.appToast.classList.remove('bg-gray-900', 'bg-emerald-600', 'bg-orange-500', 'toast-hidden');
      elements.appToast.classList.add(tones[tone] || tones.info, 'toast-visible');
      elements.appToast.textContent = message;
      toastTimer = setTimeout(() => {
        elements.appToast.classList.remove('toast-visible');
        elements.appToast.classList.add('toast-hidden');
      }, 2400);
    }


    function closeChoiceModal(runSecondary = false) {
      if (elements.choiceModal) elements.choiceModal.classList.add('hidden');
      const action = runSecondary ? choiceSecondaryAction : null;
      choicePrimaryAction = null;
      choiceSecondaryAction = null;
      if (typeof action === 'function') action();
    }

    function openChoiceModal({ title, message, primaryLabel = '确定', secondaryLabel = '取消', icon = 'fa-question', danger = false, onPrimary, onSecondary }) {
      if (!elements.choiceModal) return;
      elements.choiceTitle.textContent = title;
      elements.choiceMessage.textContent = message;
      elements.choicePrimary.textContent = primaryLabel;
      elements.choiceSecondary.textContent = secondaryLabel;
      elements.choiceIcon.className = `fa ${icon} text-2xl ${danger ? 'text-red-500' : 'text-primary'}`;
      elements.choicePrimary.style.backgroundColor = danger ? '#EF4444' : '';
      choicePrimaryAction = typeof onPrimary === 'function' ? onPrimary : null;
      choiceSecondaryAction = typeof onSecondary === 'function' ? onSecondary : null;
      elements.choiceModal.classList.remove('hidden');
      requestAnimationFrame(() => elements.choicePrimary.focus());
    }

    // 事件监听 - 已修复画笔和颜色选择问题

    // Fixed DOM listeners are registered exactly once from this coordinator.
    function setupEventListeners() {
      setupSceneSelectionListeners();
      setupDrawingEventListeners();
      setupArtworkExportListener();

      // 关闭弹窗
      elements.closeModal.addEventListener('click', () => {
        elements.successModal.classList.add('hidden');
        if (history.state?.sectionId === 'drawing') {
          history.back();
          return;
        }
        elements.sceneSelection.classList.add('hidden');
        elements.sceneTasks.classList.remove('hidden');
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        // 同步移除全屏样式（以防在全屏绘画情况下关闭弹窗）
        hideDrawingModeFullscreen();
      });

      setupStoryEntryListener();
      setupScenePreviewListeners();
      setupStoryNavigationListeners();
      setupTtsInstructionListener();
      setupDrawingPersistenceListeners();

      // 窗口大小变化时重新设置画布和预览图高度（考虑内容保留）
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          handleCanvasResize();
          adjustSceneBgDisplay();
        }, 150);
      });

      // 设备方向变化时也更新（用于移动设备旋转）
      window.addEventListener('orientationchange', () => {
        // 延迟以等待 DOM 更新完成
        setTimeout(() => {
          handleCanvasResize();
          adjustSceneBgDisplay();
        }, 100);
      });

      setupSceneZoomListeners();

      // 🔙 Handle browser back/forward button (popstate event)
      window.addEventListener('popstate', (event) => {
        if (!elements.drawingMode.classList.contains('hidden') && canvasHasContent) {
          persistCurrentDraft({ silent: true });
        }
        // Extract section info from the history state
        {
          const { sectionId = 'scene-selection', sceneId } = event.state || {};
          
          // Hide all sections first
          elements.sceneSelection.classList.add('hidden');
          elements.sceneTasks.classList.add('hidden');
          elements.drawingMode.classList.add('hidden');
          elements.storyMode.classList.add('hidden');
          hideDrawingModeFullscreen();
          
          // Show the requested section
          if (sectionId === 'scene-selection') {
            elements.sceneSelection.classList.remove('hidden');
          } else if ((sectionId === 'scene-tasks' || sectionId === 'story-mode') && Object.prototype.hasOwnProperty.call(scenes, sceneId)) {
            // When returning to scene-tasks, restore the scene state
            appState.currentScene = sceneId;
            const scene = scenes[sceneId];
            if (scene) {
              // 先显示场景，再渲染依赖容器尺寸的已完成作品。
              elements.sceneTasks.classList.remove('hidden');
              // Restore UI without pushing new history state
              elements.sceneTitle.textContent = scene.name;
              loadImageWithFallback(
                scene.bg,
                elements.sceneBg,
                () => adjustSceneBgDisplay(),
                () => adjustSceneBgDisplay()
              );
              setPreviewZoom(1);
              if (!appState.completedTasks[sceneId]) {
                appState.completedTasks[sceneId] = {};
              }
              elements.completedElements.innerHTML = '';
              renderTasks(scene);
              renderBackgroundSelector(sceneId);
              updateProgress(scene);
              adjustSceneBgDisplay();
              refreshCompletedElementPositions();
            }
            if (sectionId === 'story-mode') {
              captureAndDisplayCanvas();
              showSection('storyMode', { pushHistory: false });
              fetchAIStory();
            }
          } else if (sectionId === 'drawing' && Object.prototype.hasOwnProperty.call(scenes, sceneId) && event.state.taskId) {
            appState.currentScene = sceneId;
            const task = scenes[sceneId]?.tasks?.find(item => item.id === event.state.taskId);
            if (task) startDrawingTask(task, { pushHistory: false });
            else elements.sceneSelection.classList.remove('hidden');
          } else {
            elements.sceneSelection.classList.remove('hidden');
          }
        }
      });
    }

    // 初始化应用
    function initApp() {
      setupEventListeners();
      setupLocalDataReset();
      initializeImages();
      // Load persisted app state (selected scene, completed tasks)
      loadAppState();
      setupClassroom();
      // Ensure initial UI state: only show scene selection
      if (elements.sceneSelection) elements.sceneSelection.classList.remove('hidden');
      if (elements.sceneTasks) elements.sceneTasks.classList.add('hidden');
      if (elements.drawingMode) elements.drawingMode.classList.add('hidden');
      if (elements.storyMode) elements.storyMode.classList.add('hidden');
      
      // 初始化当前历史项，避免刷新后多出一个无法正确还原的空历史项。
      history.replaceState({ sectionId: 'scene-selection' }, '', '#scene-selection');
      
      // initial preview zoom
      setPreviewZoom(1);
      // 默认比例为 4:3，已在 previewRatioState.current 中设置
      adjustSceneBgDisplay();
      // preload TTS voices when supported
      if (isSpeechSupported()) {
        loadVoices();
      }
      // 初始化画笔预览和设置
      try { updateBrushPreview(); } catch (e) {}
      try { if (ctx) applyBrushSettings(); } catch(e) {}
      updateCanvasActionButtons();
      if (scenes && Object.keys(scenes).length > 0) {
        preloadNextSceneImages(0);
        if (Object.keys(scenes).length > 1) {
          preloadNextSceneImages(1);
        }
      }

    }

    // 启动应用
    initApp();
