// Deterministic CI service. These credentials are test strings, not real secrets.
import { createStoryServer } from '../../backend/story-server.mjs';

const server = createStoryServer({
  env: {
    DEEPSEEK_API_KEY: 'test-provider-key-not-real',
    STORY_ACCESS_TOKEN: 'test-classroom-code-32-characters',
    ALLOWED_ORIGINS: 'http://127.0.0.1:8000'
  },
  requestsPerMinute: 100,
  fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    const tasks = JSON.parse(payload.messages[1].content).completedTasks;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: `A classroom adventure with ${tasks.length} completed tasks. <img src=x onerror=alert(1)>`
    } }] }));
  }
});
server.listen(8787, '127.0.0.1');
process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
