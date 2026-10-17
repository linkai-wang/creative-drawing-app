const test = require('node:test');
const assert = require('node:assert/strict');
const StoryClient = require('../js/story-client.js');
const LOCATION = { href: 'https://example.github.io/drawing/', protocol: 'https:' };

test('story endpoint allows HTTPS and rejects credentials, insecure URLs and embedded tokens', () => {
  assert.equal(StoryClient.resolveEndpoint(null, LOCATION), null);
  assert.equal(StoryClient.resolveEndpoint('https://story.example/api/story', LOCATION), 'https://story.example/api/story');
  for (const value of ['http://story.example/api/story', 'http://localhost:8787/api/story',
    'https://user:password@story.example/api/story', 'https://story.example/api/story?token=secret',
    'https://story.example/api/story#secret', 'javascript:alert(1)']) {
    assert.throws(() => StoryClient.resolveEndpoint(value, LOCATION));
  }
  assert.equal(StoryClient.resolveEndpoint('http://127.0.0.1:8787/api/story',
    { href: 'http://127.0.0.1:8000/', protocol: 'http:' }), 'http://127.0.0.1:8787/api/story');
});

test('browser sends only structured task information and a separate access code', async () => {
  const controller = new AbortController();
  const story = await StoryClient.generate({ endpoint: 'https://story.example/api/story',
    sceneId: 'beach', completedTaskIds: ['shell'], accessToken: 'classroom-test-code', signal: controller.signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://story.example/api/story');
      assert.deepEqual(JSON.parse(options.body), { sceneId: 'beach', completedTaskIds: ['shell'] });
      assert.equal(options.headers.Authorization, 'Bearer classroom-test-code');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.signal, controller.signal);
      return new Response(JSON.stringify({ story: ' A shell adventure. ' }));
    } });
  assert.equal(story, 'A shell adventure.');
});

test('browser exposes useful status codes without showing raw server errors', async () => {
  for (const status of [401, 429, 503, 504, 500]) {
    await assert.rejects(StoryClient.generate({ endpoint: 'https://story.example/api/story',
      sceneId: 'beach', completedTaskIds: [], accessToken: 'classroom-test-code',
      fetchImpl: async () => new Response('private-server-details', { status }) }), error => {
      assert.equal(error.status, status);
      assert.ok(!error.message.includes('private-server-details'));
      return true;
    });
  }
});

test('browser rejects missing and oversized stories', async () => {
  for (const data of [{}, { story: ' ' }, { story: 7 }, { story: 'x'.repeat(2001) }]) {
    await assert.rejects(StoryClient.generate({ endpoint: 'https://story.example/api/story',
      sceneId: 'beach', completedTaskIds: [], accessToken: 'classroom-test-code',
      fetchImpl: async () => new Response(JSON.stringify(data)) }));
  }
});
