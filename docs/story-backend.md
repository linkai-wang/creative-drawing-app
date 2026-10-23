# Story backend

The drawing interface stays on GitHub Pages. A separate Node.js 24 service receives structured story requests and calls DeepSeek. It has no runtime dependencies or database. The same service now includes a small lesson-planning agent; see [its design](lesson-agent.md).

## What is ready

- `backend/story-server.mjs`: an independent HTTP service with `POST /api/story`, `POST /api/lesson-plan` and `GET /healthz`.
- `js/story-client.js` and `js/story.js`: the browser connection, teacher access-code form, text rendering, retry and cancellation.
- `render.yaml`: a deployment template for a separate service.
- `backend/.env.example`: local environment configuration without credentials.

No production backend URL or real model credentials are included. `js/config.js` leaves the public site disconnected until the owner deploys the service and supplies its URL. A successful health check proves the HTTP process is running; it does not prove a model key is configured or funded.

## Deploy on Render

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/linkai-wang/creative-drawing-app). Sign in and review the single web service defined in `render.yaml`.
2. Supply your own `DEEPSEEK_API_KEY` in Render's private environment settings. Never paste it into GitHub, `js/config.js`, a frontend form, or a chat message.
3. Deploy the service. Render generates a separate `STORY_ACCESS_TOKEN`. Copy that value from the service's environment settings when a teacher needs the story access code. This is a classroom pilot access code, not the model API key.
4. Open the service's `/healthz` address and check for `{"status":"ok"}`.
5. In `js/config.js`, replace `null` with the service's HTTPS story URL, for example `"https://YOUR-SERVICE.onrender.com/api/story"`. Commit that public URL and wait for GitHub Pages to deploy.
6. Open the drawing website, enter a scene, choose **AI讲故事**, and enter the story access code. Check a real story on the target device before classroom use.

The template selects Render's free compute plan. Account eligibility, current limits and cold-start behavior depend on Render; model usage is billed separately by the model provider. Automatic deploys are off in the template so an upstream source push does not deploy every copy. Use a manual deployment after source changes, or deliberately enable deployment after CI checks for your own service.

If the button cannot connect your repository, create a Node web service from this repository manually. Use build command `node --check backend/story-server.mjs`, start command `node backend/story-server.mjs`, Node.js 24, host `0.0.0.0`, and the environment values from `render.yaml`. The host supplies `PORT`.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and fill in your private model key.
2. Generate an independent random classroom code with `node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"`. Put it in `STORY_ACCESS_TOKEN` in the local environment file.
3. From the repository root run `npm run start:backend`, or `node --env-file=backend/.env backend/story-server.mjs`.
4. In another terminal serve the website with `python -m http.server 8000`.
5. Temporarily set `storyApiEndpoint` in `js/config.js` to `"http://127.0.0.1:8787/api/story"` and visit `http://127.0.0.1:8000/`. Restore the production URL or `null` before committing.

Local environment files are ignored by Git. The backend serves API routes only and never serves repository files, including `.env`.

## Environment

| Name | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | Required private provider credential. |
| `STORY_ACCESS_TOKEN` | Required independent classroom code for stories and lesson drafts, 16–256 characters. Rotate it if it is shared unintentionally. |
| `DEEPSEEK_MODEL` | Server-controlled model ID; defaults to `deepseek-flash`. |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, without paths or trailing slashes. Defaults to `https://linkai-wang.github.io`. Local HTTP origins must be loopback hosts. Wildcards are rejected. |
| `HOST` | `127.0.0.1` locally; `0.0.0.0` on the hosting provider. |
| `PORT` | `8787` locally; supplied by the hosting provider in production. |

The classroom code must differ from the provider key. The app holds the code only in page memory, so a reload requires re-entry. It does not store the code in browser storage or source configuration. This shared code suits a small teacher-led pilot; it does not identify individual teachers or students. CORS restricts browser origins and is not authentication. Other GitHub Pages repositories under the same user share an origin; the independent access code is still required.

## Request and response

The frontend sends an `Authorization: Bearer <classroom-code>` header and JSON:

```json
{"sceneId":"beach","completedTaskIds":["shell"]}
```

The server validates both fields against the same authored catalogue used by the frontend (`js/scenes.js`). Unknown fields, invented task IDs and duplicates are rejected. Clients cannot select a provider URL, model, prompt, output limit or image input. Valid requests return:

```json
{"story":"The generated story text."}
```

For stories, the server supplies the prompt, a fixed DeepSeek endpoint, a 500-token output limit, non-thinking mode, and a 35-second provider timeout. Lesson planning shares the authentication and rate controls, and uses up to four model turns with a 60-second total deadline and 2,000 output tokens per turn. It rejects empty, malformed, oversized and incomplete provider responses. No automatic retries are made against a paid API. The browser has a 90-second deadline to allow for a hosting cold start; it prevents late responses from replacing another scene's content or speaking after navigation.

The model receives the scene name and names of completed tasks. It receives no drawing image, child identity, reference upload or activity report. A composed drawing remains a browser preview. Stories are fictional and cannot establish drawing quality or classroom outcomes. The prompt explicitly avoids pretending to inspect colors, lines or composition.

## Request controls and data

The backend requires a classroom code and an allowed origin, accepts at most 4 KiB of input, and allows at most 10 accepted generation requests per minute and two concurrent provider requests per process. It limits provider responses to 64 KiB and story text to 2,000 characters. These memory-based limits reset on restart and are separate for each server instance. They are not a guaranteed spending ceiling; configure provider account budgets and use shared quotas before scaling the pilot.

Model errors are mapped to short error codes without returning provider bodies, credentials or stack traces. The app does not log or persist prompts, stories or access codes. The model and hosting providers still process requests under their own policies. The server returns `Cache-Control: no-store`.

| Status | Meaning |
| --- | --- |
| `400`, `413`, `415` | Invalid, oversized or non-JSON input. |
| `401`, `403` | Incorrect classroom code or disallowed origin. |
| `408` | Request body took too long. |
| `429` | Process request or concurrency limit reached. |
| `502`, `503`, `504` | Invalid/unavailable model response, missing configuration, provider busy, or timeout. |

## Verification

Run `node --test tests/*.test.cjs` with Node.js 24. Backend tests start a real local HTTP server with a fake provider; they check routing, CORS, authentication, input validation, request limits, timeouts, cancellation and sanitized failures. Client tests check the request contract and endpoint rules.

The Chromium workflow starts a separate deterministic story backend on port 8787. Desktop and phone scenarios exercise real cross-origin requests, password re-entry, safe text display, retry and stale-response behavior. All test credentials are fake. These checks do not contact or pay DeepSeek and do not validate its real output quality. Real provider and teacher checks remain pending until production configuration is supplied.

## References

- [DeepSeek model IDs](https://api-docs.deepseek.com/quick_start/pricing/)
- [DeepSeek thinking-mode switch](https://api-docs.deepseek.com/guides/thinking_mode/)
- [Render Node deployment](https://render.com/docs/deploy-node-express-app)
- [Render Blueprint environment and secret configuration](https://render.com/docs/blueprint-spec)

The default model ID was checked against the official documentation on 2026-10-17. The older frontend's `deepseek-chat` setting is removed; provider settings now belong to the server.
