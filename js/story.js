// Story UI, composed preview, safe fallback, optional endpoint, and HTML escaping.
// Depends on: scenes.js, state.js, scene.js, storage.js, tts.js.

    // GitHub Pages 不能安全保存模型密钥；如需启用，请配置一个服务端代理地址。
    const STORY_API_ENDPOINT = null;

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

    /**
     * 通过可选的服务端代理生成儿童故事
     */
    async function fetchAIStory() {
      if (!STORY_API_ENDPOINT) {
        elements.storyContent.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full p-6">
            <div class="text-center">
              <i class="fa fa-exclamation-circle text-4xl text-orange-400 mb-4"></i>
              <p class="text-gray-700 font-semibold">AI 故事功能暂未配置，但你的绘画作品已经保存。</p>
              <p class="text-gray-500 text-sm mt-2">静态页面不能安全保存模型密钥。若需启用故事生成，请由开发者配置服务端代理地址。</p>
            </div>
          </div>
        `;
        return;
      }
      // 验证全局状态
      if (!appState.currentScene) {
        console.error('Error: currentScene not set');
        if (elements.storyContent) {
          elements.storyContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full p-6">
              <div class="text-center">
                <i class="fa fa-exclamation-circle text-4xl text-orange-400 mb-4"></i>
                <p class="text-gray-700 font-semibold">场景信息缺失，无法生成故事</p>
              </div>
            </div>
          `;
        }
        return;
      }

      try {
        // 1. 显示加载动画
        elements.storyContent.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full">
            <div class="animate-spin mb-4">
              <i class="fa fa-spinner text-4xl text-primary"></i>
            </div>
            <p class="text-gray-600">AI艺术导师正在欣赏你的杰作...✨</p>
          </div>
        `;

        // 2. 收集数据
        const sceneName = scenes[appState.currentScene]?.name || "未知场景";
        const taskStatus = getTaskStatus();
        const completedTasks = taskStatus.completed;
        const remainingTasks = taskStatus.remaining;
        
        // 3. 构建提示词 - 采用"艺术评论家"视角，强调视觉细节
        let userPrompt = `你是一位在孩子身旁欣赏他们绘画的艺术导师和故事讲述者。请根据以下情景，用温暖、充满想象力的语言，编写一个150-180字的故事：

**情景：**
孩子正在${sceneName}创作一幅美丽的杰作。他们已经用笔和颜色绘制完成了：${completedTasks.length > 0 ? completedTasks.join('、') : '一些绝妙的构想'}

**创作要求 - 你必须这样做：**

1. **站在画边欣赏**：直接用第二人称对孩子说话，就像站在他身旁一起看着这幅画。开头可以这样："宝宝，来看看你创作的魔幻世界！"

2. **具体赞美艺术选择**：请赞美孩子的：
   - 色彩运用（例如："我喜欢你用的那些温暖/清爽的色调！")
   - 线条和形状（例如："你的曲线/图形太优美了！")
   - 布局和构图（例如："你的布局很有创意，元素搭配得很好！")
   具体指出画面中的1-2个具体元素，展示你真的在"看"他的画。

3. **描述元素的互动**：让画中的元素活动起来。例如：
   - 如果画了贝壳和海浪，说："你画的贝壳在海浪里闪闪发光，好像在期待朋友的到来..."
   - 强调已完成的元素如何在${sceneName}中相互作用、玩耍或相遇
   - 让他们生动起来，但保持故事的连贯性

4. **鼓励未完成的创意**：`;

        if (remainingTasks.length > 0) {
          userPrompt += `
   说出这样的话："故事还没完呢！我们还需要你的魔法之笔来画${remainingTasks.join('、')}，这样${sceneName}的世界才会真正完整！每一笔都会让这个故事更闪闪发亮！"`;
        } else {
          userPrompt += `
   说出这样的话："你已经创作完成了！这个${sceneName}的世界现在完整而绚丽，充满了你的想象力！"`;
        }

        userPrompt += `

5. **故事基调**：
   - 像一位看着孩子画作的亲切朋友，充满对他创意的真诚赞美
   - 既是艺术欣赏者，又是故事讲述者
   - 充满温情、鼓励和想象力
   - 适合幼儿园和小学低年级小朋友

**重要：你的故事应该让孩子感到 ✨他们的每一笔都被看见、被欣赏、被赞美✨**`;

        const systemPrompt = "你是一位富有热情和专业眼光的儿童艺术导师。你站在孩子身旁欣赏他们的绘画，并能够：1)具体指出画面中的元素和色彩，表明你真的在认真看他的作品；2)将画中的元素变成生动的故事场景，让它们相互作用；3)用温暖而真诚的语言赞美孩子的艺术选择；4)同时鼓励孩子继续创作。你的回应充满想象力但不失真诚，让孩子感到被看见和被肯定。";

        // 4. 请求服务端代理；密钥只应保存在服务端
        const response = await fetch(STORY_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 300
          })
        });

        // 5. 处理响应
        if (!response.ok) {
          throw new Error(`API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('API响应格式不正确');
        }
        
        const story = data.choices[0].message.content || "故事生成失败，请重试。";
        
        if (!story || story.trim().length === 0) {
          throw new Error('API返回空故事');
        }

        // 6. 将故事内容注入页面
        elements.storyContent.innerHTML = `
          <div class="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
            ${escapeHtml(story)}
          </div>
        `;

        // 7. 朗读故事（异步播放，不阻塞UI）
        try {
          speakText(story);
        } catch (ttsError) {
          console.warn('TTS播放失败:', ttsError);
          // 不中断流程，仅作警告
        }

      } catch (error) {
        console.error('故事生成错误:', error);
        
        // 显示友好的错误提示
        elements.storyContent.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full p-6">
            <div class="text-center">
              <i class="fa fa-frown-o text-4xl text-orange-400 mb-4"></i>
              <p class="text-gray-700 font-semibold mb-2">哎呀！故事生成遇到了问题</p>
              <p class="text-gray-500 text-sm mb-4">
                ${error.message.includes('401') || error.message.includes('API') 
                  ? '请检查 API Key 是否正确配置。'
                  : '网络连接可能有问题，请稍后重试。'}
              </p>
              <button id="retry-story" type="button" class="btn-primary mt-4">
                <i class="fa fa-refresh mr-2"></i>重新尝试
              </button>
            </div>
          </div>
        `;
        const retryButton = document.getElementById('retry-story');
        if (retryButton) retryButton.addEventListener('click', fetchAIStory, { once: true });
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
      // 进入故事模式 (检查任务完成状态)
      elements.enterStory.addEventListener('click', () => { handleEnterStoryMode(); });
}

function setupStoryNavigationListeners() {
      // 返回场景任务（从故事模式）
      document.getElementById('back-from-story').addEventListener('click', () => {
        if (history.state?.sectionId === 'story-mode') {
          stopSpeech();
          history.back();
          return;
        }
        elements.sceneSelection.classList.add('hidden');
        elements.sceneTasks.classList.remove('hidden');
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        hideDrawingModeFullscreen();
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
        stopSpeech();
      });

      // 继续绘画（从故事模式）
      document.getElementById('replay-drawing-story').addEventListener('click', () => {
        if (history.state?.sectionId === 'story-mode') {
          stopSpeech();
          history.back();
          return;
        }
        // 停止语音
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
