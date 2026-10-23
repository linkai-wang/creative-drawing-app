// localStorage validation and persistence. Keys, schemas, and limits are unchanged.
// Depends on: scenes.js, state.js. Draft snapshots are supplied by drawing.js at runtime.

    const STORAGE_KEY = 'creative-draw-app:v1';
    const DRAFT_STORAGE_KEY = 'creative-draw-drafts:v1';


    function sanitizeCompletedTasks(value) {
      const sanitized = {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) return sanitized;

      Object.entries(value).forEach(([sceneId, tasks]) => {
        const scene = scenes[sceneId];
        if (!Object.prototype.hasOwnProperty.call(scenes, sceneId) || !tasks || typeof tasks !== 'object' || Array.isArray(tasks)) return;
        const allowedTaskIds = new Set((scene.tasks || []).map(task => task.id));
        const validTasks = {};

        Object.entries(tasks).forEach(([taskId, imageData]) => {
          if (!allowedTaskIds.has(taskId) || typeof imageData !== 'string') return;
          if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(imageData)) return;
          if (imageData.length > 2_000_000) return;
          validTasks[taskId] = imageData;
        });

        sanitized[sceneId] = validTasks;
      });

      return sanitized;
    }

    function sanitizeElementPositions(value) {
      const sanitized = {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) return sanitized;
      Object.entries(value).forEach(([sceneId, positions]) => {
        const scene = scenes[sceneId];
        if (!Object.prototype.hasOwnProperty.call(scenes, sceneId) || !positions || typeof positions !== 'object' || Array.isArray(positions)) return;
        const allowedTaskIds = new Set((scene.tasks || []).map(task => task.id));
        sanitized[sceneId] = {};
        Object.entries(positions).forEach(([taskId, position]) => {
          if (!allowedTaskIds.has(taskId) || !position || typeof position !== 'object') return;
          const x = Number(position.x);
          const y = Number(position.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          sanitized[sceneId][taskId] = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
          };
        });
      });
      return sanitized;
    }

    function loadAppState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        if (raw.length > 5_000_000) throw new Error('Saved state is unexpectedly large');
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;

        if (typeof saved.currentScene === 'string' && Object.prototype.hasOwnProperty.call(scenes, saved.currentScene)) {
          appState.currentScene = saved.currentScene;
        }
        appState.completedTasks = sanitizeCompletedTasks(saved.completedTasks);
        appState.elementPositions = sanitizeElementPositions(saved.elementPositions);

        if (saved.selectedBackgrounds && typeof saved.selectedBackgrounds === 'object') {
          Object.entries(saved.selectedBackgrounds).forEach(([sceneId, url]) => {
            const scene = scenes[sceneId];
            if (!Object.prototype.hasOwnProperty.call(scenes, sceneId) || typeof url !== 'string') return;
            if ((scene.backgrounds || []).some(background => background.url === url)) scene.bg = url;
          });
        }
        // currentTask and drawingHistory intentionally not persisted here
      } catch (e) {
        console.warn('loadAppState error', e);
      }
    }

    function saveAppState() {
      if (typeof LocalData !== 'undefined' && LocalData.resetting) return false;
      try {
        const toSave = {
          currentScene: appState.currentScene,
          completedTasks: appState.completedTasks,
          elementPositions: appState.elementPositions,
          selectedBackgrounds: Object.fromEntries(
            Object.entries(scenes).map(([sceneId, scene]) => [sceneId, scene.bg])
          )
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        return true;
      } catch (e) {
        console.warn('saveAppState error', e);
        return false;
      }
    }



    function getDraftKey(sceneId = appState.currentScene, taskId = appState.currentTask?.id) {
      return sceneId && taskId ? `${sceneId}:${taskId}` : null;
    }

    function loadDrafts() {
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw || raw.length > 6_000_000) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const valid = {};
        Object.entries(parsed).forEach(([key, draft]) => {
          if (!draft || typeof draft !== 'object') return;
          const [sceneId, taskId] = key.split(':');
          if (key !== `${sceneId}:${taskId}`) return;
          if (!Object.prototype.hasOwnProperty.call(scenes, sceneId) || !scenes[sceneId].tasks.some(task => task.id === taskId)) return;
          if (typeof draft.imageData !== 'string') return;
          if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(draft.imageData || '')) return;
          if (draft.imageData.length > 1_500_000) return;
          const savedAt = Number(draft.savedAt);
          valid[key] = { imageData: draft.imageData, savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : Date.now() };
        });
        return valid;
      } catch (error) {
        console.warn('[Draft] Could not read saved drafts', error);
        return {};
      }
    }

    function writeDrafts(drafts) {
      if (typeof LocalData !== 'undefined' && LocalData.resetting) return false;
      try {
        const newest = Object.fromEntries(
          Object.entries(drafts)
            .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0))
            .slice(0, 4)
        );
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(newest));
        return true;
      } catch (error) {
        console.warn('[Draft] Could not save draft', error);
        return false;
      }
    }

    function getCurrentDraft() {
      const key = getDraftKey();
      return key ? loadDrafts()[key] || null : null;
    }

    function deleteCurrentDraft() {
      const key = getDraftKey();
      if (!key) return;
      const drafts = loadDrafts();
      if (drafts[key]) {
        delete drafts[key];
        writeDrafts(drafts);
      }
    }

    function persistCurrentDraft({ silent = false } = {}) {
      if (typeof LocalData !== 'undefined' && LocalData.resetting) return false;
      clearTimeout(draftSaveTimer);
      if (!canvasHasContent || !appState.currentScene || !appState.currentTask) return false;
      if (!silent) setDrawingStatus('正在自动保存…');
      const imageData = pendingCanvasRestore?.dataUrl || createPersistedDrawingSnapshot(720, 0.8);
      if (!imageData) return false;
      const drafts = loadDrafts();
      drafts[getDraftKey()] = { imageData, savedAt: Date.now() };
      const saved = writeDrafts(drafts);
      if (saved) {
        currentDrawingDirty = false;
        setDrawingStatus('已自动保存', 'saved');
      } else if (!silent) {
        setDrawingStatus('暂时无法自动保存');
        showToast('浏览器存储空间不足，请尽快完成绘画。', 'warning');
      }
      return saved;
    }

    function scheduleDraftSave() {
      if (typeof LocalData !== 'undefined' && LocalData.resetting) return false;
      clearTimeout(draftSaveTimer);
      if (!canvasHasContent) {
        currentDrawingDirty = false;
        deleteCurrentDraft();
        setDrawingStatus('准备绘画');
        updateCanvasActionButtons();
        return;
      }
      currentDrawingDirty = true;
      setDrawingStatus('正在绘画');
      const session = drawingSession;
      draftSaveTimer = setTimeout(() => {
        if (session === drawingSession) persistCurrentDraft();
      }, 700);
    }
    
