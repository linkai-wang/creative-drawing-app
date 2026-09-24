// Unified image loading, fallback, cancellation, and preloading.
// imageLoads and preloadedImages are intentionally singletons.
// Depends on: scenes.js, state.js. Runtime callbacks also use scene.js.

    // 本地 SVG 占位图由项目生成，不依赖第三方图片服务器。
    const IMAGE_LOADING_PLACEHOLDER = './assets/placeholders/image-loading.svg';
    const IMAGE_ERROR_PLACEHOLDER = './assets/placeholders/image-error.svg';

    // ================================
    // 🖼️ 图片加载和错误处理
    // ================================

    // 普通 <img> 展示不请求 CORS；仅画入导出 Canvas 的图片需要服务器授权。
    // 每个目标独立持有请求，旧任务/旧背景的回调不能修改当前图片。
    const imageLoads = new WeakMap();
    function cancelImageLoad(imgElement) {
      const cancel = imageLoads.get(imgElement);
      if (cancel) cancel();
    }

    function loadImageWithFallback(src, imgElement, onLoadCallback, onErrorCallback) {
      if (!imgElement) return;
      cancelImageLoad(imgElement);
      const probe = new Image();
      let settled = false;
      let timer;
      const cancel = () => {
        settled = true;
        clearTimeout(timer);
        probe.onload = probe.onerror = null;
        imgElement.onload = imgElement.onerror = null;
      };
      imageLoads.set(imgElement, cancel);
      const current = () => !settled && imageLoads.get(imgElement) === cancel;
      const setState = (state, imageSource) => {
        imgElement.dataset.imageState = state;
        imgElement.setAttribute('aria-busy', String(state === 'loading'));
        imgElement.title = state === 'error' ? '图片暂时无法加载' : state === 'loading' ? '图片加载中…' : (imgElement.alt || '');
        imgElement.src = imageSource;
      };
      imgElement.removeAttribute('crossorigin');
      imgElement.referrerPolicy = 'no-referrer';
      // 加载器自己管理超时，不能再让浏览器懒加载延迟最终 load 事件。
      imgElement.loading = 'eager';
      imgElement.style.display = 'block';
      imgElement.dataset.imageSource = src || '';
      // 清除旧版加载器留下的背景，避免切换回来时残留彩色块。
      if (imgElement.id === 'scene-bg') {
        imgElement.parentElement.style.background = '';
        imgElement.style.transform = 'none';
      }
      setState('loading', IMAGE_LOADING_PLACEHOLDER);
      const fail = (reason) => {
        if (!current()) return;
        cancel();
        setState('error', IMAGE_ERROR_PLACEHOLDER);
        if (onErrorCallback) onErrorCallback(reason);
      };
      probe.onload = () => {
        if (!current()) return;
        if (!probe.naturalWidth || !probe.naturalHeight) return fail('decode');
        // 占位图的 load 事件不能被当成原图成功。
        imgElement.onload = () => {
          if (!current() || imgElement.getAttribute('src') !== src) return;
          if (imgElement.currentSrc !== new URL(src, document.baseURI).href) return;
          if (!imgElement.naturalWidth) return fail('decode');
          cancel();
          imgElement.dataset.imageState = 'loaded';
          imgElement.setAttribute('aria-busy', 'false');
          imgElement.title = imgElement.alt || '';
          if (imgElement.id === 'scene-bg') setPreviewZoom(previewZoomState.current);
          if (onLoadCallback) onLoadCallback(probe);
        };
        imgElement.onerror = () => fail('display');
        imgElement.src = src;
      };
      probe.onerror = () => fail('network-or-decode');
      // 有界等待，不重试；切换图片会取消旧计时器。
      timer = setTimeout(() => fail('timeout'), 15000);
      if (typeof src !== 'string' || !src) return fail('missing-source');
      probe.referrerPolicy = 'no-referrer';
      probe.src = src;
    }

    function initializeImages(root = document) {
      root.querySelectorAll('img[data-image-src]').forEach(img => {
        const source = img.getAttribute('data-image-src');
        img.removeAttribute('data-image-src');
        loadImageWithFallback(source, img);
      });
    }

    // 仅预加载普通展示图片，不请求跨域 Canvas 访问权。
    const preloadedImages = new Set();
    function preloadNextSceneImages(sceneIndex) {
      const scene = Object.values(scenes)[sceneIndex];
      if (!scene?.bg || preloadedImages.has(scene.bg)) return;
      preloadedImages.add(scene.bg);
      const image = new Image();
      image.referrerPolicy = 'no-referrer';
      image.src = scene.bg;
    }

