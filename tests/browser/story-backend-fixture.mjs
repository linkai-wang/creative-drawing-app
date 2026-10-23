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
    if (payload.tools) {
      const requirement = JSON.parse(payload.messages[1].content).requirements;
      const results = payload.messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
      const inspected = results.some(result => result.tasks);
      const needsRepair = requirement.includes('repair-example') && !results.some(result => result.ok === false);
      const plan = { name: requirement.includes('<img') ? '<img src=x onerror=alert(1)>' : 'Agent beach activity',
        goal: 'Practice simple shapes', sceneId: 'beach', taskIds: ['shell', 'wave'],
        steps: { shell: ['Draw a curve', 'Add lines', 'Add color'], wave: ['Draw a wave', 'Add a curve', 'Add color'] },
        quiet: true, simpleTools: true };
      const name = inspected ? 'create_plan_draft' : 'get_tasks';
      const args = inspected ? needsRepair ? { ...plan, taskIds: ['invented'] } : plan : { sceneId: 'beach' };
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: {
        tool_calls: [{ id: `call_${results.length}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
      } }] }));
    }
    const tasks = JSON.parse(payload.messages[1].content).completedTasks;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: `A classroom adventure with ${tasks.length} completed tasks. <img src=x onerror=alert(1)>`
    } }] }));
  }
});
server.listen(8787, '127.0.0.1');
process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
