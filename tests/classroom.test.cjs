const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Model = require('../js/classroom-model.js');
const scenes = { beach: { name: 'Beach', tasks: [{ id: 'shell', name: 'Shell', instruction: 'Draw a shell' }, { id: 'wave', name: 'Wave' }] } };
const plan = extra => Model.plan({ sceneId: 'beach', name: 'Activity', goal: 'Try a shape', taskIds: ['shell', 'wave'], ...extra }, scenes);

test('plans preserve teacher order and reject unknown or duplicate tasks', () => {
  assert.deepEqual(plan({ taskIds: ['wave', 'unknown', 'shell', 'wave'] }).taskIds, ['wave', 'shell']);
  assert.equal(plan({ taskIds: [] }), null);
  assert.equal(Model.plan({ sceneId: '__proto__', taskIds: ['shell'] }, scenes), null);
});

test('custom instructions are copied, bounded and limited to selected tasks', () => {
  const input = { shell: [' A ', '', 'B', ...Array(8).fill('x'.repeat(200))], wave: ['Other'] };
  const result = plan({ taskIds: ['shell'], steps: input, name: 'x'.repeat(100) });
  assert.equal(result.name.length, 80);
  assert.equal(result.steps.shell.length, 6);
  assert.equal(result.steps.shell[0], 'A');
  assert.equal(result.steps.shell.at(-1).length, 140);
  assert.equal(result.steps.wave, undefined);
  input.shell[0] = 'Changed';
  assert.equal(result.steps.shell[0], 'A');
});

test('guidance chooses teacher steps and does not mutate the authored defaults', () => {
  const defaults = { shell: ['One', 'Two'] };
  const selected = Model.steps(scenes.beach.tasks[0], null, defaults);
  selected[0] = 'Changed';
  assert.equal(defaults.shell[0], 'One');
  assert.deepEqual(Model.steps(scenes.beach.tasks[0], plan({ steps: { shell: ['Custom'] } }), defaults), ['Custom']);
});

test('new activities start at zero even when prior artwork exists', () => {
  const session = Model.session(plan(), 'local-session', 1000);
  assert.deepEqual(Model.summary(session), { completed: 0, total: 2, penSeconds: 0, helps: 0 });
  session.metrics.shell.completed = true;
  session.metrics.shell.penMs = 1600;
  session.metrics.shell.helps = 2;
  assert.deepEqual(Model.summary(session), { completed: 1, total: 2, penSeconds: 2, helps: 2 });
});

test('restoration validates timestamps and clamps untrusted metrics', () => {
  const input = Model.session(plan(), 'local-session', 1000);
  input.metrics.shell = { strokes: -1, penMs: Infinity, helps: 99999999, step: 30, completed: 'yes' };
  input.metrics.unknown = { completed: true };
  const result = Model.restoreSession(input, scenes);
  assert.equal(result.metrics.shell.strokes, 0);
  assert.equal(result.metrics.shell.penMs, 0);
  assert.equal(result.metrics.shell.helps, 100000);
  assert.equal(result.metrics.shell.step, 5);
  assert.equal(result.metrics.shell.completed, false);
  assert.equal(result.metrics.unknown, undefined);
  assert.equal(Model.restoreSession({ ...input, startedAt: NaN }, scenes), null);
  assert.equal(Model.restoreSession({ ...input, startedAt: 9e16 }, scenes), null);
});

test('CSV includes only selected task metrics and escapes formula-like teacher input', () => {
  const session = Model.session(plan({ name: '=SUM(1,2)', goal: 'line one\n"two"', taskIds: ['shell'] }), 'local', 1000);
  session.endedAt = 2000;
  const csv = Model.csv(session, scenes);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"line one\n""two"""'));
  assert.ok(csv.includes('pen_contact_seconds'));
  assert.ok(!csv.includes('data:image'));
  assert.ok(!csv.includes('"Wave"'));
});

function runtime() {
  let time = 0;
  const data = new Map();
  const nodes = new Map();
  const context = vm.createContext({
    ClassroomModel: Model, ClassroomLabels: { saved: 'Saved' }, scenes,
    appState: { currentScene: 'beach', currentTask: { id: 'shell' } },
    performance: { now: () => time },
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
    localStorage: { setItem: (key, value) => data.set(key, value) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'classroom.js'), 'utf8'), context);
  context.input = Model.session(plan(), 'local', 1000);
  vm.runInContext('classroomState.current = input', context);
  return { context, run: code => vm.runInContext(code, context), advance: value => { time += value; }, data };
}

test('pen time counts contact only and ending a stroke twice does not double-count', () => {
  const r = runtime();
  r.advance(30000);
  r.run('classroomStrokeStart()');
  r.advance(1500);
  r.run('classroomStrokeEnd(); classroomStrokeEnd()');
  r.advance(60000);
  assert.equal(r.run('classroomState.current.metrics.shell.penMs'), 1500);
  assert.equal(r.run('classroomState.current.metrics.shell.strokes'), 1);
  assert.equal(r.data.size, 1);
});

test('help counters and completion are scoped to the planned task', () => {
  const r = runtime();
  r.run('classroomCount("helps"); classroomTaskCompleted(); classroomTaskCompleted()');
  assert.equal(r.run('ClassroomModel.summary(classroomState.current).completed'), 1);
  assert.equal(r.run('classroomState.current.metrics.shell.helps'), 1);
  r.context.appState.currentTask.id = 'unknown';
  r.run('classroomStrokeStart(); classroomCount("helps"); classroomTaskCompleted()');
  r.advance(5000);
  r.run('classroomStrokeEnd()');
  assert.equal(r.run('classroomState.current.metrics.shell.penMs'), 0);
  assert.equal(r.run('classroomState.current.metrics.shell.helps'), 1);
});

test('every built-in task has short, authored step guidance', () => {
  const context = vm.createContext({});
  const root = path.join(__dirname, '..', 'js');
  vm.runInContext(fs.readFileSync(path.join(root, 'scenes.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'classroom-data.js'), 'utf8'), context);
  const tasks = vm.runInContext('Object.values(scenes).flatMap(scene => scene.tasks).map(task => ({ id: task.id, steps: drawingGuides[task.id] }))', context);
  assert.ok(tasks.length >= 30);
  for (const task of tasks) {
    assert.ok(task.steps?.length >= 2 && task.steps.length <= 6, task.id);
    assert.ok(task.steps.every(step => typeof step === 'string' && step.length > 0 && step.length <= 140), task.id);
  }
});
