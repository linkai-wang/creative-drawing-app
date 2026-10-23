// Confirmed reset of app records, pending work and page-memory credentials.
function setupLocalDataReset() {
  const button = document.getElementById('reset-local-data');
  const dialog = document.getElementById('reset-data-dialog');
  const confirm = document.getElementById('reset-data-confirm');
  const cancel = document.getElementById('reset-data-cancel');
  const status = document.getElementById('reset-data-status');
  let channel = null;

  function pausePendingWork() {
    clearTimeout(draftSaveTimer);
    drawingSession++;
    uploadReadVersion++;
    cancelCanvasRestore();
    stopSpeech();
    cancelStoryRequest();
    lessonAgentCancel();
    storyAccessToken = '';
    lessonAgentCode = '';
    document.querySelectorAll('#story-access-code, #lesson-agent-code').forEach(input => { input.value = ''; });
  }

  function reloadHome() {
    history.replaceState({ sectionId: 'scene-selection' }, '', '#scene-selection');
    window.location.reload();
  }

  function reportFailure() {
    LocalData.resetting = false;
    confirm.disabled = false;
    cancel.disabled = false;
    status.textContent = '未能清除全部记录，请重试或检查浏览器的存储权限。';
    status.hidden = false;
    if (!dialog.open) showToast(status.textContent, 'warning');
  }

  function clearAndReload(notify = false) {
    LocalData.resetting = true;
    confirm.disabled = true;
    cancel.disabled = true;
    pausePendingWork();
    let cleared = false;
    try { cleared = LocalData.clear(); } catch { /* Storage can be disabled by the browser. */ }
    if (!cleared) { reportFailure(); return; }
    if (notify) {
      try { channel?.postMessage({ type: 'clear-local-records' }); } catch { /* Storage events remain a fallback. */ }
    }
    reloadHome();
  }

  button.addEventListener('click', () => {
    if (LocalData.resetting) return;
    status.hidden = true;
    status.textContent = '';
    confirm.disabled = false;
    cancel.disabled = false;
    dialog.showModal();
    cancel.focus();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (!LocalData.resetting) button.focus(); });
  confirm.addEventListener('click', () => {
    if (!LocalData.resetting) clearAndReload(true);
  });

  // Stop older tabs from saving their previous in-memory copy after a reset.
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('creative-drawing-local-data');
      channel.addEventListener('message', event => {
        if (event.data?.type === 'clear-local-records' && !LocalData.resetting) clearAndReload();
      });
    } catch { /* Some privacy modes disable this optional channel. */ }
  }
  window.addEventListener('storage', event => {
    const removedAppRecord = LocalData.keys.slice(0, 3).includes(event.key) && event.newValue === null;
    if (LocalData.resetting || !(event.key === null || removedAppRecord)) return;
    LocalData.resetting = true;
    pausePendingWork();
    // Group the synchronous removals before another tab reloads its state.
    setTimeout(() => {
      let cleared = false;
      try { cleared = LocalData.clear(); } catch { /* Report a blocked browser store. */ }
      if (cleared) reloadHome(); else reportFailure();
    }, 50);
  });
}
