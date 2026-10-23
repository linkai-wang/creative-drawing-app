const test = require('node:test');
const assert = require('node:assert/strict');
const scenes = require('../js/scenes.js');
const LessonPlan = require('../js/lesson-plan.js');
const plan = () => ({ name: 'Beach activity', goal: 'Practice simple shapes', sceneId: 'beach',
  taskIds: ['shell', 'wave'], steps: { shell: ['Draw a curve', 'Add lines', 'Add color'],
    wave: ['Draw a wave', 'Add another curve', 'Add color'] }, quiet: true, simpleTools: true });
const input = { request: 'Two beach tasks, three short steps each.', sceneId: 'forest' };
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const reply = (...calls) => ({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: calls } }] });

test('AI drafts are validated strictly instead of silently dropping unknown tasks or long steps', () => {
  const valid = plan();
  assert.equal(LessonPlan.validate(valid, scenes).ok, true);
  for (const value of [null, [], { ...valid, taskIds: ['invented'] }, { ...valid, taskIds: ['shell', 'shell'] },
    { ...valid, taskIds: ['shell', {}, 'wave'] }, { ...valid, sceneId: '__proto__' },
    { ...valid, goal: '' }, { ...valid, name: 'x'.repeat(81) }, { ...valid, quiet: 'true' },
    { ...valid, steps: { shell: ['x'.repeat(141)], wave: ['ok'] } },
    { ...valid, steps: { shell: ['ok'] } }, { ...valid, steps: { ...valid.steps, invented: ['ok'] } },
    { ...valid, runActivity: true }]) assert.equal(LessonPlan.validate(value, scenes).ok, false);
  const checked = LessonPlan.validate(valid, scenes);
  checked.plan.steps.shell[0] = 'Changed';
  assert.equal(valid.steps.shell[0], 'Draw a curve');
});

test('a model-selected task query and draft submission produce a reviewable plan', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let turns = 0;
  const result = await runLessonAgent({ input, complete: async ({ messages, tools }) => {
    assert.deepEqual(tools.map(item => item.function.name), ['get_tasks', 'create_plan_draft']);
    if (turns++ === 0) return reply(tool('lookup', 'get_tasks', { sceneId: 'beach' }));
    const catalogue = JSON.parse(messages.at(-1).content);
    assert.ok(catalogue.tasks.some(task => task.id === 'shell'));
    assert.ok(catalogue.tasks.every(task => !Object.hasOwn(task, 'references')));
    return reply(tool('draft', 'create_plan_draft', plan()));
  } });
  assert.equal(turns, 2);
  assert.deepEqual(result.plan, plan());
  assert.deepEqual(result.actions, [{ tool: 'get_tasks', ok: true }, { tool: 'create_plan_draft', ok: true }]);
  assert.equal(Object.hasOwn(result, 'reasoning_content'), false);
});

test('the agent receives validation feedback and fixes an invented task', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let turns = 0;
  const result = await runLessonAgent({ input, complete: async ({ messages }) => {
    turns++;
    if (turns === 1) return reply(tool('lookup', 'get_tasks', { sceneId: 'beach' }));
    if (turns === 2) return reply(tool('bad', 'create_plan_draft', { ...plan(), taskIds: ['invented'] }));
    const feedback = JSON.parse(messages.at(-1).content);
    assert.equal(feedback.ok, false);
    assert.ok(feedback.errors.some(error => error.includes('taskIds')));
    return reply(tool('fixed', 'create_plan_draft', plan()));
  } });
  assert.equal(turns, 3);
  assert.equal(result.actions[1].ok, false);
  assert.deepEqual(result.plan.taskIds, ['shell', 'wave']);
});

test('task results must be read in a previous turn before a draft is accepted', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let turns = 0;
  const result = await runLessonAgent({ input, complete: async ({ messages }) => {
    if (turns++ === 0) return reply(tool('lookup', 'get_tasks', { sceneId: 'beach' }), tool('too_early', 'create_plan_draft', plan()));
    assert.equal(JSON.parse(messages.at(-1).content).ok, false);
    return reply(tool('after_reading', 'create_plan_draft', plan()));
  } });
  assert.deepEqual(result.actions.map(action => action.ok), [true, false, true]);
});

test('malformed tool arguments are repairable without executing arbitrary code', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let turns = 0;
  const result = await runLessonAgent({ input, complete: async ({ messages }) => {
    turns++;
    if (turns === 1) return reply({ id: 'broken', type: 'function', function: { name: 'get_tasks', arguments: '{' } });
    if (turns === 2) {
      assert.equal(JSON.parse(messages.at(-1).content).ok, false);
      return reply(tool('lookup', 'get_tasks', { sceneId: 'beach' }));
    }
    return reply(tool('draft', 'create_plan_draft', plan()));
  } });
  assert.equal(result.actions[0].ok, false);
  assert.equal(result.actions.at(-1).ok, true);
});

test('invalid teacher input never invokes the model', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  for (const value of [{ ...input, request: '' }, { ...input, request: 'x'.repeat(501) },
    { ...input, sceneId: '__proto__' }, { ...input, model: 'other' }, { ...input, image: 'private-image' }]) {
    await assert.rejects(runLessonAgent({ input: value, complete: () => { throw new Error('must not run'); } }), error => error.status === 400);
  }
});

test('four model turns bound unknown tools and repeated validation failures', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let calls = 0;
  await assert.rejects(runLessonAgent({ input, complete: async () => {
    calls++;
    return reply(tool(`unknown_${calls}`, 'execute_code', { command: 'do not execute' }));
  } }), error => error.status === 422 && error.code === 'agent_limit');
  assert.equal(calls, 4);
});

test('tool-call count, duplicate IDs and plain prose cannot bypass the draft contract', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  await assert.rejects(runLessonAgent({ input, complete: async () => ({ choices: [
    { finish_reason: 'stop', message: { content: JSON.stringify(plan()) } }
  ] }) }), error => error.status === 422);
  await assert.rejects(runLessonAgent({ input, complete: async () => reply(
    tool('a', 'get_tasks', { sceneId: 'beach' }), tool('b', 'get_tasks', { sceneId: 'beach' }), tool('c', 'get_tasks', { sceneId: 'beach' })
  ) }), error => error.status === 422);
  await assert.rejects(runLessonAgent({ input, complete: async () => reply(tool('same_id', 'get_tasks', { sceneId: 'beach' })) }), error => error.status === 502);
});

test('cancellation prevents a late provider reply from becoming a draft', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  const controller = new AbortController();
  await assert.rejects(runLessonAgent({ input, signal: controller.signal, complete: async () => {
    controller.abort();
    return reply(tool('late', 'create_plan_draft', plan()));
  } }), error => error.name === 'AbortError');
});

test('provider errors do not trigger automatic paid retries', async () => {
  const { runLessonAgent } = await import('../backend/lesson-agent.mjs');
  let calls = 0;
  await assert.rejects(runLessonAgent({ input, complete: async () => { calls++; throw new Error('unavailable'); } }));
  assert.equal(calls, 1);
});

test('lesson client derives the endpoint from the existing story backend', () => {
  const client = require('../js/lesson-client.js');
  const location = { href: 'https://example.github.io/app/', protocol: 'https:' };
  assert.equal(client.endpoint({ storyApiEndpoint: 'https://backend.example/api/story' }, location), 'https://backend.example/api/lesson-plan');
  assert.equal(client.endpoint({}, location), null);
  assert.throws(() => client.endpoint({ lessonApiEndpoint: 'https://user:secret@example/api/lesson-plan' }, location));
});

test('lesson client sends only requirements and revalidates a server draft', async () => {
  const client = require('../js/lesson-client.js');
  const generate = fetchImpl => client.generate({ url: 'https://backend.example/api/lesson-plan', ...input,
    accessToken: 'test-classroom-code', scenes, fetchImpl });
  const valid = { plan: plan(), actions: [{ tool: 'get_tasks', ok: true }, { tool: 'create_plan_draft', ok: true }] };
  const result = await generate(async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), input);
    assert.equal(options.credentials, 'omit');
    return new Response(JSON.stringify(valid));
  });
  assert.deepEqual(result, valid);
  for (const data of [{ ...valid, plan: { ...plan(), taskIds: ['invented'] } }, { ...valid, actions: [] }]) {
    await assert.rejects(generate(async () => new Response(JSON.stringify(data))));
  }
  await assert.rejects(generate(async () => new Response('private provider message', { status: 401 })), error => {
    assert.equal(error.status, 401); assert.ok(!error.message.includes('private')); return true;
  });
});
