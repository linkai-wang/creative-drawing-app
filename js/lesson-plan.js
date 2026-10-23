// Strict validation for AI drafts; the manual classroom model also repairs old saved data.
(function (root) {
  const model = typeof module !== 'undefined' && module.exports ? require('./classroom-model.js') : root.ClassroomModel;
  const fields = ['name', 'goal', 'sceneId', 'taskIds', 'steps', 'quiet', 'simpleTools'];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function validate(input, scenes) {
    const errors = [];
    if (!object(input)) return { ok: false, errors: ['plan must be an object'] };
    if (Object.keys(input).some(key => !fields.includes(key))) errors.push('unknown plan fields');
    for (const [key, max] of [['name', 80], ['goal', 160]]) {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].trim().length > max) errors.push(`${key}: require 1-${max} characters`);
    }
    const scene = typeof input.sceneId === 'string' && own(scenes, input.sceneId) ? scenes[input.sceneId] : null;
    if (!scene) errors.push('sceneId: use an existing scene');
    const ids = input.taskIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4 || new Set(ids).size !== ids.length ||
        ids.some(id => typeof id !== 'string' || !scene?.tasks.some(task => task.id === id))) errors.push('taskIds: select 1-4 unique tasks from this scene');
    if (!object(input.steps)) errors.push('steps: require an object');
    else if (Array.isArray(ids)) {
      if (Object.keys(input.steps).some(id => !ids.includes(id))) errors.push('steps: include selected tasks only');
      for (const id of ids.slice(0, 4).filter(id => typeof id === 'string')) {
        const lines = input.steps[id];
        if (!own(input.steps, id) || !Array.isArray(lines) || lines.length < 1 || lines.length > 6 ||
            lines.some(line => typeof line !== 'string' || !line.trim() || line.trim().length > 140)) {
          errors.push('steps: each selected task needs 1-6 nonempty steps, each at most 140 characters');
        }
      }
    }
    if (typeof input.quiet !== 'boolean' || typeof input.simpleTools !== 'boolean') errors.push('quiet and simpleTools must be booleans');
    return errors.length ? { ok: false, errors } : { ok: true, plan: model.plan(input, scenes) };
  }
  const api = { validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LessonPlan = api;
})(globalThis);
