// Only this app's four data buckets. GitHub Pages projects can share an origin.
(function (root) {
  const keys = Object.freeze(['creative-draw-app:v1', 'creative-draw-drafts:v1', 'creative-classroom:v1', 'ttsSettings']);
  const api = {
    keys,
    resetting: false,
    clear(storage = globalThis.localStorage) {
      let success = true;
      for (const key of keys) {
        try { storage.removeItem(key); } catch { success = false; }
      }
      for (const key of keys) {
        try { if (storage.getItem(key) !== null) success = false; } catch { success = false; }
      }
      return success;
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LocalData = api;
})(globalThis);
