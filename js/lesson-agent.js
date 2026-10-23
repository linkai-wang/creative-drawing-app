// A small teacher-facing agent panel; only an explicit Apply changes the classroom draft.
let lessonAgentCandidate = null;
let lessonAgentCode = '';
let lessonAgentController = null;
let lessonAgentRequest = 0;
const lessonNode = id => document.getElementById(id);

function lessonAgentCancel(message = '') {
  lessonAgentRequest++;
  lessonAgentController?.abort();
  lessonAgentController = null;
  lessonNode('lesson-agent-generate').disabled = false;
  lessonNode('lesson-agent-cancel').hidden = true;
  lessonNode('lesson-agent-status').textContent = message;
}

function lessonAgentReset() {
  lessonAgentCancel();
  lessonAgentCandidate = null;
  lessonNode('lesson-agent-preview').hidden = true;
  lessonNode('lesson-agent-preview').replaceChildren();
  lessonNode('lesson-agent-apply').hidden = true;
  lessonNode('lesson-agent-log').replaceChildren();
  try {
    if (!LessonClient.endpoint(window.CREATIVE_DRAWING_CONFIG, window.location)) {
      lessonNode('lesson-agent-status').textContent = 'AI备课服务尚未连接，当前仍可手动安排课堂。';
    }
  } catch { lessonNode('lesson-agent-status').textContent = 'AI备课服务暂时无法连接，请联系开发者。'; }
}

function lessonAgentPreview(result) {
  lessonAgentCandidate = result.plan;
  const plan = result.plan;
  const preview = lessonNode('lesson-agent-preview');
  preview.replaceChildren();
  const heading = document.createElement('h4');
  heading.textContent = plan.name;
  const goal = document.createElement('p');
  goal.textContent = '活动目标：' + plan.goal;
  const settings = document.createElement('p');
  settings.textContent = '场景：' + scenes[plan.sceneId].name + ' · 安静模式：' +
    (plan.quiet ? '开启' : '关闭') + ' · 精简工具：' + (plan.simpleTools ? '开启' : '关闭');
  preview.append(heading, goal, settings);
  for (const id of plan.taskIds) {
    const name = document.createElement('h5');
    name.textContent = scenes[plan.sceneId].tasks.find(task => task.id === id).name;
    const list = document.createElement('ol');
    for (const step of plan.steps[id]) {
      const item = document.createElement('li'); item.textContent = step; list.append(item);
    }
    preview.append(name, list);
  }
  const log = lessonNode('lesson-agent-log');
  log.replaceChildren();
  for (const action of result.actions) {
    const item = document.createElement('li');
    item.textContent = (action.tool === 'get_tasks' ? '查询任务库' :
      action.tool === 'create_plan_draft' ? '检查课堂草稿' : '检查工具调用') +
      (action.ok ? '：通过' : '：收到问题，继续修正');
    log.append(item);
  }
  preview.hidden = false;
  lessonNode('lesson-agent-apply').hidden = false;
  lessonNode('lesson-agent-status').textContent = '建议已生成。请检查任务和步骤，再填入课堂草稿。';
}

async function lessonAgentGenerate() {
  const request = lessonNode('lesson-agent-request').value.trim();
  if (!request || request.length > 500) {
    lessonNode('lesson-agent-status').textContent = '请用一句话描述活动，最多500字。'; return;
  }
  let url;
  try { url = LessonClient.endpoint(window.CREATIVE_DRAWING_CONFIG, window.location); } catch { /* Show a simple connection message. */ }
  if (!url) {
    lessonNode('lesson-agent-status').textContent = 'AI备课服务尚未连接，当前仍可手动安排课堂。'; return;
  }
  const inputCode = lessonNode('lesson-agent-code').value.trim();
  if (inputCode) lessonAgentCode = inputCode;
  lessonNode('lesson-agent-code').value = '';
  if (lessonAgentCode.length < 16 || lessonAgentCode.length > 256) {
    lessonNode('lesson-agent-status').textContent = '请输入老师提供的课堂访问码（与故事功能相同）。'; return;
  }
  lessonAgentReset();
  const id = lessonAgentRequest;
  const controller = new AbortController();
  lessonAgentController = controller;
  lessonNode('lesson-agent-generate').disabled = true;
  lessonNode('lesson-agent-cancel').hidden = false;
  lessonNode('lesson-agent-status').textContent = '正在查询任务并编写课堂草稿……';
  const current = () => id === lessonAgentRequest && lessonNode('classroom-dialog').open;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
  try {
    const result = await LessonClient.generate({ url, request, sceneId: classroomDraft.sceneId,
      accessToken: lessonAgentCode, signal: controller.signal, scenes });
    if (!current()) return;
    lessonAgentPreview(result);
    lessonNode('lesson-agent-code').placeholder = '本页已记住访问码，可留空继续使用';
  } catch (error) {
    if (!current() || (controller.signal.aborted && !timedOut)) return;
    if (error.status === 401) { lessonAgentCode = ''; lessonNode('lesson-agent-code').placeholder = ''; }
    lessonNode('lesson-agent-status').textContent = error.status === 401 ? '访问码不正确或已更新，请向老师确认。' :
      error.status === 429 ? '请求较多，请等一分钟后再试。' :
      error.status === 422 ? '暂时没有得到合适的草稿，请简化要求后重试。' :
      error.status === 503 ? 'AI备课服务暂时不可用，请稍后重试或联系老师。' :
      timedOut || error.status === 504 ? '这次等待较久，请稍后重试。' : '生成没有完成，请检查网络后重试。';
  } finally {
    clearTimeout(timer);
    if (id === lessonAgentRequest) {
      lessonAgentController = null;
      lessonNode('lesson-agent-generate').disabled = false;
      lessonNode('lesson-agent-cancel').hidden = true;
    }
  }
}

function setupLessonAgent() {
  lessonNode('lesson-agent-generate').addEventListener('click', lessonAgentGenerate);
  lessonNode('lesson-agent-cancel').addEventListener('click', () => lessonAgentCancel('已取消，手动草稿没有变化。'));
  lessonNode('lesson-agent-apply').addEventListener('click', () => {
    if (!lessonAgentCandidate) return;
    if (!classroomApplyAgentDraft(lessonAgentCandidate)) {
      lessonNode('lesson-agent-status').textContent = '请先结束当前活动，再填入新的课堂草稿。'; return;
    }
    lessonNode('lesson-agent-status').textContent = '已填入课堂草稿。你可以继续编辑，确认后再开始活动。';
    lessonNode('classroom-name').focus();
  });
  lessonNode('classroom-dialog').addEventListener('close', () => lessonAgentCancel());
  window.addEventListener('pagehide', () => { lessonAgentCancel(); lessonAgentCode = ''; });
}
