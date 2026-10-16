// Canvas lifecycle, drawing tools, history, trace image, upload, and task completion.
// High-risk drawing state remains together in this classic script.
// Depends on: scenes.js, state.js, images.js, storage.js, scene.js.

    // 当前画笔类型与位置记录
    let currentBrush = 'fineliner';
    let lastPaintColor = '#EF4444';
    let lastX = 0, lastY = 0;
    let canvasHasContent = false;
    let drawingSession = 0;
    let canvasRestoreVersion = 0;
    let pendingCanvasRestore = null;
    let canvasResizePending = false;
    let activePointerId = null;
    let uploadReadVersion = 0;
    let currentDrawingDirty = false;
    let draftSaveTimer = null;

    let isSavingDrawing = false;
    let currentTraceSource = null;
    let artworkTaskToRedraw = null;

    function setDrawingStatus(message, state = '') {
      if (!elements.drawingStatus) return;
      elements.drawingStatus.classList.remove('saved', 'completed');
      if (state) elements.drawingStatus.classList.add(state);
      const icon = state === 'saved' || state === 'completed' ? 'fa-check-circle' : 'fa-pencil';
      elements.drawingStatus.innerHTML = `<i class="fa ${icon}"></i><span>${message}</span>`;
    }


    // 画布上下文
    let ctx;
    let isDrawing = false;
    let currentColor = '#EF4444';
    let currentSize = 3;
    let isEraser = false;
    
    const PENCIL_COLOR = '#4A4A4A';

    function clearCanvasPixels() {
      const canvas = elements.drawingCanvas;
      const activeContext = ctx || (canvas && canvas.getContext('2d'));
      if (!canvas || !activeContext) return;

      activeContext.save();
      activeContext.setTransform(1, 0, 0, 1, 0, 0);
      activeContext.globalAlpha = 1;
      activeContext.globalCompositeOperation = 'source-over';
      activeContext.clearRect(0, 0, canvas.width, canvas.height);
      activeContext.restore();
    }

    function restoreCanvasSnapshot(dataUrl, onRestored) {
      if (!ctx || !dataUrl || !dataUrl.startsWith('data:image')) return;
      const canvas = elements.drawingCanvas;
      // Clear、换任务或后来的恢复请求使旧异步回调失效。
      const version = ++canvasRestoreVersion;
      pendingCanvasRestore = { dataUrl };
      updateCanvasActionButtons();
      const img = new Image();
      img.onload = () => {
        if (version !== canvasRestoreVersion) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        pendingCanvasRestore = null;
        canvasHasContent = canvasContainsDrawing();
        applyBrushSettings();
        if (onRestored) onRestored();
        updateCanvasActionButtons();
        if (canvasResizePending) {
          canvasResizePending = false;
          handleCanvasResize();
        }
      };
      img.onerror = () => {
        if (version !== canvasRestoreVersion) return;
        pendingCanvasRestore = null;
        canvasHasContent = canvasContainsDrawing();
        updateCanvasActionButtons();
        showToast('这份绘画草稿无法读取，请重新绘画。', 'warning');
      };
      img.src = dataUrl;
    }

    function cancelCanvasRestore() {
      canvasRestoreVersion++;
      pendingCanvasRestore = null;
      canvasResizePending = false;
    }

    function canvasContainsDrawing() {
      if (!ctx) return false;
      const canvas = elements.drawingCanvas;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) return true;
      }
      return false;
    }

    function updateCanvasActionButtons() {
      const canUndo = appState.drawingHistory.length > 1 && !pendingCanvasRestore;
      elements.undoBtn.disabled = !canUndo;
      elements.undoBtn.title = canUndo ? '撤销上一笔' : '暂无可撤销内容';
      elements.clearBtn.disabled = !canvasHasContent;
      elements.clearBtn.title = canvasHasContent ? '清空画布' : '画布当前为空';
      if (!isSavingDrawing) {
        elements.saveDrawing.disabled = !canvasHasContent || Boolean(pendingCanvasRestore);
        elements.saveDrawing.title = canvasHasContent ? '完成并保存绘画' : '先画几笔再完成作品';
      }
    }

    // 初始化画布。新任务不保留旧内容；尺寸变化时按当前比例恢复。
    function initCanvas(preserveContent = true) {
      const canvas = elements.drawingCanvas;
      const container = canvas.parentElement;

      if (preserveContent && pendingCanvasRestore) {
        canvasResizePending = true;
        return false;
      }
      let previousCanvas = null;
      if (preserveContent && canvas.width > 0 && canvas.height > 0) {
        // 同步复制，避免连续 resize 把尚未恢复的空白当成最新作品。
        previousCanvas = document.createElement('canvas');
        previousCanvas.width = canvas.width;
        previousCanvas.height = canvas.height;
        previousCanvas.getContext('2d').drawImage(canvas, 0, 0);
      }
      if (!preserveContent) cancelCanvasRestore();

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.round(container.clientWidth || 0);
      const displayHeight = Math.round(container.clientHeight || 0);
      if (displayWidth < 1 || displayHeight < 1) return false;

      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.width = Math.max(1, Math.round(displayWidth * dpr));
      canvas.height = Math.max(1, Math.round(displayHeight * dpr));

      ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;

      if (previousCanvas) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(previousCanvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        clearCanvasPixels();
        appState.drawingHistory = [];
        canvasHasContent = false;
        saveState();
      }
      applyBrushSettings();
      updateCanvasActionButtons();
      return true;
    }

    // 确保有画布上下文（如果没有则初始化）
    function ensureCanvasCtx() {
      if (!ctx && elements.drawingCanvas) {
        initCanvas();
      }
    }

    // 根据当前画笔类型应用绘制参数
    function applyBrushSettings() {
      if (!ctx) return;
      
      // 如果是橡皮模式，设置特殊的合成操作和笔触参数
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';  // 真正的擦除，不留任何痕迹
        ctx.strokeStyle = 'rgba(0,0,0,1)';  // 黑色（用于 destination-out 生效）
        ctx.globalAlpha = 1;  // 完全不透明擦除
        ctx.lineWidth = Math.max(2, currentSize);  // 应用笔触大小
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        return;  // 橡皮模式下不再应用其他笔刷设置
      }
      
      // 恢复默认合成模式，除非特殊笔刷会覆盖
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      switch (currentBrush) {
        case 'fineliner':
          ctx.lineWidth = Math.max(1, Math.round(currentSize * 0.6));
          ctx.globalAlpha = 1;
          ctx.lineCap = 'round';
          break;
        case 'crayon':
          ctx.lineWidth = Math.max(1, Math.round(currentSize * 1.6));
          ctx.globalAlpha = 0.95;
          ctx.lineCap = 'round';
          // 轻微阴影模拟蜡笔质感
          ctx.shadowBlur = 1;
          ctx.shadowColor = currentColor;
          break;
        case 'watercolor':
          ctx.lineWidth = Math.max(1, Math.round(currentSize * 1.3));
          ctx.globalAlpha = 0.28;
          ctx.lineCap = 'round';
          // 叠加混合产生更强烈的水彩混色效果
          ctx.globalCompositeOperation = 'lighten';
          break;
        case 'brushstroke':
          // 毛笔：极宽笔划，模拟毛笔的宽度，线接处圆润
          ctx.lineWidth = Math.max(3, Math.round(currentSize * 2.2));
          ctx.globalAlpha = 0.85;
          ctx.lineCap = 'butt';
          ctx.lineJoin = 'round';
          break;
        case 'spray':
          // 喷枪：宽度适中，中等不透明，屏幕混合产生喷射效果
          ctx.lineWidth = Math.max(2, Math.round(currentSize * 1.5));
          ctx.globalAlpha = 0.22;
          ctx.lineCap = 'round';
          ctx.globalCompositeOperation = 'screen';
          break;
        case 'oilpaint':
          // 油画：厚重宽笔划，叠加混合产生油画混色效果
          ctx.lineWidth = Math.max(2, Math.round(currentSize * 2));
          ctx.globalAlpha = 0.72;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'multiply';
          break;
        case 'pencil':
        default:
          ctx.lineWidth = currentSize;
          ctx.globalAlpha = 0.9;
          ctx.lineCap = 'round';
          break;
      }

      // 设置颜色
      ctx.strokeStyle = currentColor;
    }

    // 更新画笔预览小画布
    function updateBrushPreview() {
      const pv = elements.brushPreview;
      if (!pv) return;
      const pctx = pv.getContext('2d');
      pctx.clearRect(0, 0, pv.width, pv.height);
      // 临时设置基于当前画笔的属性
      const prevSize = currentSize;
      const prevBrush = currentBrush;

      // 微调以适配预览画布
      const previewSize = Math.max(1, Math.round((currentSize / 20) * 12)) + 1;
      pctx.lineCap = 'round';
      pctx.strokeStyle = currentColor;

      switch (currentBrush) {
        case 'fineliner':
          pctx.lineWidth = Math.max(1, Math.round(previewSize * 0.7));
          pctx.globalAlpha = 1;
          break;
        case 'crayon':
          pctx.lineWidth = Math.max(1, Math.round(previewSize * 1.3));
          pctx.globalAlpha = 0.95;
          break;
        case 'watercolor':
          pctx.lineWidth = Math.max(1, Math.round(previewSize * 1.3));
          pctx.globalAlpha = 0.28;
          break;
        case 'brushstroke':
          pctx.lineWidth = Math.max(2, Math.round(previewSize * 2.2));
          pctx.globalAlpha = 0.85;
          pctx.lineCap = 'butt';
          break;
        case 'spray':
          pctx.lineWidth = Math.max(2, Math.round(previewSize * 1.5));
          pctx.globalAlpha = 0.22;
          break;
        case 'oilpaint':
          pctx.lineWidth = Math.max(2, Math.round(previewSize * 2));
          pctx.globalAlpha = 0.72;
          break;
        case 'pencil':
        default:
          pctx.lineWidth = Math.max(1, previewSize);
          pctx.globalAlpha = 0.9;
          break;
      }

      // 画一条示例线
      pctx.beginPath();
      pctx.moveTo(6, pv.height / 2);
      pctx.lineTo(pv.width - 6, pv.height / 2);
      pctx.stroke();

      // 恢复（只对外部变量）
      currentSize = prevSize;
      currentBrush = prevBrush;
    }

    // 🎯 橡皮光标预览：更新可见性和大小
    function updateEraserCursorPreview() {
      const preview = document.getElementById('eraser-cursor-preview');
      if (!preview) return;
      
      // 仅在橡皮工具激活时显示预览
      if (isEraser) {
        preview.classList.add('visible');
        // 橡皮大小应与 currentSize 匹配（直径 = currentSize * 2）
        const diameter = Math.max(2, currentSize) * 2;
        preview.style.width = diameter + 'px';
        preview.style.height = diameter + 'px';
      } else {
        preview.classList.remove('visible');
      }
    }

    // 🎯 橡皮光标预览：跟随鼠标位置
    function updateEraserCursorPosition(clientX, clientY) {
      const preview = document.getElementById('eraser-cursor-preview');
      if (!preview || !preview.classList.contains('visible')) return;
      
      const diameter = Math.max(2, currentSize) * 2;
      const radius = diameter / 2;
      
      // 将光标圆形中心放在鼠标指针处
      preview.style.left = (clientX - radius) + 'px';
      preview.style.top = (clientY - radius) + 'px';
    }

    // 🎯 笔刷光标预览：判断是否应显示笔刷预览（当笔刷工具激活时）
    function isBrushToolActive() {
      return !isEraser && currentBrush !== undefined;
    }

    // 🎯 笔刷光标预览：获取笔刷预览颜色
    function getBrushPreviewColor() {
      // 铅笔工具使用固定的铅笔色，不受颜色选择器影响
      if (currentBrush === 'pencil') {
        return PENCIL_COLOR;
      }
      // 其他笔刷工具使用当前选择的颜色
      return currentColor;
    }

    // 🎯 笔刷光标预览：更新可见性、大小和颜色
    function updateBrushCursorPreview() {
      const preview = document.getElementById('brush-cursor-preview');
      if (!preview) return;
      
      // 仅在笔刷工具激活时显示预览
      if (isBrushToolActive()) {
        preview.classList.add('visible');
        
        // 笔刷大小应与 currentSize 匹配（直径 = currentSize * 2）
        const diameter = Math.max(2, currentSize) * 2;
        preview.style.width = diameter + 'px';
        preview.style.height = diameter + 'px';
        
        // 获取笔刷预览颜色
        const brushColor = getBrushPreviewColor();
        
        // 设置预览颜色：半透明填充 + 半透明边框
        preview.style.backgroundColor = brushColor + '4D';  // 30% 透明度
        preview.style.border = '2px solid ' + brushColor + '80';  // 50% 透明度
      } else {
        preview.classList.remove('visible');
      }
    }

    // 🎯 笔刷光标预览：跟随鼠标位置
    function updateBrushCursorPosition(clientX, clientY) {
      const preview = document.getElementById('brush-cursor-preview');
      if (!preview || !preview.classList.contains('visible')) return;
      
      const diameter = Math.max(2, currentSize) * 2;
      const radius = diameter / 2;
      
      // 将光标圆形中心放在鼠标指针处
      preview.style.left = (clientX - radius) + 'px';
      preview.style.top = (clientY - radius) + 'px';
    }

    // 清除画布，但保留参考图和用户当前选择的画笔设置
    function clearCanvas({ removeDraft = true } = {}) {
      cancelCanvasRestore();
      clearTimeout(draftSaveTimer);
      isDrawing = false;
      activePointerId = null;
      appState.drawingHistory = [];
      clearCanvasPixels();
      if (ctx) applyBrushSettings();
      canvasHasContent = false;
      currentDrawingDirty = false;
      saveState();
      if (removeDraft) deleteCurrentDraft();
      setDrawingStatus('画布已清空');
      updateCanvasActionButtons();
    }

    // 保存当前画布状态
    function saveState() {
      if (!elements.drawingCanvas) return;
      let snapshot;
      try {
        snapshot = elements.drawingCanvas.toDataURL('image/png');
      } catch (error) {
        console.warn('[Canvas] Failed to save undo state', error);
        return;
      }
      if (!snapshot.startsWith('data:image')) return;
      canvasHasContent = canvasContainsDrawing();
      if (appState.drawingHistory[appState.drawingHistory.length - 1] === snapshot) {
        updateCanvasActionButtons();
        return;
      }
      appState.drawingHistory.push(snapshot);
      if (appState.drawingHistory.length > 20) {
        appState.drawingHistory.shift();
      }
      updateCanvasActionButtons();
    }

    // 撤销操作
    function undoDrawing() {
      if (!ctx || pendingCanvasRestore) return;
      clearTimeout(draftSaveTimer);
      isDrawing = false;
      activePointerId = null;
      if (appState.drawingHistory.length > 1) {
        if (typeof classroomCount === 'function') classroomCount('undos');
        appState.drawingHistory.pop();
        restoreCanvasSnapshot(appState.drawingHistory[appState.drawingHistory.length - 1], () => {
          updateCanvasActionButtons();
          scheduleDraftSave();
        });
      }
    }


    // 获取鼠标在画布上的相对位置（考虑设备像素比）
    function getMousePos(e) {
      const canvas = elements.drawingCanvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left) * (canvas.width / dpr) / (rect.width || 1);
      const y = (e.clientY - rect.top) * (canvas.height / dpr) / (rect.height || 1);
      return { x, y };
    }

    // 处理画布调整大小并保留绘图内容
    function handleCanvasResize() {
      if (!elements.drawingCanvas) return;
      
      // 检查画布是否在绘画模式中（不在绘画模式时不需要保留内容）
      const inDrawingMode = !elements.drawingMode.classList.contains('hidden');
      if (!inDrawingMode) return;

      stopDrawing();
      initCanvas();
    }

    // 绘制开始
    function startDrawing(e) {
      ensureCanvasCtx();
      if (!ctx || pendingCanvasRestore || elements.drawingMode.classList.contains('hidden')) return;
      isDrawing = true;
      if (typeof classroomStrokeStart === 'function') classroomStrokeStart();
      
      // 获取鼠标在画布上的位置
      const pos = getMousePos(e);
      const x = pos.x;
      const y = pos.y;

      // 记录起点并应用笔刷设置
      lastX = x; lastY = y;
      
      // 设置线条样式以消除锯齿
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // 为普通笔刷、铅笔、细线笔等开始持久路径
      if (!['spray', 'watercolor', 'crayon', 'oilpaint', 'brushstroke'].includes(currentBrush) || isEraser) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
      
      applyBrushSettings();
    }

    // 绘制中
    function draw(e) {
      if (!ctx) return;
      if (!isDrawing) return;

      // 获取鼠标在画布上的位置
      const pos = getMousePos(e);
      const x = pos.x;
      const y = pos.y;

      // 根据当前笔刷设置绘制
      applyBrushSettings();

      // 计算中点以实现平滑线条（二次贝塞尔曲线）
      const midX = (lastX + x) / 2;
      const midY = (lastY + y) / 2;

      // 笔刷效果系统：不同笔刷类型有独特的视觉效果
      // - 普通笔刷、铅笔、细线笔：使用持久路径和二次贝塞尔曲线
      // - 蜡笔：颗粒感与深浅变化
      // - 水彩：扩散与混色效果  
      // - 毛笔：纤维边缘质感
      // - 喷枪：随机散布粒子
      // - 油画：厚重笔触不规则性
      // - 橡皮：擦除模式

      // 对于普通笔刷、铅笔、细线笔等 - 使用持久路径
      if (!['spray', 'watercolor', 'crayon', 'oilpaint', 'brushstroke'].includes(currentBrush)) {
        // 控制点是上一个位置，终点是中点
        // 这样可以在单一持久路径中绘制平滑的二次贝塞尔曲线
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();
      }
      
      // 对于蜡笔做更丰富的颗粒与深浅变化以模拟真实蜡笔质感
      else if (currentBrush === 'crayon' && !isEraser) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy) || 1;
        const steps = Math.max(1, Math.floor(dist / 2));
        
        // 在路径上散布许多短小笔触，产生不同深度与密度的颗粒效果
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const ix = lastX + dx * t + (Math.random() - 0.5) * 3.5;
          const iy = lastY + dy * t + (Math.random() - 0.5) * 3.5;
          ctx.beginPath();
          // 产生深浅变化：部分笔触更深（高不透明度），部分更浅（低不透明度）
          const alphaVariation = Math.random();
          if (alphaVariation < 0.3) {
            // 30% 的概率：更深的颗粒（高不透明度）
            ctx.globalAlpha = 0.35 + Math.random() * 0.35;
          } else if (alphaVariation < 0.6) {
            // 30% 的概率：中等深度
            ctx.globalAlpha = 0.15 + Math.random() * 0.25;
          } else {
            // 40% 的概率：较浅的颗粒（低不透明度）
            ctx.globalAlpha = 0.05 + Math.random() * 0.15;
          }
          ctx.lineWidth = Math.max(2, currentSize * (1.2 + Math.random() * 1.3));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(ix, iy);
          const jx = ix + (Math.random() - 0.5) * 4.5;
          const jy = iy + (Math.random() - 0.5) * 4.5;
          ctx.lineTo(jx, jy);
          ctx.stroke();
        }
        // 主笔划：使用二次贝塞尔曲线实现平滑，消除锯齿
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = Math.max(2, Math.round(currentSize * 1.5));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();
      }

      // 水彩效果：在笔迹周围渐进式扩散，模拟真实水彩渗透
      else if (currentBrush === 'watercolor' && !isEraser) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy) || 1;
        const waterSteps = Math.max(2, Math.floor(dist / 2.5));
        
        // 绘制多层递减透明的扩散效果
        for (let w = 0; w < waterSteps; w++) {
          const t = w / waterSteps;
          const wx = lastX + dx * t;
          const wy = lastY + dy * t;
          
          // 第一层：模糊扩散圈（最淡）
          ctx.beginPath();
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = currentColor;
          ctx.arc(wx, wy, currentSize * 1.8, 0, Math.PI * 2);
          ctx.fill();
          
          // 第二层：次要扩散圈（中等）
          ctx.beginPath();
          ctx.globalAlpha = 0.12;
          ctx.arc(wx, wy, currentSize * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // 主笔划使用二次贝塞尔曲线实现平滑，消除锯齿
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = Math.max(1, Math.round(currentSize * 1.3));
        ctx.strokeStyle = currentColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();
      }

      // 毛笔效果：宽笔划 + 毛发边缘（保持整条线一致）
      else if (currentBrush === 'brushstroke' && !isEraser) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy) || 1;
        
        // 固定的笔刷参数（整条线保持一致）
        const finalWidth = Math.max(2, currentSize * 2.2);
        const inkAlpha = 0.8;  // 固定的墨色强度
        
        // 主笔划：使用二次贝塞尔曲线实现平滑，消除锯齿
        ctx.beginPath();
        ctx.globalAlpha = inkAlpha;
        ctx.lineWidth = finalWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor;
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();
        
        // 毛发边缘效果
        const steps = Math.max(4, Math.floor(dist / 2));
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const px = lastX + dx * t;
          const py = lastY + dy * t;
          const fiberCount = 5;  // 固定纤维数量
          
          for (let f = 0; f < fiberCount; f++) {
            const angle = Math.random() * Math.PI * 2;
            const length = finalWidth * (0.3 + Math.random() * 0.5);
            const offsetDist = finalWidth * 0.4 + Math.random() * finalWidth * 0.3;
            
            const fx = px + Math.cos(angle) * offsetDist;
            const fy = py + Math.sin(angle) * offsetDist;
            
            ctx.beginPath();
            ctx.globalAlpha = 0.2 + Math.random() * 0.25;  // 固定的纤维透明度
            ctx.lineWidth = Math.max(0.3, currentSize * 0.3);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = currentColor;
            ctx.moveTo(fx, fy);
            ctx.lineTo(
              fx + Math.cos(angle) * length,
              fy + Math.sin(angle) * length
            );
            ctx.stroke();
          }
        }
      }

      // 喷枪效果：在路径周围随机分散粒子
      else if (currentBrush === 'spray' && !isEraser) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy) || 1;
        // 每移动一定距离喷射粒子
        const sprayDots = Math.max(3, Math.floor(dist / 1.5));
        for (let i = 0; i < sprayDots; i++) {
          // 随机在路径周围散布粒子
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * currentSize * 1.2;
          const px = lastX + dx * (i / sprayDots) + Math.cos(angle) * radius;
          const py = lastY + dy * (i / sprayDots) + Math.sin(angle) * radius;
          ctx.beginPath();
          ctx.globalAlpha = 0.15 + Math.random() * 0.25;
          ctx.fillStyle = currentColor;
          ctx.arc(px, py, Math.max(0.5, Math.random() * currentSize * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        // 主线轨迹使用二次贝塞尔曲线实现平滑，消除锯齿
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = Math.max(1, Math.round(currentSize * 1.2));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();
      }

      // 油画效果：厚重笔触，带有微小的不规则性
      else if (currentBrush === 'oilpaint' && !isEraser) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy) || 1;
        const steps = Math.max(1, Math.floor(dist / 3));
        // 绘制多条偏移线以产生笔触质感
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const ox = (Math.random() - 0.5) * 2.5;
          const oy = (Math.random() - 0.5) * 2.5;
          ctx.beginPath();
          ctx.globalAlpha = 0.65 + Math.random() * 0.15;
          ctx.lineWidth = Math.max(2, currentSize * (1.8 + Math.random() * 0.4));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // 使用二次贝塞尔曲线实现平滑，消除锯齿
          ctx.moveTo(lastX + ox, lastY + oy);
          ctx.quadraticCurveTo(lastX + ox, lastY + oy, midX + ox, midY + oy);
          ctx.stroke();
        }
        // 恢复主笔划设置
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = Math.max(2, Math.round(currentSize * 2));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      // 更新最后一个位置用于下一次绘制调用
      lastX = x; 
      lastY = y;
    }

    // 绘制结束
    function stopDrawing() {
      if (!ctx || !isDrawing) return;
      if (typeof classroomStrokeEnd === 'function') classroomStrokeEnd();
      isDrawing = false;
      canvasHasContent = true;
      saveState();
      updateCanvasActionButtons();
      scheduleDraftSave();
    }

    // 切换场景

    function setTraceMode(enabled) {
      if (enabled && !currentTraceSource) {
        showToast('请先选择或上传一张参考图片。', 'warning');
        return false;
      }
      elements.traceMode.classList.toggle('is-active', enabled);
      elements.freeMode.classList.toggle('is-active', !enabled);
      elements.traceMode.classList.toggle('bg-gray-200', !enabled);
      elements.traceMode.classList.toggle('hover:bg-gray-300', !enabled);
      elements.freeMode.classList.toggle('bg-gray-200', enabled);
      elements.freeMode.classList.toggle('hover:bg-gray-300', enabled);
      elements.traceMode.setAttribute('aria-pressed', String(enabled));
      elements.freeMode.setAttribute('aria-pressed', String(!enabled));
      elements.traceLayer.classList.toggle('hidden', !enabled);
      return true;
    }

    function activateTraceSource(source, message = '已开启描摹模式') {
      if (!source) {
        showToast('请先选择或上传一张参考图片。', 'warning');
        return;
      }
      currentTraceSource = source;
      elements.traceLayer.style.background = '';
      setTraceMode(true);
      loadImageWithFallback(source, elements.traceImage,
        () => showToast(message, 'success'),
        () => showToast('参考图片加载失败，请换一张图片。', 'warning')
      );
    }

    function showCompletedArtwork(task) {
      const dataUrl = appState.completedTasks[appState.currentScene]?.[task.id];
      if (!dataUrl) {
        showToast('暂时找不到这幅作品。', 'warning');
        return;
      }
      artworkTaskToRedraw = task;
      elements.artworkTitle.textContent = `${task.name} · 已完成`;
      loadImageWithFallback(dataUrl, elements.artworkImage);
      elements.artworkModal.classList.remove('hidden');
      requestAnimationFrame(() => elements.artworkClose.focus());
    }

    // 开始绘画任务（进入独立全屏绘画界面）
    function startDrawingTask(task, { fresh = false, pushHistory = true } = {}) {
      if (!task || !scenes[appState.currentScene]?.tasks?.some(item => item.id === task.id)) return;
      const session = ++drawingSession;
      clearTimeout(draftSaveTimer);
      cancelCanvasRestore();
      closeChoiceModal();
      stopSpeech();
      isDrawing = false;
      activePointerId = null;
      appState.currentTask = task;
      appState.drawingHistory = [];
      canvasHasContent = false;
      updateCanvasActionButtons();
      currentDrawingDirty = false;
      if (fresh) deleteCurrentDraft();

      // 更新绘画界面
      elements.drawingTitle.textContent = `画一个${task.name}`;
      elements.teacherInstructions.textContent = task.instruction;
      if (typeof classroomOnTaskStart === 'function') classroomOnTaskStart(task);

      // 渲染参考素材（去重并动态调整网格）
      elements.referenceMaterials.innerHTML = '';
      
      // 去重：只保留唯一的参考图片
      const uniqueReferences = Array.from(new Set(task.references || []));
      currentTraceSource = uniqueReferences[0] || null;
      
      // 根据图片数量动态设置网格列数
      let gridClass = 'grid gap-2';
      if (uniqueReferences.length === 1) {
        gridClass += ' grid-cols-1';
      } else if (uniqueReferences.length === 2) {
        gridClass += ' grid-cols-2';
      } else {
        gridClass += ' grid-cols-3';
      }
      elements.referenceMaterials.className = gridClass;
      
      // 每张参考图独立加载，某一张失败不影响其他参考图。
      uniqueReferences.forEach((ref, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reference-image-button';
        button.setAttribute('aria-label', task.name + '参考图 ' + (index + 1));
        const img = document.createElement('img');
        img.alt = task.name + '参考图 ' + (index + 1);
        button.appendChild(img);
        elements.referenceMaterials.appendChild(button);
        loadImageWithFallback(ref, img);
        button.addEventListener('click', () => {
          if (img.dataset.imageState !== 'loaded') {
            showToast(img.dataset.imageState === 'loading' ? '参考图片正在加载，请稍候。' : '这张参考图片暂时不可用，请选择其他图片。', 'warning');
            return;
          }
          activateTraceSource(ref, '已选择参考图片并开启描摹');
        });
      });

      // 显示绘画界面（全屏），隐藏其他界面
      elements.sceneSelection.classList.add('hidden');
      elements.sceneTasks.classList.add('hidden');
      // make drawing-mode a fullscreen overlay
      elements.drawingMode.classList.remove('hidden');
      elements.drawingMode.classList.add('fixed','inset-0','z-50','bg-white','overflow-auto');
      elements.storyMode.classList.add('hidden');

      setTraceMode(false);
      elements.traceLayer.style.background = '';
      cancelImageLoad(elements.traceImage);
      elements.traceImage.removeAttribute('src');
      delete elements.traceImage.dataset.imageState;
      setDrawingStatus('准备绘画');
      requestAnimationFrame(() => {
        if (session !== drawingSession || elements.drawingMode.classList.contains('hidden')) return;
        if (!initCanvas(false)) return;
        const draft = fresh ? null : getCurrentDraft();
        if (!draft) {
          updateCanvasActionButtons();
          return;
        }
        openChoiceModal({
          title: '发现上次的绘画草稿',
          message: `要继续上次未完成的${task.name}吗？`,
          primaryLabel: '继续上次绘画',
          secondaryLabel: '重新开始',
          icon: 'fa-history',
          onPrimary: () => {
            if (session !== drawingSession) return;
            restoreCanvasSnapshot(draft.imageData, () => {
              appState.drawingHistory = [];
              currentDrawingDirty = false;
              saveState();
              updateCanvasActionButtons();
              setDrawingStatus('已恢复上次绘画', 'saved');
              showToast('已恢复上次未完成的绘画', 'success');
            });
          },
          onSecondary: () => {
            if (session !== drawingSession) return;
            deleteCurrentDraft();
            clearCanvas({ removeDraft: false });
            setDrawingStatus('准备绘画');
          }
        });
      });
      if (pushHistory) {
        history.pushState({ sectionId: 'drawing', sceneId: appState.currentScene, taskId: task.id }, '', '#drawing');
      }
    }

    // 离开绘画：同时终止旧任务的恢复、上传和自动保存回调。
    function hideDrawingModeFullscreen() {
      flushDrawingDraft();
      elements.drawingMode.classList.remove('fixed','inset-0','z-50','bg-white','overflow-auto');
      drawingSession++;
      clearTimeout(draftSaveTimer);
      cancelCanvasRestore();
      cancelImageLoad(elements.traceImage);
      closeChoiceModal();
      elements.successModal.classList.add('hidden');
      elements.artworkModal.classList.add('hidden');
      hideStoryConfirmationModal();
      stopSpeech();
      isDrawing = false;
      activePointerId = null;
      appState.currentTask = null;
      currentTraceSource = null;
      currentDrawingDirty = false;
      document.getElementById('upload-trace').value = '';
    }

    function createPersistedDrawingSnapshot(maxDimension = 320, quality = 0.85) {
      const source = elements.drawingCanvas;
      if (!source || source.width < 1 || source.height < 1) return null;

      const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = Math.max(1, Math.round(source.width * scale));
      snapshotCanvas.height = Math.max(1, Math.round(source.height * scale));
      const snapshotContext = snapshotCanvas.getContext('2d');
      snapshotContext.drawImage(source, 0, 0, snapshotCanvas.width, snapshotCanvas.height);

      const webp = snapshotCanvas.toDataURL('image/webp', quality);
      return webp.startsWith('data:image/webp') ? webp : snapshotCanvas.toDataURL('image/png');
    }

    // 保存绘画作品
    function saveDrawing() {
      if (!appState.currentScene || !appState.currentTask || isSavingDrawing || pendingCanvasRestore) return;
      if (!canvasHasContent) {
        showToast('先画几笔，再完成作品吧！', 'warning');
        return;
      }

      isSavingDrawing = true;
      elements.saveDrawing.disabled = true;
      elements.saveDrawing.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>正在保存…';

      const dataUrl = createPersistedDrawingSnapshot();
      if (!dataUrl) {
        showToast('画布尚未准备好，请稍后再试。', 'warning');
        isSavingDrawing = false;
        elements.saveDrawing.innerHTML = '<i class="fa fa-check mr-2"></i>完成绘画';
        updateCanvasActionButtons();
        return;
      }

      // 保存到完成的任务中
      if (!appState.completedTasks[appState.currentScene]) {
        appState.completedTasks[appState.currentScene] = {};
      }
      appState.completedTasks[appState.currentScene][appState.currentTask.id] = dataUrl;

      // Persist completed tasks
      const persisted = saveAppState();
      if (typeof classroomTaskCompleted === 'function') classroomTaskCompleted();
      if (persisted) deleteCurrentDraft();
      else persistCurrentDraft({ silent: true });

      // 更新进度和任务卡片
      const scene = scenes[appState.currentScene];
      updateProgress(scene);
      renderTasks(scene);  // 重新渲染任务卡片，使打勾标记显示

      // 显示成功提示
      const completedCount = scene.tasks.filter(task => appState.completedTasks[appState.currentScene]?.[task.id]).length;
      elements.successMessage.textContent = `你成功完成了${appState.currentTask.name}的绘制！现在已完成 ${completedCount}/${scene.tasks.length} 个任务。返回${scene.name}后可以查看作品或继续下一个任务。`;
      if (!persisted) {
        elements.successMessage.textContent += ' 当前浏览器存储空间不足，本次进度仅在此页面打开期间保留。';
      }
      elements.successModal.classList.remove('hidden');
      setDrawingStatus('已完成', 'completed');

      if (typeof window.confetti === 'function' && !(typeof classroomQuiet === 'function' && classroomQuiet())) {
        try {
          window.confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999
          });
        } catch (error) {
          console.warn('[Celebration] Animation unavailable', error);
        }
      }

      // 保存后清空工作画布与描摹层，确保不会影响下一个任务的绘制
      clearCanvas({ removeDraft: false });
      setDrawingStatus('已完成', 'completed');
      isSavingDrawing = false;
      elements.saveDrawing.innerHTML = '<i class="fa fa-check mr-2"></i>完成绘画';
      updateCanvasActionButtons();
    }


    // ================================
    // 🆕 用户上传自定义描摹图片模块
    // ================================

    // 脚本位于页面元素之后，立即绑定，不等待远程图片全部加载。
    (function setupUploadListener() {
      const uploadInput = document.getElementById('upload-trace');
      if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
          if (!supportedTypes.includes(file.type)) {
            showToast('请选择 PNG、JPG、WebP 或 GIF 图片。', 'warning');
            e.target.value = '';
            return;
          }
          if (file.size > 10 * 1024 * 1024) {
            showToast('图片不能超过 10 MB，请压缩后重试。', 'warning');
            e.target.value = '';
            return;
          }
          const reader = new FileReader();
          const session = drawingSession;
          const readVersion = ++uploadReadVersion;
          reader.onload = (event) => {
            if (session !== drawingSession || readVersion !== uploadReadVersion || elements.drawingMode.classList.contains('hidden')) return;
            if (typeof event.target.result !== 'string' || !event.target.result.startsWith('data:image/')) {
              showToast('读取图片失败，请换一张图片重试。', 'warning');
              return;
            }
            activateTraceSource(event.target.result, '图片上传成功，已开启描摹模式');
          };
          reader.onerror = () => {
            if (session === drawingSession && readVersion === uploadReadVersion) showToast('读取图片失败，请换一张图片重试。', 'warning');
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        });
      }
    })();

function setupDrawingEventListeners() {
      // 返回任务列表（如果从全屏绘画返回，去掉对应样式）
      document.getElementById('back-to-tasks').addEventListener('click', () => {
        const savedDraft = canvasHasContent ? persistCurrentDraft({ silent: true }) : false;
        if (canvasHasContent && !savedDraft) {
          showToast('草稿保存失败，画布仍保留。请先完成绘画后再返回。', 'warning');
          return;
        }
        if (history.state?.sectionId === 'drawing') {
          if (savedDraft) showToast('未完成的绘画已自动保存', 'success');
          history.back();
          return;
        }
        const scene = scenes[appState.currentScene];
        if (scene) renderTasks(scene);
        elements.sceneSelection.classList.add('hidden');
        elements.sceneTasks.classList.remove('hidden');
        elements.drawingMode.classList.add('hidden');
        elements.storyMode.classList.add('hidden');
        // 移除全屏绘画样式
        hideDrawingModeFullscreen();
        stopSpeech();
        if (savedDraft) showToast('未完成的绘画已自动保存', 'success');
      });

      // 画笔大小调整 - 已修复
      elements.brushSize.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        elements.sizeValue.textContent = `${currentSize}px`;
        if (ctx) ctx.lineWidth = currentSize;
        updateBrushPreview();
        updateEraserCursorPreview();
        updateBrushCursorPreview();
      });

      // 颜色选择 - 已修复（铅笔和橡皮禁用颜色切换）
      elements.colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          // 如果当前是铅笔或橡皮，不允许切换颜色
          if (currentBrush === 'pencil' || currentBrush === 'eraser') {
            return;
          }
          // 移除其他按钮的 active 类和样式
          elements.colorBtns.forEach(b => {
            b.classList.remove('active', 'ring-2', 'ring-primary', 'scale-110');
            b.style.opacity = '1';
          });
          
          // 添加当前按钮的 active 类
          btn.classList.add('active');
          // 设置颜色
          currentColor = btn.dataset.color;
          lastPaintColor = currentColor;
          if (ctx) {
            ctx.strokeStyle = currentColor;
            // 重置合成操作为正常绘制模式
            ctx.globalCompositeOperation = 'source-over';
          }
          isEraser = false;
          updateBrushPreview();
          updateBrushCursorPreview();
        });
      });

      // 笔刷选择
      elements.brushBtns.forEach(b => {
        b.addEventListener('click', () => {
          elements.brushBtns.forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          currentBrush = b.dataset.brush || 'fineliner';
          
          // 如果切换到橡皮，禁用颜色按钮（与铅笔相同处理）
          if (currentBrush === 'eraser') {
            isEraser = true;
            // 移除所有颜色按钮的 active 类，使其显示为灰色禁用状态
            elements.colorBtns.forEach(cb => cb.classList.remove('active', 'ring-2', 'ring-primary', 'scale-110'));
            elements.colorBtns.forEach(cb => cb.style.opacity = '0.5');
          } 
          // 如果切换到铅笔，强制设置为铅笔色并禁用颜色按钮
          else if (currentBrush === 'pencil') {
            isEraser = false;
            currentColor = '#4A4A4A'; // 铅笔色
            // 移除所有颜色按钮的 active 类，使其显示为灰色禁用状态
            elements.colorBtns.forEach(cb => cb.classList.remove('active', 'ring-2', 'ring-primary', 'scale-110'));
            elements.colorBtns.forEach(cb => cb.style.opacity = '0.5');
          } 
          else {
            // 其他笔刷恢复颜色按钮功能，并保留用户刚刚选择的颜色
            isEraser = false;
            elements.colorBtns.forEach(cb => {
              cb.classList.remove('active', 'ring-2', 'ring-primary', 'scale-110');
              cb.style.opacity = '1';
            });
            currentColor = lastPaintColor;
            const matchingColor = Array.from(elements.colorBtns).find(cb => cb.dataset.color === lastPaintColor);
            if (matchingColor) matchingColor.classList.add('active');
          }
          
          // 在切换笔刷时更新预览与 ctx 设置
          if (ctx) applyBrushSettings();
          updateBrushPreview();
          updateEraserCursorPreview();
          updateBrushCursorPreview();
        });
      });

      // 描摹模式切换
      elements.traceMode.addEventListener('click', () => {
        const fallbackReference = appState.currentTask?.references?.[0] || null;
        activateTraceSource(currentTraceSource || fallbackReference);
      });

      // 自由画模式切换（只隐藏参考图，不影响已画内容）
      elements.freeMode.addEventListener('click', () => {
        cancelImageLoad(elements.traceImage);
        setTraceMode(false);
        showToast('已切换到自由画，画布内容不会改变');
      });

      // 画布事件 - 已修复绘画功能
      // Prefer Pointer Events when available for unified input handling
      if (window.PointerEvent) {
        elements.drawingCanvas.addEventListener('pointerdown', (e) => {
          if ((e.pointerType === 'mouse' && e.button !== 0) || e.isPrimary === false || activePointerId !== null || pendingCanvasRestore) return;
          e.preventDefault();
          activePointerId = e.pointerId;
          elements.drawingCanvas.setPointerCapture(e.pointerId);
          startDrawing(e);
        });
        elements.drawingCanvas.addEventListener('pointermove', (e) => {
          if (e.pointerId !== activePointerId) return;
          e.preventDefault(); draw(e);
        });
        elements.drawingCanvas.addEventListener('pointerup', (e) => {
          if (e.pointerId !== activePointerId) return;
          e.preventDefault();
          stopDrawing();
          activePointerId = null;
          if (elements.drawingCanvas.hasPointerCapture(e.pointerId)) {
            elements.drawingCanvas.releasePointerCapture(e.pointerId);
          }
        });
        elements.drawingCanvas.addEventListener('pointercancel', (e) => {
          if (e.pointerId !== activePointerId) return;
          stopDrawing();
          activePointerId = null;
        });
      } else {
        elements.drawingCanvas.addEventListener('mousedown', startDrawing);
        elements.drawingCanvas.addEventListener('mousemove', draw);
        elements.drawingCanvas.addEventListener('mouseup', stopDrawing);
        elements.drawingCanvas.addEventListener('mouseout', stopDrawing);
      }
      // 使用与画布一致的 Pointer Events，让画笔/橡皮范围指示在拖绘时持续跟随。
      document.addEventListener(window.PointerEvent ? 'pointermove' : 'mousemove', (e) => {
        updateEraserCursorPosition(e.clientX, e.clientY);
        updateBrushCursorPosition(e.clientX, e.clientY);
      });

      // 全局鼠标离开窗口时隐藏预览
      document.addEventListener('mouseleave', () => {
        const eraserPreview = document.getElementById('eraser-cursor-preview');
        if (eraserPreview) eraserPreview.classList.remove('visible');
        const brushPreview = document.getElementById('brush-cursor-preview');
        if (brushPreview) brushPreview.classList.remove('visible');
      });

      // 全局鼠标回到窗口时恢复预览（如果在橡皮或笔刷模式）
      document.addEventListener('mouseenter', () => {
        updateEraserCursorPreview();
        updateBrushCursorPreview();
      });

      // 触摸设备支持 - 仅在不支持 PointerEvent 时添加（避免重复触发）
      if (!window.PointerEvent) {
        elements.drawingCanvas.addEventListener('touchstart', (e) => {
          e.preventDefault(); // 阻止页面滚动
          const touch = e.touches[0];
          const touchEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => e.preventDefault()
          };
          startDrawing(touchEvent);
        });

        elements.drawingCanvas.addEventListener('touchmove', (e) => {
          e.preventDefault(); // 阻止页面滚动
          const touch = e.touches[0];
          const touchEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => e.preventDefault()
          };
          draw(touchEvent);
        });

        elements.drawingCanvas.addEventListener('touchend', (e) => {
          e.preventDefault(); // 阻止页面滚动
          stopDrawing();
        });
      }

      // 保存绘画
      elements.saveDrawing.addEventListener('click', saveDrawing);

      // 撤销操作
      elements.undoBtn.addEventListener('click', undoDrawing);

      // 清除画布
      elements.clearBtn.addEventListener('click', () => {
        if (!canvasHasContent) return;
        openChoiceModal({
          title: '要清空画布吗？',
          message: '清空后不能撤销，已自动保存的当前草稿也会被删除。',
          primaryLabel: '确认清空',
          secondaryLabel: '保留画作',
          icon: 'fa-trash',
          danger: true,
          onPrimary: () => {
            clearCanvas();
            showToast('画布已清空');
          }
        });
      });

      elements.choicePrimary.addEventListener('click', () => {
        const action = choicePrimaryAction;
        elements.choiceModal.classList.add('hidden');
        choicePrimaryAction = null;
        choiceSecondaryAction = null;
        if (typeof action === 'function') action();
      });
      elements.choiceSecondary.addEventListener('click', () => closeChoiceModal(true));

      elements.artworkClose.addEventListener('click', () => {
        elements.artworkModal.classList.add('hidden');
        artworkTaskToRedraw = null;
      });
      elements.artworkRedraw.addEventListener('click', () => {
        const task = artworkTaskToRedraw;
        elements.artworkModal.classList.add('hidden');
        artworkTaskToRedraw = null;
        if (task) startDrawingTask(task, { fresh: true });
      });
      elements.artworkModal.addEventListener('click', (event) => {
        if (event.target === elements.artworkModal) {
          elements.artworkModal.classList.add('hidden');
          artworkTaskToRedraw = null;
        }
      });
}

function flushDrawingDraft() {
      // A page can become hidden before pointerup marks the current stroke dirty.
      stopDrawing();
      activePointerId = null;
      if (canvasHasContent && currentDrawingDirty) persistCurrentDraft({ silent: true });
}

function setupDrawingPersistenceListeners() {
      window.addEventListener('beforeunload', flushDrawingDraft);
      window.addEventListener('pagehide', flushDrawingDraft);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushDrawingDraft();
      });
}
