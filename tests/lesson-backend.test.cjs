const nodeTest = require('node:test');
const test = (name, fn) => nodeTest(name, { timeout: 10000 }, fn);
const assert = require('node:assert/strict');
const ORIGIN = 'http://127.0.0.1:8000';
const TOKEN = 'test-classroom-code-32-characters';
const INPUT = { request: 'Choose two beach tasks.', sceneId: 'beach' };
const PLAN = { name: 'Beach activity', goal: 'Draw simple shapes', sceneId: 'beach', taskIds: ['shell', 'wave'],
  steps: { shell: ['Draw a curve'], wave: ['Draw a wave'] }, quiet: true, simpleTools: true };
const toolReply = (id, name, args) => new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls',
  message: { tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] }));

async function fixture(t, options = {}) {
  const { createStoryServer } = await import('../backend/story-server.mjs');
  const calls = [];
  const server = createStoryServer({ env: { DEEPSEEK_API_KEY: 'test-provider-key-not-real',
    STORY_ACCESS_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN }, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (!payload.tools) return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'A story.' } }] }));
    return payload.messages.some(message => message.role === 'tool')
      ? toolReply('draft', 'create_plan_draft', PLAN) : toolReply('lookup', 'get_tasks', { sceneId: 'beach' });
  }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (input = INPUT, extra = {}, path = '/api/lesson-plan') => fetch(url + path, {
    method: 'POST', headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json', ...extra }, body: JSON.stringify(input)
  });
  return { send, calls };
}

test('lesson API runs the tool loop through the same authenticated backend', async t => {
  const { send, calls } = await fixture(t);
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
  const result = await response.json();
  assert.deepEqual(result.plan, PLAN);
  assert.deepEqual(result.actions.map(action => action.tool), ['get_tasks', 'create_plan_draft']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].max_tokens, 2000);
  assert.equal(calls[0].tool_choice, 'auto');
  assert.ok(!JSON.stringify(result).includes('test-provider-key'));
});

test('lesson route rejects bad access, origins and arbitrary payload fields before model use', async t => {
  const { send, calls } = await fixture(t);
  assert.equal((await send(INPUT, { Authorization: 'Bearer incorrect' })).status, 401);
  assert.equal((await send(INPUT, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await send({ ...INPUT, model: 'arbitrary' })).status, 400);
  assert.equal((await send({ ...INPUT, request: 'x'.repeat(501) })).status, 400);
  assert.equal(calls.length, 0);
});

test('story and lesson generation share one process request limit', async t => {
  const { send, calls } = await fixture(t, { requestsPerMinute: 1 });
  assert.equal((await send({ sceneId: 'beach', completedTaskIds: [] }, {}, '/api/story')).status, 200);
  assert.equal((await send()).status, 429);
  assert.equal(calls.length, 1);
});

test('the lesson deadline aborts a pending model turn and returns a safe timeout', async t => {
  let aborted = false;
  const { send } = await fixture(t, { lessonTimeoutMs: 30, fetchImpl: async (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      aborted = true; reject(new Error('private-provider-details'));
    }, { once: true })) });
  const response = await send();
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'provider_timeout' });
  assert.equal(aborted, true);
});
