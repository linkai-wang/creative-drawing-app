# Small lesson-planning agent

Teachers can describe an activity in one sentence inside **AI备课 · Agent** in the existing teacher studio. The model queries the authored task catalogue, writes short steps and submits a validated draft. The teacher reviews the suggestion, clicks **填入课堂草稿**, edits it if needed, and starts the activity using the existing button.

This is one model with two tools and a bounded loop. It uses no agent framework, vector database, cloud memory or student profile.

| Tool | Behavior |
| --- | --- |
| `get_tasks(sceneId)` | Returns real task IDs, names and instructions for a scene. |
| `create_plan_draft(plan)` | Validates a proposed plan and returns either the draft or errors the model can fix. It never starts an activity. |

The agent must read a scene's task results in an earlier model turn before submitting its draft. Invalid task IDs, duplicates, missing steps and excessive text are rejected, rather than silently removed. A successful draft contains 1-4 tasks, each with 1-6 steps of at most 140 characters. The existing classroom plan model is reused after strict validation.

## Backend connection

`POST /api/lesson-plan` is part of the existing Node service in `backend/story-server.mjs`. It uses the same `DEEPSEEK_API_KEY`, independent classroom access code (`STORY_ACCESS_TOKEN`), origin rules and process request limit as story generation. See [backend setup](story-backend.md).

The browser sends only `{ "request": "Two beach tasks with short steps", "sceneId": "beach" }`. The scene is a hint; the teacher can request a different theme. Images, current artwork, activity history and student identities are not sent. Requirements and model messages are not stored by the app. The model provider still processes these requests under its own policies.

The server returns `{ "plan": { ... }, "actions": [ ... ] }`. The short action list reports which tools actually ran and whether their checks passed. It contains no model reasoning or private credentials. Plan text is displayed with `textContent` and revalidated in the browser before it can fill the workbench.

Set `lessonApiEndpoint` in `js/config.js`, or leave it null to derive `/api/lesson-plan` from a configured `/api/story` URL. No new secret or hosting service is needed if the story backend is already running. Without a deployed backend and private model configuration, the panel shows a disconnected message and manual planning remains available. No production model connection is supplied by this source change.

## Limits and teacher control

- At most four model requests and six tool calls per generation, with a 60-second backend deadline. Typical success takes a query and a draft submission. Each model request has a 2,000-token output limit.
- Provider HTTP failures stop the request; only tool validation errors can lead to a model correction. No automatic provider retry is made.
- Closing the workbench or cancelling ignores late responses and aborts the browser request.
- Generation does not alter manual fields. Applying a reviewed draft updates the editable workbench and local last-plan record. A running activity cannot be replaced.
- The access code stays in page memory; it is separate from the provider key and not saved in browser storage. The panel and story page use the same server code but hold their own page-memory copy.

## Verification

`tests/lesson-agent.test.cjs` checks strict plans, real catalogue lookup, correction from tool feedback, the loop budget, invalid tool calls, cancellation, endpoint selection and the client contract. `tests/lesson-backend.test.cjs` checks authenticated HTTP requests, shared rate limits and the lesson deadline.

Desktop and phone-sized Chromium tests use the actual Node backend with a deterministic fake model. They cover preview, explicit application, editing, validation repair, literal text rendering, active-activity protection, wrong codes, disconnected state and cancellation. These tests verify the implementation, not real-model instruction following or classroom benefit. Real-provider and teacher evaluation remain pending.

Reference: [DeepSeek tool calling](https://api-docs.deepseek.com/guides/tool_calls/). The implementation uses non-thinking mode and standard tool results; no model reasoning is shown in the UI.
