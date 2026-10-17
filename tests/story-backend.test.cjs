const nodeTest = require('node:test');
const test = (name, fn) => nodeTest(name, { timeout: 10000 }, fn);
const assert = require('node:assert/strict');
const http = require('node:http');

const ORIGIN = 'http://127.0.0.1:8000';
const TOKEN = 'test-classroom-code-32-characters';
const KEY = 'test-provider-key-not-a-real-key';
const ENV = { DEEPSEEK_API_KEY: KEY, STORY_ACCESS_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN };
const INPUT = { sceneId: 'beach', completedTaskIds: ['shell'] };
const completion = (story = 'A shell meets a wave.') => new Response(JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { content: story } }]
}));

async function fixture(t, options = {}) {
  const { createStoryServer } = await import('../backend/story-server.mjs');
  const calls = [];
  const server = createStoryServer({ env: ENV, fetchImpl: async (...args) => {
    calls.push(args); return completion();
  }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (input = INPUT, extra = {}) => fetch(`${url}/api/story`, {
    method: 'POST', headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json', ...extra.headers },
    body: JSON.stringify(input), ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'headers'))
  });
  return { url, calls, send };
}

test('story server translates valid task IDs into a controlled provider request', async t => {
  const { send, calls } = await fixture(t);
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { story: 'A shell meets a wave.' });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(options.redirect, 'error');
  const payload = JSON.parse(options.body);
  assert.equal(payload.model, 'deepseek-flash');
  assert.deepEqual(payload.thinking, { type: 'disabled' });
  assert.equal(payload.max_tokens, 500);
  const context = JSON.parse(payload.messages[1].content);
  assert.equal(context.completedTasks.length, 1);
  assert.equal(context.completedTasks[0], '\u8d1d\u58f3');
  assert.ok(!options.body.includes('data:image'));
  assert.ok(!options.body.includes(TOKEN));
});

test('preflight accepts only the configured origin and required headers', async t => {
  const { url, calls } = await fixture(t);
  const headers = { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type' };
  const response = await fetch(`${url}/api/story`, { method: 'OPTIONS', headers });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
  const bad = await fetch(`${url}/api/story`, { method: 'OPTIONS', headers: { ...headers,
    'Access-Control-Request-Headers': 'x-forwarded-key' } });
  assert.equal(bad.status, 403);
  assert.equal(calls.length, 0);
});

test('missing, wildcard, lookalike and unrelated origins cannot call the model', async t => {
  const { send, calls } = await fixture(t);
  for (const origin of ['', '*', `${ORIGIN}.evil.example`, 'https://another.example']) {
    const response = await send(INPUT, { headers: { Origin: origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(calls.length, 0);
});

test('model key and independent classroom access code are both required', async t => {
  for (const env of [{ ...ENV, DEEPSEEK_API_KEY: '' }, { ...ENV, STORY_ACCESS_TOKEN: '' },
    { ...ENV, STORY_ACCESS_TOKEN: KEY }, { ...ENV, ALLOWED_ORIGINS: '*' }]) {
    const { send, calls } = await fixture(t, { env });
    assert.ok([403, 503].includes((await send()).status));
    assert.equal(calls.length, 0);
  }
  const { send, calls } = await fixture(t);
  for (const authorization of ['', 'Bearer wrong-code', `Bearer ${KEY}`]) {
    const response = await send(INPUT, { headers: { Authorization: authorization } });
    assert.equal(response.status, 401);
    const body = await response.text();
    assert.ok(!body.includes(KEY) && !body.includes(TOKEN));
  }
  assert.equal(calls.length, 0);
});

test('malformed inputs and arbitrary proxy parameters never reach the provider', async t => {
  const { send, calls } = await fixture(t);
  for (const input of [null, [], {}, { ...INPUT, sceneId: '__proto__' },
    { ...INPUT, completedTaskIds: ['missing'] }, { ...INPUT, completedTaskIds: ['shell', 'shell'] },
    { ...INPUT, messages: [{ role: 'user', content: 'arbitrary prompt' }] },
    { ...INPUT, model: 'expensive-model' }, { ...INPUT, image: 'data:image/png;base64,private' }]) {
    assert.equal((await send(input)).status, 400);
  }
  assert.equal((await send(INPUT, { body: '{' })).status, 400);
  assert.equal((await send(INPUT, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await send(INPUT, { body: 'x'.repeat(5000) })).status, 413);
  assert.equal(calls.length, 0);
});

test('health checks are free and backend never serves source or secret files', async t => {
  const { url, calls } = await fixture(t);
  assert.deepEqual(await (await fetch(`${url}/healthz`)).json(), { status: 'ok' });
  for (const path of ['/.env', '/backend/.env', '/backend/story-server.mjs', '/']) {
    assert.equal((await fetch(url + path)).status, 404);
  }
  assert.equal((await fetch(`${url}/api/story`, { headers: { Origin: ORIGIN } })).status, 405);
  assert.equal(calls.length, 0);
});

test('empty completed-task lists are valid and all scene tasks share the same catalogue', async t => {
  const { send } = await fixture(t);
  const scenes = require('../js/scenes.js');
  for (const sceneId of Object.keys(scenes)) {
    const completedTaskIds = scenes[sceneId].tasks.map(task => task.id);
    assert.equal((await send({ sceneId, completedTaskIds })).status, 200);
  }
  assert.equal((await send({ ...INPUT, completedTaskIds: [] })).status, 200);
});

test('request limit resets after one minute and rejected requests incur no model calls', async t => {
  let clock = 0;
  const { send, calls } = await fixture(t, { now: () => clock, requestsPerMinute: 2 });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  const rejected = await send();
  assert.equal(rejected.status, 429);
  assert.equal(rejected.headers.get('retry-after'), '60');
  assert.equal(calls.length, 2);
  clock = 60001;
  assert.equal((await send()).status, 200);
});

test('concurrency limit holds while the provider is still working', async t => {
  let release;
  let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { entered = resolve; });
  const { send } = await fixture(t, { maxConcurrent: 1, fetchImpl: async () => {
    entered(); await gate; return completion();
  } });
  const pending = send();
  await began;
  assert.equal((await send()).status, 429);
  release();
  assert.equal((await pending).status, 200);
  assert.equal((await send()).status, 200);
});

test('provider failures and credential details are sanitized', async t => {
  for (const status of [401, 429, 500]) {
    const { send } = await fixture(t, { fetchImpl: async () => new Response(`PRIVATE ${KEY}`, { status }) });
    const response = await send();
    assert.equal(response.status, status === 429 ? 503 : 502);
    assert.ok(!(await response.text()).includes(KEY));
  }
  const { send } = await fixture(t, { fetchImpl: async () => { throw new Error(KEY); } });
  assert.equal((await send()).status, 502);
});

test('empty, truncated, malformed and excessive model responses are rejected', async t => {
  const samples = [new Response('not json'), completion(''), completion('x'.repeat(2001)),
    new Response('x'.repeat(70000)), new Response(JSON.stringify({ choices: [
      { finish_reason: 'length', message: { content: 'An incomplete story' } }
    ] }))];
  for (const sample of samples) {
    const { send } = await fixture(t, { fetchImpl: async () => sample });
    const response = await send();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'invalid_provider_response' });
  }
});

test('upstream timeout aborts the model request and releases the concurrency slot', async t => {
  let aborted = false;
  let first = true;
  const { send } = await fixture(t, { upstreamTimeoutMs: 30, maxConcurrent: 1,
    fetchImpl: async (_url, { signal }) => {
      if (!first) return completion();
      first = false;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        aborted = true; reject(new Error('aborted'));
      }, { once: true }));
    } });
  const response = await send();
  assert.equal(response.status, 504);
  assert.ok(aborted);
  assert.equal((await send()).status, 200);
});

test('disconnecting the browser aborts pending provider work', async t => {
  let entered;
  let aborted;
  const started = new Promise(resolve => { entered = resolve; });
  const cancelled = new Promise(resolve => { aborted = resolve; });
  const { url } = await fixture(t, { fetchImpl: async (_url, { signal }) => {
    entered();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
      aborted(); reject(new Error('cancelled'));
    }, { once: true }));
  } });
  const controller = new AbortController();
  const request = fetch(`${url}/api/story`, { method: 'POST', signal: controller.signal,
    headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(INPUT) }).catch(() => {});
  await started;
  controller.abort();
  await cancelled;
  await request;
});

test('streamed bodies are bounded even without Content-Length', async t => {
  const { url, calls } = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${url}/api/story`, { method: 'POST', headers: {
      Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.write('x'.repeat(3000));
    req.end('x'.repeat(3000));
  });
  assert.equal(status, 413);
  assert.equal(calls.length, 0);
});

test('slow request bodies receive a timeout without making a model call', async t => {
  const { url, calls } = await fixture(t, { bodyTimeoutMs: 30 });
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${url}/api/story`, { method: 'POST', headers: {
      Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    } }, res => { res.resume(); req.destroy(); resolve(res.statusCode); });
    req.on('error', reject);
    req.write('{');
  });
  assert.equal(status, 408);
  assert.equal(calls.length, 0);
});
