// Story UI, composed preview, safe fallback, optional endpoint, and HTML escaping.
// Depends on: scenes.js, state.js, scene.js, storage.js, tts.js.

    // The endpoint is public configuration; credentials stay out of source files.
    let storyAccessToken = '';
    let storyRequestId = 0;
    let storyController = null;

    /**
     * 显示指定的页面section
     * @param {string} sectionId - 要显示的section的id
     */
    function showSection(sectionId, { pushHistory = true } = {}) {
      elements.sceneSelection.classList.add('hidden');
      elements.sceneTasks.classList.add('hidden');
      elements.drawingMode.classList.add('hidden');
      elements.storyMode.classList.add('hidden');

      if (sectionId === 'storyMode') {
        // 清空旧故事内容，显示加载状态
        if (elements.storyContent) {
          elements.storyContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
              <div class="animate-spin mb-4">
                <i class="fa fa-spinner text-4xl text-primary"></i>
              </div>
              <p class="text-gray-600">AI老师正在为你编织故事...✨</p>
            </div>
          `;
        }
        elements.storyMode.classList.remove('hidden');
        if (pushHistory) history.pushState({ sectionId: 'story-mode', sceneId: appState.currentScene }, '', '#story-mode');
      }
    }

    /**
     * 获取当前场景的所有任务
     * @returns {Array} 任务数组
     */
    function getAllTasks() {
      const currentScene = scenes[appState.currentScene];
      return (currentScene && currentScene.tasks) ? currentScene.tasks : [];
    }

    /**
     * 检查是否所有任务都已完成
     * @returns {boolean} 是否全部完成
     */
    function areAllTasksCompleted() {
      const allTasks = getAllTasks();
      if (allTasks.length === 0) return false;
      
      return allTasks.every(task => 
        appState.completedTasks[appState.currentScene] && 
        appState.completedTasks[appState.currentScene][task.id]
      );
    }

    /**
     * 获取已完成和未完成的任务
     * @returns {object} { completed: [], remaining: [] }
     */
    function getTaskStatus() {
      const allTasks = getAllTasks();
      const completed = [];
      const remaining = [];
      
      allTasks.forEach(task => {
        if (appState.completedTasks[appState.currentScene] && appState.completedTasks[appState.currentScene][task.id]) {
          completed.push(task.name);
        } else {
          remaining.push(task.name);
        }
      });
      
      return { completed, remaining };
    }

    /**
     * 显示故事确认弹窗
     */
    function showStoryConfirmationModal() {
      const modal = document.getElementById('story-confirmation-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    }

    /**
     * 隐藏故事确认弹窗
     */
    function hideStoryConfirmationModal() {
      const modal = document.getElementById('story-confirmation-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    function drawImageContain(context, image, width, height) {
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    // 合成背景与当前场景已完成的绘画，生成故事页预览。
    function getCompleteArtwork() {
      return new Promise((resolve, reject) => {
        try {
          const currentScene = appState.currentScene;
          if (!currentScene || !scenes[currentScene]) {
            reject(new Error('Scene not found'));
            return;
          }

          const bgUrl = scenes[currentScene].bg;
          const displayWidth = 960;
          const displayHeight = Math.round(displayWidth / previewRatioState.current);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = displayWidth;
          tempCanvas.height = displayHeight;
          const tempCtx = tempCanvas.getContext('2d');
          const completed = appState.completedTasks[currentScene] || {};
          const completedNodes = Array.from(elements.completedElements.querySelectorAll('img'));
          const sourceWidth = elements.completedElements.clientWidth || 800;
          const sourceHeight = elements.completedElements.clientHeight || 600;
          let finished = false;

          const compose = async (backgroundImage) => {
            if (finished) return;
            finished = true;
            try {
            tempCtx.fillStyle = '#ffeaa7';
            tempCtx.fillRect(0, 0, displayWidth, displayHeight);
            if (backgroundImage) drawImageContain(tempCtx, backgroundImage, displayWidth, displayHeight);

            const overlays = await Promise.all(Object.entries(completed).map(([taskId, src], index) => new Promise(resolveOverlay => {
              const image = new Image();
              image.onload = () => resolveOverlay({ taskId, image, index });
              image.onerror = () => resolveOverlay(null);
              image.src = src;
            })));

            overlays.filter(Boolean).forEach(({ taskId, image, index }) => {
              const node = completedNodes.find(item => item.dataset.task === taskId);
              const width = node ? parseFloat(node.style.width) || 100 : 100;
              const height = node ? parseFloat(node.style.height) || 100 : 100;
              const position = getSceneElementPosition(taskId);
              const left = Math.max(0, sourceWidth - width) * position.x;
              const top = Math.max(0, sourceHeight - height) * position.y;
              tempCtx.drawImage(
                image,
                left / sourceWidth * displayWidth,
                top / sourceHeight * displayHeight,
                width / sourceWidth * displayWidth,
                height / sourceHeight * displayHeight
              );
            });

            resolve(tempCanvas.toDataURL('image/png'));
            } catch (error) {
              reject(error);
            }
          };

          if (!bgUrl) {
            compose(null);
            return;
          }

          const localFallback = (scenes[currentScene].backgrounds || [])
            .map(background => background.url)
            .find(url => typeof url === 'string' && url.startsWith('./assets/'));
          const backgroundCandidates = [...new Set([bgUrl, localFallback].filter(Boolean))];

          const loadBackground = (candidateIndex) => {
            if (finished) return;
            if (candidateIndex >= backgroundCandidates.length) {
              compose(null);
              return;
            }

            const candidate = backgroundCandidates[candidateIndex];
            const bgImage = new Image();
            let candidateSettled = false;
            let timeout;
            let resolvedUrl;
            try {
              resolvedUrl = new URL(candidate, window.location.href);
              const isRemoteHttp = /^https?:$/.test(resolvedUrl.protocol) && resolvedUrl.origin !== window.location.origin;
              if (isRemoteHttp) bgImage.crossOrigin = 'anonymous';
            } catch (error) {
              resolvedUrl = null;
            }

            const tryNextBackground = () => {
              if (candidateSettled || finished) return;
              candidateSettled = true;
              clearTimeout(timeout);
              loadBackground(candidateIndex + 1);
            };
            timeout = setTimeout(tryNextBackground, 5000);
            bgImage.onload = () => {
              if (candidateSettled || finished) return;
              candidateSettled = true;
              clearTimeout(timeout);
              compose(bgImage);
            };
            bgImage.onerror = tryNextBackground;
            bgImage.src = resolvedUrl?.href || candidate;
          };

          loadBackground(0);
        } catch (error) {
          reject(error);
        }
      });
    }


    /**
     * 捕获并显示画布内容
     * 将当前绘画转换为图片并在故事模式左侧显示
     */
    let storyPreviewRequest = 0;
    function captureAndDisplayCanvas() {
      const request = ++storyPreviewRequest;
      const sceneId = appState.currentScene;
      const preview = document.getElementById('story-canvas-preview');
      if (preview) preview.textContent = '正在加载你的艺术作品...';
      getCompleteArtwork()
        .then((completeArtwork) => {
          if (request !== storyPreviewRequest || sceneId !== appState.currentScene || elements.storyMode.classList.contains('hidden')) return;
          const previewContainer = document.getElementById('story-canvas-preview');
          if (previewContainer) {
            previewContainer.replaceChildren();
            const image = document.createElement('img');
            image.src = completeArtwork;
            image.alt = '你的完整艺术作品';
            image.className = 'w-full h-full object-contain rounded-lg shadow-md';
            previewContainer.appendChild(image);
          }
        })
        .catch((error) => {
          if (request !== storyPreviewRequest || sceneId !== appState.currentScene || elements.storyMode.classList.contains('hidden')) return;
          const previewContainer = document.getElementById('story-canvas-preview');
          if (previewContainer) {
            previewContainer.textContent = '作品预览暂时无法生成，但你的绘画进度仍然保留。';
          }
          console.warn('[Canvas Capture] Artwork preview failed:', error);
        });
    }

    /**
     * 处理进入故事模式的逻辑
     * 检查是否所有任务都完成，如果未完成则显示确认弹窗
     */
    function handleEnterStoryMode() {
      stopSpeech();
      
      if (areAllTasksCompleted()) {
        captureAndDisplayCanvas();
        showSection('storyMode');
        fetchAIStory();
      } else {
        showStoryConfirmationModal();
      }
    }


    function cancelStoryRequest() {
      storyRequestId++;
      if (storyController) storyController.abort();
      storyController = null;
    }

    function showStoryAccessForm(message = '') {
      elements.storyContent.innerHTML = `
        <form id="story-access-form" class="flex flex-col gap-3 p-4">
          <p class="text-gray-700 font-semibold">输入老师提供的故事访问码</p>
          <p class="text-gray-500 text-sm">故事根据场景和已完成任务生成。画作图片不会上传。</p>
          <label for="story-access-code" class="text-gray-700">故事访问码</label>
          <input id="story-access-code" type="password" minlength="16" maxlength="256" required
            autocomplete="off" autocapitalize="none" spellcheck="false"
            class="w-full border border-gray-300 rounded-lg p-2">
          <p id="story-access-message" class="text-gray-600 text-sm" role="status"></p>
          <button type="submit" class="btn-primary">生成故事</button>
          <p class="text-gray-500 text-sm">访问码仅在当前页面使用。请使用老师提供的访问码。</p>
        </form>`;
      document.getElementById('story-access-message').textContent = message;
      document.getElementById('story-access-form').addEventListener('submit', event => {
        event.preventDefault();
        const input = document.getElementById('story-access-code');
        const code = input.value.trim();
        if (code.length < 16 || code.length > 256) return;
        storyAccessToken = code;
        input.value = '';
        fetchAIStory();
      });
    }

    async function fetchAIStory() {
      cancelStoryRequest();
      const requestId = storyRequestId;
      const sceneId = appState.currentScene;
      const isCurrent = () => requestId === storyRequestId && sceneId === appState.currentScene &&
        !elements.storyMode.classList.contains('hidden');
      let endpoint;
      try {
        endpoint = StoryClient.resolveEndpoint(window.CREATIVE_DRAWING_CONFIG?.storyApiEndpoint, window.location);
      } catch { endpoint = null; }
      if (!endpoint) {
        elements.storyContent.textContent = '故事服务尚未连接。你的画作仍保存在这个浏览器中，请联系老师。';
        return;
      }
      if (!sceneId || !scenes[sceneId]) return;
      if (!storyAccessToken) { showStoryAccessForm(); return; }
      elements.storyContent.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6" role="status">
          <i class="fa fa-spinner fa-spin text-4xl text-primary mb-4"></i>
          <p class="text-gray-600">正在为你的绘画任务编故事……</p>
        </div>`;
      const controller = new AbortController();
      storyController = controller;
      let timedOut = false;
      // Includes a possible cold start of the hosted backend.
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
      try {
        const completed = appState.completedTasks[sceneId] || {};
        const completedTaskIds = scenes[sceneId].tasks.filter(task => completed[task.id]).map(task => task.id);
        const story = await StoryClient.generate({ endpoint, sceneId, completedTaskIds,
          accessToken: storyAccessToken, signal: controller.signal });
        if (!isCurrent()) return;
        const content = document.createElement('div');
        content.id = 'generated-story';
        content.className = 'text-gray-700 leading-relaxed text-base whitespace-pre-wrap';
        content.textContent = story;
        elements.storyContent.replaceChildren(content);
        try { speakText(story); } catch { /* Text remains readable if speech is unavailable. */ }
      } catch (error) {
        if (!isCurrent() || (controller.signal.aborted && !timedOut)) return;
        if (error.status === 401) {
          storyAccessToken = '';
          showStoryAccessForm('访问码不正确或已更新，请向老师确认后重试。');
          return;
        }
        const message = timedOut || error.status === 504 ? '这次等待有点久，请稍后重试。' :
          error.status === 429 ? '故事请求较多，请等一分钟后再试。' :
          error.status === 503 ? '故事服务暂时不可用，请稍后重试或联系老师。' :
          '故事暂时没有生成成功，请检查网络后重试。';
        const notice = document.createElement('p');
        notice.id = 'story-error';
        notice.setAttribute('role', 'status');
        notice.textContent = message;
        const retry = document.createElement('button');
        retry.id = 'retry-story';
        retry.type = 'button';
        retry.className = 'btn-primary mt-4';
        retry.textContent = '重新尝试';
        retry.addEventListener('click', fetchAIStory, { once: true });
        elements.storyContent.replaceChildren(notice, retry);
      } finally {
        clearTimeout(timer);
        if (storyController === controller) storyController = null;
      }
    }

    /**
     * HTML 转义函数，防止 XSS 攻击
     */
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

function setupStoryEntryListener() {
      window.addEventListener('pagehide', cancelStoryRequest);
      window.addEventListener('popstate', cancelStoryRequest);
      // 进入故事模式 (检查任务完成状态)
      elements.enterStory.addEventListener('click', () => { handleEnterStoryMode(); });
}

function setupStoryNavigationListeners() {
      // 返回场景任务（从故事模式）
      document.getElementById('back-from-story').addEventListener('click', () => {
        if (history.state?.sectionId === 'story-mode') {
          cancelStoryRequest();
        stopSpeech();
          history.back();
          return;
        }
        elements.sceneSelection.classList.add('hidden');
        elements.sceneTasks.classList.remove('hidden');
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        hideDrawingModeFullscreen();
        cancelStoryRequest();
        stopSpeech();
      });

      // 选择新场景（从故事模式）
      document.getElementById('choose-new-scene-story').addEventListener('click', () => {
        history.pushState({ sectionId: 'scene-selection' }, '', '#scene-selection');
        elements.sceneSelection.classList.remove('hidden');
        elements.sceneTasks.classList.add('hidden');
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        hideDrawingModeFullscreen();
        cancelStoryRequest();
        stopSpeech();
      });

      // 继续绘画（从故事模式）
      document.getElementById('replay-drawing-story').addEventListener('click', () => {
        if (history.state?.sectionId === 'story-mode') {
          cancelStoryRequest();
        stopSpeech();
          history.back();
          return;
        }
        // 停止语音
        cancelStoryRequest();
        stopSpeech();
        
        // 关闭其他界面
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        elements.sceneSelection.classList.add('hidden');
        hideDrawingModeFullscreen();
        
        // 如果有当前场景，返回到它的任务列表
        if (appState.currentScene) {
          elements.sceneTasks.classList.remove('hidden');
          // 重新渲染任务列表
          const scene = scenes[appState.currentScene];
          if (scene) {
            renderTasks(scene);
            updateProgress(scene);
          }
        } else {
          // 没有当前场景，返回场景选择
          elements.sceneTasks.classList.add('hidden');
          elements.sceneSelection.classList.remove('hidden');
        }
      });

      // 故事确认弹窗按钮
      const confirmListenBtn = document.getElementById('confirm-listen-story');
      const confirmKeepDrawingBtn = document.getElementById('confirm-keep-drawing');
      
      if (confirmListenBtn) {
        confirmListenBtn.addEventListener('click', () => {
          hideStoryConfirmationModal();
          captureAndDisplayCanvas();
          showSection('storyMode');
          fetchAIStory();
        });
      }
      
      if (confirmKeepDrawingBtn) {
        confirmKeepDrawingBtn.addEventListener('click', () => {
          hideStoryConfirmationModal();
        });
      }
}
