// Pure, versioned lesson/session model shared by the UI and regression tests.
(function (root) {
  const own = (object, key) => object && Object.prototype.hasOwnProperty.call(object, key);
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const count = (value, max = 100000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;

  function plan(input, scenes) {
    if (!input || !own(scenes, input.sceneId) || !Array.isArray(input.taskIds)) return null;
    const allowed = new Set(scenes[input.sceneId].tasks.map(task => task.id));
    const taskIds = [...new Set(input.taskIds.filter(id => allowed.has(id)))].slice(0, 8);
    if (!taskIds.length) return null;
    const steps = {};
    for (const id of taskIds) {
      if (Array.isArray(input.steps?.[id])) {
        const lines = input.steps[id].map(line => text(line, 140)).filter(Boolean).slice(0, 6);
        if (lines.length) steps[id] = lines;
      }
    }
    return {
      name: text(input.name, 80) || 'Drawing activity', goal: text(input.goal, 160),
      sceneId: input.sceneId, taskIds, steps,
      quiet: input.quiet === true, simpleTools: input.simpleTools === true
    };
  }

  function steps(task, currentPlan, guides = {}) {
    return currentPlan?.steps?.[task.id]?.slice() || guides[task.id]?.slice() || [task.instruction];
  }

  function session(currentPlan, id, now) {
    return {
      id, plan: currentPlan, startedAt: now, endedAt: null,
      metrics: Object.fromEntries(currentPlan.taskIds.map(taskId => [taskId, {
        strokes: 0, penMs: 0, undos: 0, helps: 0, narrations: 0, completed: false, step: 0
      }]))
    };
  }

  function restoreSession(input, scenes) {
    const currentPlan = plan(input?.plan, scenes);
    if (!currentPlan || typeof input.id !== 'string' || !input.id ||
        !Number.isFinite(input.startedAt) || input.startedAt <= 0 || input.startedAt > 8640000000000000) return null;
    const result = session(currentPlan, input.id.slice(0, 80), input.startedAt);
    if (Number.isFinite(input.endedAt) && input.endedAt >= input.startedAt && input.endedAt <= 8640000000000000) result.endedAt = input.endedAt;
    for (const taskId of currentPlan.taskIds) {
      const value = input.metrics?.[taskId] || {};
      result.metrics[taskId] = {
        strokes: count(value.strokes), penMs: count(value.penMs, 86400000),
        undos: count(value.undos), helps: count(value.helps), narrations: count(value.narrations),
        completed: value.completed === true, step: count(value.step, 5)
      };
    }
    return result;
  }

  function summary(current) {
    const values = Object.values(current.metrics);
    return {
      completed: values.filter(value => value.completed).length,
      total: current.plan.taskIds.length,
      penSeconds: Math.round(values.reduce((sum, value) => sum + value.penMs, 0) / 1000),
      helps: values.reduce((sum, value) => sum + value.helps, 0)
    };
  }

  function csv(current, scenes) {
    const cell = value => {
      const raw = String(value ?? '');
      const safe = /^[\s]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const scene = scenes[current.plan.sceneId];
    const rows = [['activity', 'goal', 'scene', 'task', 'completed', 'pen_contact_seconds', 'strokes', 'undo_actions', 'help_requests', 'narration_requests', 'started_at', 'ended_at']];
    for (const taskId of current.plan.taskIds) {
      const value = current.metrics[taskId];
      rows.push([current.plan.name, current.plan.goal, scene.name, scene.tasks.find(task => task.id === taskId).name,
        value.completed, Math.round(value.penMs / 1000), value.strokes, value.undos, value.helps, value.narrations,
        new Date(current.startedAt).toISOString(), current.endedAt ? new Date(current.endedAt).toISOString() : '']);
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }

  const model = { plan, steps, session, restoreSession, summary, csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.ClassroomModel = model;
})(globalThis);
