// Teacher-configured activities, explicit guidance, and local anonymous records.
// Loaded before scene.js/drawing.js; UI setup runs after application startup.
const CLASSROOM_STORAGE_KEY = 'creative-classroom:v1';
let classroomState = { lastPlan: null, current: null, history: [] };
let classroomDraft = null;
let classroomReportId = null;
let classroomGuideIndex = 0;
let classroomPenStart = null;

const classroomNode = id => document.getElementById(id);

function classroomPersist() {
  try {
    localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify({ version: 1, ...classroomState }));
    classroomNode('classroom-storage-status').textContent = ClassroomLabels.saved;
    return true;
  } catch (error) {
    classroomNode('classroom-storage-status').textContent = ClassroomLabels.notSaved;
    return false;
  }
}

function classroomLoad() {
  try {
    const raw = localStorage.getItem(CLASSROOM_STORAGE_KEY);
    if (!raw || raw.length > 200000) return;
    const value = JSON.parse(raw);
    if (value.version !== 1) return;
    classroomState.lastPlan = ClassroomModel.plan(value.lastPlan, scenes);
    const current = ClassroomModel.restoreSession(value.current, scenes);
    classroomState.current = current && !current.endedAt ? current : null;
    classroomState.history = (Array.isArray(value.history) ? value.history : [])
      .map(item => ClassroomModel.restoreSession(item, scenes)).filter(item => item?.endedAt).slice(0, 15);
  } catch (error) {
    classroomNode('classroom-storage-status').textContent = ClassroomLabels.notSaved;
  }
}

function classroomMetric() {
  const current = classroomState.current;
  return current?.plan.sceneId === appState.currentScene ? current.metrics[appState.currentTask?.id] : null;
}

function classroomStrokeStart() {
  const metric = classroomMetric();
  classroomPenStart = metric ? { metric, time: performance.now() } : null;
}

function classroomStrokeEnd() {
  if (!classroomPenStart) return;
  const { metric, time } = classroomPenStart;
  classroomPenStart = null;
  metric.strokes = Math.min(100000, metric.strokes + 1);
  metric.penMs = Math.min(86400000, metric.penMs + Math.max(0, performance.now() - time));
  classroomPersist();
}

function classroomCount(field) {
  const metric = classroomMetric();
  if (!metric || !['undos', 'helps', 'narrations'].includes(field)) return;
  metric[field] = Math.min(100000, metric[field] + 1);
  classroomPersist();
}

function classroomTaskCompleted() {
  const metric = classroomMetric();
  if (!metric) return;
  metric.completed = true;
  classroomPersist();
  classroomRenderBanner();
}

function classroomTasksForScene(scene) {
  const plan = classroomState.current?.plan;
  return plan && scenes[plan.sceneId] === scene ? plan.taskIds.map(id => scene.tasks.find(task => task.id === id)) : scene.tasks;
}

function classroomProgress(scene) {
  const current = classroomState.current;
  return current && scenes[current.plan.sceneId] === scene ? ClassroomModel.summary(current) : null;
}

function classroomQuiet() {
  return classroomState.current?.plan.quiet === true || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function classroomApplyPreferences() {
  document.body.classList.toggle('classroom-quiet', classroomState.current?.plan.quiet === true);
  document.body.classList.toggle('classroom-simple', classroomState.current?.plan.simpleTools === true);
}

function classroomRenderBanner() {
  const banner = classroomNode('classroom-banner');
  const current = classroomState.current;
  banner.hidden = !current;
  if (current) {
    const result = ClassroomModel.summary(current);
    classroomNode('classroom-banner-title').textContent = current.plan.name;
    classroomNode('classroom-banner-goal').textContent = ClassroomLabels.goalPrefix + current.plan.goal;
    classroomNode('classroom-banner-progress').textContent = `${ClassroomLabels.completed} ${result.completed}/${result.total}`;
  }
  classroomNode('classroom-finish').disabled = !current;
  classroomNode('classroom-start').disabled = Boolean(current);
}

function classroomTaskSteps(task) {
  const plan = classroomState.current?.plan;
  return ClassroomModel.steps(task, plan?.sceneId === appState.currentScene ? plan : null, drawingGuides);
}

function classroomRenderGuide() {
  const task = appState.currentTask;
  if (!task) return;
  const steps = classroomTaskSteps(task);
  classroomGuideIndex = Math.max(0, Math.min(steps.length - 1, classroomGuideIndex));
  elements.teacherInstructions.textContent = steps[classroomGuideIndex];
  classroomNode('guide-position').textContent = `${ClassroomLabels.step} ${classroomGuideIndex + 1} / ${steps.length}`;
  classroomNode('guide-previous').disabled = classroomGuideIndex === 0;
  classroomNode('guide-next').disabled = classroomGuideIndex === steps.length - 1;
  const metric = classroomMetric();
  if (metric) metric.step = classroomGuideIndex;
}

function classroomOnTaskStart(task) {
  classroomGuideIndex = classroomMetric()?.step || 0;
  classroomRenderGuide();
  if (classroomState.current?.plan.simpleTools) {
    document.querySelector('.brush-btn[data-brush="fineliner"]')?.click();
  }
}

function classroomButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'classroom-button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function classroomReadDraftSteps() {
  classroomNode('classroom-task-picker').querySelectorAll('textarea[data-task]').forEach(input => {
    classroomDraft.steps[input.dataset.task] = input.value.split('\n');
  });
}

function classroomRenderPlanner() {
  const container = classroomNode('classroom-task-picker');
  container.replaceChildren();
  const scene = scenes[classroomDraft.sceneId];
  const ordered = [...classroomDraft.taskIds, ...scene.tasks.map(task => task.id).filter(id => !classroomDraft.taskIds.includes(id))];
  for (const id of ordered) {
    const task = scene.tasks.find(task => task.id === id);
    const index = classroomDraft.taskIds.indexOf(id);
    const row = document.createElement('div');
    row.className = 'classroom-task-row';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = index >= 0;
    checkbox.dataset.task = id;
    const name = document.createElement('span');
    name.textContent = (index >= 0 ? `${index + 1}. ` : '') + task.name;
    label.append(checkbox, name);
    row.append(label);
    checkbox.addEventListener('change', () => {
      classroomReadDraftSteps();
      if (checkbox.checked && classroomDraft.taskIds.length >= 8) { checkbox.checked = false; return; }
      classroomDraft.taskIds = checkbox.checked ? [...classroomDraft.taskIds, id] : classroomDraft.taskIds.filter(item => item !== id);
      classroomRenderPlanner();
      classroomNode('classroom-task-picker').querySelector(`input[data-task="${id}"]`)?.focus();
    });
    if (index >= 0) {
      const controls = document.createElement('div');
      controls.className = 'classroom-row-actions';
      for (const [labelText, direction] of [[ClassroomLabels.up, -1], [ClassroomLabels.down, 1]]) {
        const button = classroomButton(labelText, () => {
          classroomReadDraftSteps();
          const target = index + direction;
          [classroomDraft.taskIds[index], classroomDraft.taskIds[target]] = [classroomDraft.taskIds[target], classroomDraft.taskIds[index]];
          classroomRenderPlanner();
        });
        button.setAttribute('aria-label', task.name + ' ' + labelText);
        button.disabled = index + direction < 0 || index + direction >= classroomDraft.taskIds.length;
        controls.append(button);
      }
      row.append(controls);
      const stepLabel = document.createElement('label');
      stepLabel.className = 'classroom-steps-label';
      stepLabel.textContent = ClassroomLabels.steps;
      const input = document.createElement('textarea');
      input.dataset.task = id;
      input.rows = 3;
      input.maxLength = 900;
      input.value = (classroomDraft.steps[id] || drawingGuides[id] || [task.instruction]).join('\n');
      stepLabel.append(input);
      row.append(stepLabel);
    }
    container.append(row);
  }
}

function classroomOpen() {
  if (!elements.drawingMode.classList.contains('hidden')) flushDrawingDraft();
  const prior = classroomState.lastPlan;
  const sceneId = prior?.sceneId || appState.currentScene || 'beach';
  classroomDraft = prior ? JSON.parse(JSON.stringify(prior)) : {
    sceneId, taskIds: scenes[sceneId].tasks.slice(0, 2).map(task => task.id), steps: {}
  };
  classroomNode('classroom-name').value = prior?.name || ClassroomLabels.defaultName;
  classroomNode('classroom-goal').value = prior?.goal || ClassroomLabels.defaultGoal;
  classroomNode('classroom-scene').value = sceneId;
  classroomNode('classroom-quiet').checked = prior?.quiet ?? true;
  classroomNode('classroom-simple').checked = prior?.simpleTools ?? true;
  classroomRenderPlanner();
  classroomRenderBanner();
  classroomRenderReport();
  lessonAgentReset();
  classroomNode('classroom-dialog').showModal();
}

function classroomApplyAgentDraft(input) {
  if (classroomState.current) return false;
  const checked = LessonPlan.validate(input, scenes);
  if (!checked.ok) return false;
  const plan = checked.plan;
  classroomDraft = JSON.parse(JSON.stringify(plan));
  classroomNode('classroom-name').value = plan.name;
  classroomNode('classroom-goal').value = plan.goal;
  classroomNode('classroom-scene').value = plan.sceneId;
  classroomNode('classroom-quiet').checked = plan.quiet;
  classroomNode('classroom-simple').checked = plan.simpleTools;
  classroomNode('classroom-plan-status').textContent = '';
  classroomRenderPlanner();
  classroomState.lastPlan = JSON.parse(JSON.stringify(plan));
  classroomPersist();
  return true;
}

function classroomStart() {
  if (classroomState.current) { showToast(ClassroomLabels.activeExists, 'warning'); return; }
  classroomReadDraftSteps();
  const invalidSteps = classroomDraft.taskIds.some(id => {
    const lines = (classroomDraft.steps[id] || []).map(line => line.trim()).filter(Boolean);
    return lines.length > 6 || lines.some(line => line.length > 140);
  });
  if (invalidSteps) { classroomNode('classroom-plan-status').textContent = ClassroomLabels.invalidSteps; return; }
  const plan = ClassroomModel.plan({ ...classroomDraft,
    name: classroomNode('classroom-name').value, goal: classroomNode('classroom-goal').value,
    quiet: classroomNode('classroom-quiet').checked, simpleTools: classroomNode('classroom-simple').checked
  }, scenes);
  if (!plan) { classroomNode('classroom-plan-status').textContent = ClassroomLabels.noTasks; return; }
  classroomNode('classroom-plan-status').textContent = '';
  classroomState.lastPlan = plan;
  classroomState.current = ClassroomModel.session(plan, crypto.randomUUID(), Date.now());
  classroomReportId = classroomState.current.id;
  const saved = classroomPersist();
  classroomApplyPreferences();
  classroomRenderBanner();
  classroomNode('classroom-dialog').close();
  switchToScene(plan.sceneId);
  showToast(saved ? ClassroomLabels.started : ClassroomLabels.notSaved, saved ? 'success' : 'warning');
}

function classroomFinish() {
  if (!classroomState.current) return;
  flushDrawingDraft();
  classroomState.current.endedAt = Date.now();
  classroomReportId = classroomState.current.id;
  classroomState.history.unshift(classroomState.current);
  classroomState.history = classroomState.history.slice(0, 15);
  classroomState.current = null;
  const saved = classroomPersist();
  classroomApplyPreferences();
  classroomRenderBanner();
  classroomRenderReport();
  if (scenes[appState.currentScene]) {
    renderTasks(scenes[appState.currentScene]);
    updateProgress(scenes[appState.currentScene]);
  }
  showToast(saved ? ClassroomLabels.finished : ClassroomLabels.notSaved, saved ? 'success' : 'warning');
}

function classroomReportSessions() {
  return [classroomState.current, ...classroomState.history].filter(Boolean);
}

function classroomSelectedReport() {
  return classroomReportSessions().find(item => item.id === classroomReportId) || classroomReportSessions()[0];
}

function classroomRenderReport() {
  const select = classroomNode('classroom-report-select');
  select.replaceChildren();
  const current = classroomSelectedReport();
  classroomReportId = current?.id || null;
  for (const item of classroomReportSessions()) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.plan.name} · ${new Date(item.startedAt).toLocaleString()} · ${item.endedAt ? ClassroomLabels.ended : ClassroomLabels.ongoing}`;
    select.append(option);
  }
  select.value = classroomReportId || '';
  classroomNode('classroom-report-content').hidden = !current;
  classroomNode('classroom-report-empty').hidden = Boolean(current);
  classroomNode('classroom-report-download').disabled = !current;
  if (!current) return;
  const total = ClassroomModel.summary(current);
  classroomNode('classroom-report-summary').textContent = `${ClassroomLabels.completed} ${total.completed}/${total.total} · ${ClassroomLabels.pen} ${total.penSeconds} · ${ClassroomLabels.helps} ${total.helps}`;
  classroomNode('classroom-report-goal').textContent = ClassroomLabels.goalPrefix + current.plan.goal;
  const body = classroomNode('classroom-report-rows');
  body.replaceChildren();
  for (const taskId of current.plan.taskIds) {
    const metric = current.metrics[taskId];
    const task = scenes[current.plan.sceneId].tasks.find(item => item.id === taskId);
    const row = document.createElement('tr');
    for (const value of [task.name, metric.completed ? ClassroomLabels.yes : ClassroomLabels.no, Math.round(metric.penMs / 1000), metric.strokes, metric.undos, metric.helps, metric.narrations]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
}

function classroomDownloadReport() {
  const current = classroomSelectedReport();
  if (!current) return;
  const url = URL.createObjectURL(new Blob([ClassroomModel.csv(current, scenes)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `drawing-activity-${current.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.csv`;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  showToast(ClassroomLabels.csvStarted, 'success');
}

function setupClassroom() {
  setupLessonAgent();
  classroomLoad();
  const select = classroomNode('classroom-scene');
  for (const [id, scene] of Object.entries(scenes)) {
    const option = document.createElement('option');
    option.value = id; option.textContent = scene.name; select.append(option);
  }
  select.addEventListener('change', () => {
    classroomDraft = { sceneId: select.value, taskIds: scenes[select.value].tasks.slice(0, 2).map(task => task.id), steps: {} };
    classroomRenderPlanner();
  });
  for (const id of ['classroom-open', 'classroom-drawing-open', 'classroom-review']) classroomNode(id).addEventListener('click', classroomOpen);
  classroomNode('classroom-close').addEventListener('click', () => classroomNode('classroom-dialog').close());
  classroomNode('classroom-start').addEventListener('click', classroomStart);
  classroomNode('classroom-finish').addEventListener('click', classroomFinish);
  classroomNode('classroom-return').addEventListener('click', () => {
    if (classroomState.current) switchToScene(classroomState.current.plan.sceneId);
  });
  classroomNode('classroom-report-select').addEventListener('change', event => {
    classroomReportId = event.target.value; classroomRenderReport();
  });
  classroomNode('classroom-report-download').addEventListener('click', classroomDownloadReport);
  for (const [id, delta] of [['guide-previous', -1], ['guide-next', 1]]) {
    classroomNode(id).addEventListener('click', () => {
      stopSpeech(); classroomGuideIndex += delta; classroomRenderGuide(); classroomPersist();
    });
  }
  classroomNode('guide-help').addEventListener('click', () => {
    classroomCount('helps'); showToast(ClassroomLabels.helpToast);
  });
  elements.playInstruction?.addEventListener('click', () => {
    if (isSpeechSupported() && !tts.isPlaying) classroomCount('narrations');
  }, true);
  classroomApplyPreferences();
  classroomRenderBanner();
}
