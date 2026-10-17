// The browser sends task IDs, never artwork, provider settings or model credentials.
const StoryClient = (() => {
  function resolveEndpoint(value, location) {
    if (!value) return null;
    const url = new URL(value, location.href);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.hash || url.search ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && location.protocol === 'http:'))) {
      throw new Error('invalid_endpoint');
    }
    return url.href;
  }

  async function generate({ endpoint, sceneId, completedTaskIds, accessToken, signal, fetchImpl = globalThis.fetch }) {
    const response = await fetchImpl(endpoint, {
      method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ sceneId, completedTaskIds })
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'access_denied' :
        response.status === 429 ? 'request_limit' : response.status === 503 ? 'service_unavailable' :
        response.status === 504 ? 'provider_timeout' : 'story_failed');
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    if (typeof data?.story !== 'string' || !data.story.trim() || data.story.length > 2000) {
      throw new Error('invalid_story');
    }
    return data.story.trim();
  }
  return { resolveEndpoint, generate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = StoryClient;
