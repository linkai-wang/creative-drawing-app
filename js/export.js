// Local PNG export of the saved task artwork shown in the artwork dialog.
// Depends on: state.js, drawing.js. No network request is made by this module.

let artworkExportBusy = false;

function artworkToPngBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) throw new Error('Artwork could not be decoded');
        context.drawImage(image, 0, 0);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG conversion failed')), 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Artwork could not be loaded'));
    image.src = dataUrl;
  });
}

function artworkDownloadFilename(sceneId, taskId) {
  const safe = (value, fallback) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || fallback;
  return `creative-drawing-${safe(sceneId, 'scene')}-${safe(taskId, 'artwork')}.png`;
}

async function downloadCompletedArtwork() {
  if (artworkExportBusy) return false;
  const button = document.getElementById('artwork-download');
  const sceneId = appState.currentScene;
  const taskId = artworkTaskToRedraw?.id;
  const dataUrl = appState.completedTasks[sceneId]?.[taskId];
  const isCurrentArtwork = () => !elements.artworkModal.classList.contains('hidden') &&
    appState.currentScene === sceneId && artworkTaskToRedraw?.id === taskId &&
    appState.completedTasks[sceneId]?.[taskId] === dataUrl;

  if (!button || !isCurrentArtwork()) return false;
  if (typeof dataUrl !== 'string' || !/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(dataUrl)) {
    showToast('\u8fd8\u6ca1\u6709\u53ef\u4ee5\u4e0b\u8f7d\u7684\u4f5c\u54c1\uff0c\u8bf7\u5148\u5b8c\u6210\u7ed8\u753b\u3002', 'warning');
    return false;
  }

  artworkExportBusy = true;
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = '\u6b63\u5728\u51c6\u5907\u4e0b\u8f7d\u2026';
  try {
    const blob = await artworkToPngBlob(dataUrl);
    if (!isCurrentArtwork()) return false;
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    try {
      link.href = url;
      link.download = artworkDownloadFilename(sceneId, taskId);
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Leave the URL alive long enough for the browser to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    showToast('\u5df2\u53d1\u8d77\u4f5c\u54c1\u4e0b\u8f7d', 'success');
    return true;
  } catch (error) {
    console.warn('[Artwork Export] Could not download artwork', error);
    if (isCurrentArtwork()) showToast('\u4f5c\u54c1\u4e0b\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002', 'warning');
    return false;
  } finally {
    artworkExportBusy = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = originalLabel;
  }
}

function setupArtworkExportListener() {
  document.getElementById('artwork-download')?.addEventListener('click', downloadCompletedArtwork);
}
