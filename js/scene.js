// Scene selection, background controls, tasks, progress, preview, and placed artwork.
// Depends on: scenes.js, state.js, images.js, storage.js.

    // 场景中的元素拖动状态
    let isElementDragMode = false;
    let draggedSceneElement = null;
    let dragOffsetSceneX = 0;
    let dragOffsetSceneY = 0;
    const DEFAULT_SCENE_ELEMENT_POSITION = Object.freeze({ x: 0.5, y: 0.5 });

    function getSceneElementPosition(taskId) {
      const saved = appState.elementPositions[appState.currentScene]?.[taskId];
      return saved || DEFAULT_SCENE_ELEMENT_POSITION;
    }

    function applySceneElementPosition(image, position) {
      if (!image || !position || image === draggedSceneElement) return false;
      const containerWidth = elements.completedElements.clientWidth;
      const containerHeight = elements.completedElements.clientHeight;
      if (!containerWidth || !containerHeight) return false;
      const imageWidth = image.offsetWidth || 100;
      const imageHeight = image.offsetHeight || 100;
      const x = Math.max(0, Math.min(1, Number(position.x) || 0));
      const y = Math.max(0, Math.min(1, Number(position.y) || 0));
      image.style.left = `${Math.max(0, containerWidth - imageWidth) * x}px`;
      image.style.top = `${Math.max(0, containerHeight - imageHeight) * y}px`;
      return true;
    }

    function refreshCompletedElementPositions() {
      elements.completedElements.querySelectorAll('img[data-task]').forEach(image => {
        applySceneElementPosition(image, getSceneElementPosition(image.dataset.task));
      });
    }
    // ✂️ 代码片段 3: 渲染和切换背景的函数 ✂️

// ⭐ 新增函数 1: 渲染背景选择按钮
function renderBackgroundSelector(sceneId) {
  const scene = scenes[sceneId];
  // 仅在场景数据包含 backgrounds 属性时执行
  if (!scene || !scene.backgrounds || scene.backgrounds.length === 0) return;

  const container = elements.backgroundSelector;
  if (!container) return; 

  container.innerHTML = '';
  
  // 确保 scene.bg 设置为第一个背景（如果未设置）
  if (!scene.bg && scene.backgrounds.length > 0) {
    scene.bg = scene.backgrounds[0].url;
  }
  
  // 使用场景的 backgrounds 数组来创建按钮
  scene.backgrounds.forEach((bgData) => {
    // 🔧 改进的选中检测：比较完整 URL 或 ID
    const isSelected = scene.bg === bgData.url || 
                       (elements.sceneBg && elements.sceneBg.src && elements.sceneBg.src.includes(bgData.url));
    
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.bgUrl = bgData.url;
    // 根据是否选中设置不同的样式
    button.className = `p-1 rounded-xl border-2 transition-all duration-200 focus:outline-none ${isSelected ? 'border-secondary shadow-lg scale-105' : 'border-gray-200 hover:border-primary/50'}`;
    
    button.innerHTML = `
      <img data-image-src="${bgData.thumb || bgData.url}" alt="${bgData.name}" loading="lazy" decoding="async"  class="w-24 h-14 object-contain rounded-lg bg-white" style="object-fit:contain;">
      <p class="text-xs mt-1 text-center ${isSelected ? 'text-secondary font-semibold' : 'text-gray-600'}">${bgData.name}</p>
    `;
    
    // 绑定点击事件，调用切换函数（传入 sceneId）
    button.addEventListener('click', () => {
      changeSceneBackground(sceneId, bgData.url);
    });
    container.appendChild(button);
    initializeImages(button);
  });
}

// ⭐ 新增函数 2: 切换场景背景图
function changeSceneBackground(sceneId, newBgUrl) {
  const scene = scenes[sceneId];
  if (!scene) return;

  // 1. 更新场景对象的背景
  scene.bg = newBgUrl; 

  // 2. 更新主场景背景图像元素
  if (elements.sceneBg) {
    loadImageWithFallback(
      newBgUrl,
      elements.sceneBg,
      adjustSceneBgDisplay,
      adjustSceneBgDisplay
    );
  }

  // 3. 刷新背景选择器 UI 状态，高亮选中项
  renderBackgroundSelector(sceneId);
  // persist selection
  saveAppState();
}
// ✂️ 结束粘贴 ✂️


  // ================================
  // 🔧 场景预览：保持原始比例 / 合适比例 显示
  // 说明：当加载背景图后，根据图片的 naturalWidth/naturalHeight 计算合适的容器高度
  //       并限制最大高度，防止占用过多空间
  // ================================
  function adjustSceneBgDisplay() {
    const container = document.getElementById('scene-bg-container');
    const img = document.getElementById('scene-bg');
    if (!container || !img) return;
    if (!img.complete) {
      img.addEventListener('load', adjustSceneBgDisplay, { once: true });
      return;
    }
    const maxHeight = 480; // px - limit for large screens
    const containerWidth = container.clientWidth || container.offsetWidth;
    // use forced ratio if set, otherwise use image natural ratio
    const ratioForced = previewRatioState.current;
    let newHeight;
    if (ratioForced) {
      newHeight = containerWidth / ratioForced;
    } else {
      // 防止 0 值
      const naturalWidth = img.naturalWidth || 16;
      const naturalHeight = img.naturalHeight || 9;
      const ratio = naturalHeight / naturalWidth;
      newHeight = containerWidth * ratio;
    }
    if (newHeight > maxHeight) newHeight = maxHeight;
    // 设置容器高度，保留圆角和其他样式
    container.style.height = newHeight + 'px';
    // set the image to fill the container while maintaining aspect ratio
    img.style.width = '100%';
    img.style.height = '100%';
    img.classList.add('object-contain');
    // Ensure transform origin and transition are set for smooth zooming
    img.style.transformOrigin = 'center center';
    img.style.transition = 'transform 0.18s ease';
    refreshCompletedElementPositions();
  }

  // ================================
  // 🔎 预览缩放（放大/缩小）
  // ================================
  const previewZoomState = {
    current: 1,
    min: 0.5,
    max: 2.5,
    step: 1.1
  };

  function setPreviewZoom(scale) {
    if (!elements.sceneBg) return;
    // Clamp
    const clamped = Math.max(previewZoomState.min, Math.min(previewZoomState.max, scale));
    previewZoomState.current = clamped;
    elements.sceneBg.style.transform = `scale(${clamped})`;
  }

  function zoomIn() {
    setPreviewZoom(previewZoomState.current * previewZoomState.step);
  }
  function zoomOut() {
    setPreviewZoom(previewZoomState.current / previewZoomState.step);
  }

  // 场景预览固定使用 4:3 比例
  const previewRatioState = {
    current: 4/3
  };


    function switchToScene(sceneId) {
      if (!Object.prototype.hasOwnProperty.call(scenes, sceneId)) return;
      if (!elements.drawingMode.classList.contains('hidden') && canvasHasContent) persistCurrentDraft({ silent: true });
      hideDrawingModeFullscreen();
      appState.currentScene = sceneId;
      saveAppState();
      const scene = scenes[sceneId];

      // 更新场景标题
      elements.sceneTitle.textContent = scene.name;
      
      // 🔧 Load default background if not set, or use current background
      let bgUrl = scene.bg;
      if (!bgUrl && scene.backgrounds && scene.backgrounds.length > 0) {
        bgUrl = scene.backgrounds[0].url;
        scene.bg = bgUrl; // Store as default for consistency
      }
      
      // 使用改进的图像加载器加载场景背景
      if (bgUrl) {
        loadImageWithFallback(
          bgUrl,
          elements.sceneBg,
          () => {
            // 图像加载成功后调整预览
            adjustSceneBgDisplay();
          },
          () => {
            // 占位图保持场景尺寸，不留下纯色空白。
            adjustSceneBgDisplay();
          }
        );
      }
      
      // 重置缩放
      setPreviewZoom(1);

      // 初始化完成的任务
      if (!appState.completedTasks[sceneId]) {
        appState.completedTasks[sceneId] = {};
      }

      // 清除已完成元素容器（只在切换场景时清除）
      elements.completedElements.innerHTML = '';

      // 显示场景任务界面，隐藏其他界面
      elements.sceneSelection.classList.add('hidden');
      elements.sceneTasks.classList.remove('hidden');
      elements.drawingMode.classList.add('hidden');
      elements.storyMode.classList.add('hidden');

      // 场景可见后再计算作品位置，避免隐藏容器的宽高为 0。
      renderTasks(scene);
      renderBackgroundSelector(sceneId);
      updateProgress(scene);
      adjustSceneBgDisplay();
      refreshCompletedElementPositions();

      // 🔖 Push history state for browser back button support
      history.pushState({ sectionId: 'scene-tasks', sceneId: sceneId }, '', '#scene-tasks');

      // 预加载下一个场景的图像以获得平滑过渡
      const nextSceneIndex = Object.keys(scenes).indexOf(sceneId) + 1;
      if (nextSceneIndex < Object.keys(scenes).length) {
        preloadNextSceneImages(nextSceneIndex);
      }
    }

    // 渲染任务列表
    function renderTasks(scene) {
      elements.tasksContainer.innerHTML = '';

      if (!scene.tasks || scene.tasks.length === 0) {
        elements.tasksContainer.innerHTML = `
          <div class="col-span-full text-center py-10">
            <p class="text-gray-500">该场景的绘画任务正在准备中，敬请期待！</p>
          </div>
        `;
        return;
      }

      const sceneDrafts = loadDrafts();
      const visibleTasks = typeof classroomTasksForScene === 'function' ? classroomTasksForScene(scene) : scene.tasks;
      visibleTasks.forEach(task => {
        const isCompleted = appState.completedTasks[appState.currentScene] && appState.completedTasks[appState.currentScene][task.id];
        const hasDraft = Boolean(sceneDrafts[`${appState.currentScene}:${task.id}`]);
        const isActive = appState.currentTask?.id === task.id;

        const taskCard = document.createElement('div');
        taskCard.className = `task-item ${isActive ? 'active' : ''}`;
        
        // Get first reference image as thumbnail, or use placeholder
        const thumbnail = task.references && task.references.length > 0 ? task.references[0] : '';
        
        taskCard.innerHTML = `
          ${thumbnail ? `<img data-image-src="${thumbnail}" alt="${task.name}" class="task-thumbnail" loading="lazy" decoding="async">` : '<div class="task-thumbnail" style="background: #F3F4F6;"></div>'}
          <div class="task-content">
            <div class="task-title">${task.name}</div>
            <div class="task-description">${task.description}</div>
            ${!isCompleted && hasDraft ? '<div class="text-xs font-bold text-primary mb-2"><i class="fa fa-save mr-1"></i>有未完成草稿</div>' : ''}
            <div class="task-actions">
              ${isCompleted ? `
                <button class="task-button view-artwork" type="button" data-task="${task.id}">查看作品</button>
                <button class="task-button task-button-secondary redraw-artwork" type="button" data-task="${task.id}">重新绘制</button>
              ` : `<button class="task-button start-task" type="button" data-task="${task.id}">${hasDraft ? '继续绘画' : '开始绘制'}</button>`}
            </div>
          </div>
          <div class="task-status ${isCompleted ? 'completed' : 'pending'}">
            ${isCompleted ? '<i class="fa fa-check" style="font-size: 12px;"></i>' : ''}
          </div>
        `;

        elements.tasksContainer.appendChild(taskCard);
        initializeImages(taskCard);

        const startButton = taskCard.querySelector('.start-task');
        if (startButton) startButton.addEventListener('click', () => startDrawingTask(task));
        const viewButton = taskCard.querySelector('.view-artwork');
        if (viewButton) viewButton.addEventListener('click', () => showCompletedArtwork(task));
        const redrawButton = taskCard.querySelector('.redraw-artwork');
        if (redrawButton) redrawButton.addEventListener('click', () => startDrawingTask(task, { fresh: true }));
      });
    }

    // 更新进度
    function updateProgress(scene) {
      let total = scene.tasks ? scene.tasks.length : 0;
      let completed = 0;

      if (scene.tasks) {
        scene.tasks.forEach(task => {
          if (appState.completedTasks[appState.currentScene] && appState.completedTasks[appState.currentScene][task.id]) {
            completed++;
          }
        });
      }

      const activity = typeof classroomProgress === 'function' ? classroomProgress(scene) : null;
      if (activity) { total = activity.total; completed = activity.completed; }
      const progress = total > 0 ? (completed / total) * 100 : 0;
      elements.progressBar.style.width = `${progress}%`;
      elements.progressText.textContent = `${completed}/${total} 元素`;

      if (elements.toggleElementDrag) {
        elements.toggleElementDrag.disabled = completed === 0;
        elements.toggleElementDrag.title = completed === 0 ? '完成绘画后可调整作品位置' : '拖动场景中的已完成作品';
        if (completed === 0 && isElementDragMode) {
          isElementDragMode = false;
          elements.toggleElementDrag.classList.remove('bg-accent');
          elements.toggleElementDrag.classList.add('bg-secondary');
          elements.toggleElementDrag.innerHTML = '<i class="fa fa-arrows mr-2"></i><span>调整物体位置</span>';
        }
      }

      // 更新已完成元素显示
      renderCompletedElements(scene);

      // 故事按钮始终显示（用户可随时进入故事模式）
      elements.enterStory.classList.remove('hidden');

      // 只有全部完成时显示通关标志
      if (total > 0 && completed === total) {
        elements.completedBadge.classList.remove('hidden');
      } else {
        elements.completedBadge.classList.add('hidden');
      }
    }

    // 渲染已完成的元素
    function renderCompletedElements(scene) {
      if (!appState.completedTasks[appState.currentScene]) return;

      // 检查已存在的元素，避免重复添加
      const existingElements = elements.completedElements.querySelectorAll('img');
      const existingTaskIds = new Set();
      existingElements.forEach(el => existingTaskIds.add(el.dataset.task));

      Object.keys(appState.completedTasks[appState.currentScene]).forEach((taskId, index) => {
        const task = scene.tasks.find(t => t.id === taskId);
        if (!task) return;

        // 如果已经存在，更新重画后的作品内容并保留当前位置
        if (existingTaskIds.has(taskId)) {
          const existing = Array.from(existingElements).find(item => item.dataset.task === taskId);
          if (existing && existing.dataset.imageSource !== appState.completedTasks[appState.currentScene][taskId]) {
            loadImageWithFallback(appState.completedTasks[appState.currentScene][taskId], existing);
          }
          applySceneElementPosition(existing, getSceneElementPosition(taskId));
          return;
        }

        const elementImg = document.createElement('img');
        loadImageWithFallback(appState.completedTasks[appState.currentScene][taskId], elementImg);
        elementImg.style.position = 'absolute';
        elementImg.style.width = '100px';
        elementImg.style.height = '100px';
        elementImg.style.objectFit = 'contain';
        elementImg.style.zIndex = '10';
        elementImg.style.cursor = 'grab';
        elementImg.style.touchAction = isElementDragMode ? 'none' : 'auto';
        elementImg.style.transform = 'scale(1)';
        elementImg.dataset.task = taskId;
        elementImg.alt = task.name + '作品';

        // 拖动事件
        elementImg.addEventListener(window.PointerEvent ? 'pointerdown' : 'mousedown', (e) => {
          if (isElementDragMode) {
            e.preventDefault();
            e.stopPropagation();
            draggedSceneElement = elementImg;
            const elementRect = elementImg.getBoundingClientRect();
            dragOffsetSceneX = e.clientX - elementRect.left;
            dragOffsetSceneY = e.clientY - elementRect.top;
            elementImg.style.cursor = 'grabbing';
            elementImg.style.transition = 'none';
            if (e.pointerId !== undefined && elementImg.setPointerCapture) {
              elementImg.setPointerCapture(e.pointerId);
            }
          }
        });

        elements.completedElements.appendChild(elementImg);
        applySceneElementPosition(elementImg, getSceneElementPosition(taskId));
      });
    }


    function persistSceneElementPosition(image) {
      if (!image || !appState.currentScene || !image.dataset.task) return;
      const containerWidth = elements.completedElements.clientWidth || 1;
      const containerHeight = elements.completedElements.clientHeight || 1;
      const maxLeft = Math.max(1, containerWidth - (image.offsetWidth || 100));
      const maxTop = Math.max(1, containerHeight - (image.offsetHeight || 100));
      if (!appState.elementPositions[appState.currentScene]) {
        appState.elementPositions[appState.currentScene] = {};
      }
      appState.elementPositions[appState.currentScene][image.dataset.task] = {
        x: Math.max(0, Math.min(1, (parseFloat(image.style.left) || 0) / maxLeft)),
        y: Math.max(0, Math.min(1, (parseFloat(image.style.top) || 0) / maxTop))
      };
      saveAppState();
      applySceneElementPosition(image, appState.elementPositions[appState.currentScene][image.dataset.task]);
    }

function setupSceneSelectionListeners() {
      // 场景选择
      document.querySelectorAll('.scene-card').forEach(card => {
        const sceneId = card.dataset.scene;
        if (sceneId) {
          card.addEventListener('click', () => switchToScene(sceneId));
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-label', `进入${scenes[sceneId].name}场景`);
          card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              switchToScene(sceneId);
            }
          });
        }
      });

      // 返回场景选择
      document.getElementById('back-to-scenes').addEventListener('click', () => {
        elements.sceneSelection.classList.remove('hidden');
        elements.sceneTasks.classList.add('hidden');
        elements.drawingMode.classList.add('hidden');
        hideDrawingModeFullscreen();
        elements.storyMode.classList.add('hidden');
        // 🔖 Push history state when returning to scene selection
        history.pushState({ sectionId: 'scene-selection' }, '', '#scene-selection');
      });
}

function setupScenePreviewListeners() {
      // 切换场景预览中元素的拖动模式
      if (elements.toggleElementDrag) {
        elements.toggleElementDrag.addEventListener('click', () => {
          isElementDragMode = !isElementDragMode;
          if (isElementDragMode) {
            elements.toggleElementDrag.classList.add('bg-accent');
            elements.toggleElementDrag.classList.remove('bg-secondary');
            elements.toggleElementDrag.innerHTML = '<i class="fa fa-check mr-2"></i><span>调整中...</span>';
          } else {
            elements.toggleElementDrag.classList.remove('bg-accent');
            elements.toggleElementDrag.classList.add('bg-secondary');
            elements.toggleElementDrag.innerHTML = '<i class="fa fa-arrows mr-2"></i><span>调整物体位置</span>';
            draggedSceneElement = null;
          }
          elements.completedElements.querySelectorAll('img').forEach(image => {
            image.style.touchAction = isElementDragMode ? 'none' : 'auto';
          });
        });
      }

      // 场景预览容器拖动事件
      if (elements.completedElements) {
        document.addEventListener(window.PointerEvent ? 'pointermove' : 'mousemove', (e) => {
          if (isElementDragMode && draggedSceneElement) {
            e.preventDefault();
            const containerRect = elements.completedElements.getBoundingClientRect();
            const newLeft = e.clientX - containerRect.left - dragOffsetSceneX;
            const newTop = e.clientY - containerRect.top - dragOffsetSceneY;
            
            // 限制在容器内
            const maxX = containerRect.width - 100;
            const maxY = containerRect.height - 100;
            
            draggedSceneElement.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            draggedSceneElement.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
          }
        });

        document.addEventListener(window.PointerEvent ? 'pointerup' : 'mouseup', () => {
          if (draggedSceneElement) {
            persistSceneElementPosition(draggedSceneElement);
            draggedSceneElement.style.cursor = 'grab';
            draggedSceneElement = null;
            showToast('作品位置已保存', 'success');
          }
        });
      }
}

function setupSceneZoomListeners() {
      // Bind preview zoom buttons
      if (elements.zoomInBtn) elements.zoomInBtn.addEventListener('click', () => zoomIn());
      if (elements.zoomOutBtn) elements.zoomOutBtn.addEventListener('click', () => zoomOut());
      // Double click preview resets zoom
      const previewContainer = document.getElementById('scene-preview');
      if (previewContainer) {
        previewContainer.addEventListener('dblclick', () => setPreviewZoom(1));
      }
}
