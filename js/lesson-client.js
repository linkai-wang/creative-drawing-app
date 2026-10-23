(function (root) {
  const story = typeof module !== 'undefined' && module.exports ? require('./story-client.js') : StoryClient;
  const validator = typeof module !== 'undefined' && module.exports ? require('./lesson-plan.js') : root.LessonPlan;
  function endpoint(config, location) {
    let value = config?.lessonApiEndpoint;
    if (!value && config?.storyApiEndpoint) {
      const url = new URL(config.storyApiEndpoint, location.href);
      if (url.pathname === '/api/story') { url.pathname = '/api/lesson-plan'; value = url.href; }
    }
    return story.resolveEndpoint(value, location);
  }
  async function generate({ url, request, sceneId, accessToken, signal, scenes, fetchImpl = globalThis.fetch }) {
    const response = await fetchImpl(url, {
      method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ request, sceneId })
    });
    if (!response.ok) { const error = new Error('lesson_failed'); error.status = response.status; throw error; }
    const data = await response.json();
    const checked = validator.validate(data?.plan, scenes);
    if (!checked.ok || !Array.isArray(data.actions) || data.actions.length > 6 ||
        data.actions.some(action => !action || !['get_tasks', 'create_plan_draft', 'unknown'].includes(action.tool) || typeof action.ok !== 'boolean') ||
        !data.actions.some(action => action.tool === 'get_tasks' && action.ok) ||
        !data.actions.some(action => action.tool === 'create_plan_draft' && action.ok)) throw new Error('invalid_lesson');
    return { plan: checked.plan, actions: data.actions.map(({ tool, ok }) => ({ tool, ok })) };
  }
  const api = { endpoint, generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LessonClient = api;
})(globalThis);
