import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import scenes from '../js/scenes.js';

const PROVIDER_URL = 'https://api.deepseek.com/chat/completions';
const MAX_BODY_BYTES = 4096;
const MAX_PROVIDER_BYTES = 65536;
const DEFAULT_ORIGINS = 'https://wanglinkai705-hash.github.io';

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function digest(value) { return createHash('sha256').update(value).digest(); }

function json(res, status, value, extra = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(value));
}

function readBody(req, timeoutMs) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const finish = (error, value) => {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAbort);
      if (error) { req.resume(); reject(error); } else resolve(value);
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) finish(new RequestError(413, 'request_too_large'));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish(new RequestError(400, 'invalid_json')); }
    };
    const onError = () => finish(new RequestError(400, 'invalid_request'));
    const onAbort = () => finish(new RequestError(400, 'request_cancelled'));
    const timer = setTimeout(() => finish(new RequestError(408, 'request_timeout')), timeoutMs);
    timer.unref();
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAbort);
  });
}

export function validateStoryInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['sceneId', 'completedTaskIds'].includes(key)) ||
      typeof input.sceneId !== 'string' || !Object.hasOwn(scenes, input.sceneId) ||
      !Array.isArray(input.completedTaskIds)) throw new RequestError(400, 'invalid_story_input');
  const scene = scenes[input.sceneId];
  const ids = input.completedTaskIds;
  if (ids.length > scene.tasks.length || new Set(ids).size !== ids.length ||
      ids.some(id => typeof id !== 'string' || !scene.tasks.some(task => task.id === id))) {
    throw new RequestError(400, 'invalid_story_input');
  }
  return { scene, completed: scene.tasks.filter(task => ids.includes(task.id)) };
}

export function buildStoryMessages(input) {
  const { scene, completed } = validateStoryInput(input);
  return [
    { role: 'system', content: '\u4f60\u662f\u513f\u7ae5\u7ed8\u753b\u8bfe\u5802\u7684\u6545\u4e8b\u52a9\u624b\u3002\u8bf7\u5199\u4e00\u4e2a150\u5230180\u5b57\u7684\u6e29\u6696\u3001\u7b80\u5355\u7684\u4e2d\u6587\u865a\u6784\u6545\u4e8b\uff0c\u4f7f\u7528\u77ed\u53e5\uff0c\u53ea\u8fd4\u56de\u6545\u4e8b\u6b63\u6587\u3002\u4f60\u53ea\u6536\u5230\u573a\u666f\u548c\u4efb\u52a1\u540d\u79f0\uff0c\u6ca1\u6709\u770b\u5230\u753b\u4f5c\u56fe\u7247\uff1b\u4e0d\u8981\u58f0\u79f0\u770b\u5230\u4e86\u8272\u5f69\u3001\u7ebf\u6761\u6216\u6784\u56fe\uff0c\u4e0d\u8bc4\u5206\u6216\u63a8\u65ad\u513f\u7ae5\u80fd\u529b\u3002\u8ba9\u5df2\u5b8c\u6210\u4efb\u52a1\u4e2d\u7684\u5143\u7d20\u5728\u6545\u4e8b\u91cc\u4e92\u52a8\u3002' },
    { role: 'user', content: JSON.stringify({ scene: scene.name, completedTasks: completed.map(task => task.name) }) }
  ];
}

async function readProviderJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new RequestError(502, 'invalid_provider_response');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROVIDER_BYTES) throw new RequestError(502, 'invalid_provider_response');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof RequestError) throw error;
    throw new RequestError(502, 'invalid_provider_response');
  } finally { reader.releaseLock(); }
}

// One process is sufficient for a small classroom pilot. Limits reset on restart.
export function createStoryServer({ env = process.env, fetchImpl = globalThis.fetch,
  now = Date.now, bodyTimeoutMs = 10000, upstreamTimeoutMs = 35000,
  requestsPerMinute = 10, maxConcurrent = 2 } = {}) {
  const key = typeof env.DEEPSEEK_API_KEY === 'string' ? env.DEEPSEEK_API_KEY.trim() : '';
  const accessToken = typeof env.STORY_ACCESS_TOKEN === 'string' ? env.STORY_ACCESS_TOKEN.trim() : '';
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  const originValues = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(value => value.trim());
  const validOrigins = originValues.length > 0 && originValues.every(value => {
    try {
      const url = new URL(value);
      return value === url.origin && (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
    } catch { return false; }
  });
  const configured = key.length > 0 && !key.includes('replace-with') && accessToken.length >= 16 &&
    accessToken.length <= 256 && !accessToken.includes('replace-with') &&
    accessToken !== key && /^[a-zA-Z0-9._-]{1,80}$/.test(model) && validOrigins;
  const accessDigest = digest(accessToken);
  let windowStart = now();
  let calls = 0;
  let active = 0;

  const server = http.createServer(async (req, res) => {
    // A disconnected/oversized incoming stream can emit an error after cleanup.
    req.on('error', () => {});
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Origin');
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/healthz' && req.method === 'GET') return json(res, 200, { status: 'ok' });
      if (path !== '/api/story') throw new RequestError(404, 'not_found');
      if (!validOrigins || !originValues.includes(req.headers.origin)) throw new RequestError(403, 'origin_not_allowed');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      if (req.method === 'OPTIONS') {
        const requestedHeaders = (req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (req.headers['access-control-request-method'] !== 'POST' ||
            requestedHeaders.some(header => !['authorization', 'content-type'].includes(header))) {
          throw new RequestError(403, 'invalid_preflight');
        }
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        throw new RequestError(405, 'method_not_allowed');
      }
      if (!configured) throw new RequestError(503, 'service_not_configured');
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ') || auth.length > 263 || !timingSafeEqual(digest(auth.slice(7)), accessDigest)) {
        throw new RequestError(401, 'access_denied');
      }
      if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json' ||
          (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
        throw new RequestError(415, 'json_required');
      }
      if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new RequestError(413, 'request_too_large');
      const input = await readBody(req, bodyTimeoutMs);
      const messages = buildStoryMessages(input);
      if (res.destroyed) return;
      if (now() - windowStart >= 60000) { windowStart = now(); calls = 0; }
      if (calls >= requestsPerMinute || active >= maxConcurrent) {
        res.setHeader('Retry-After', '60');
        throw new RequestError(429, 'request_limit');
      }
      calls++;
      active++;
      const controller = new AbortController();
      let timedOut = false;
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.once('close', onClose);
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, upstreamTimeoutMs);
      timer.unref();
      try {
        const upstream = await fetchImpl(PROVIDER_URL, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages, thinking: { type: 'disabled' },
            temperature: 0.7, max_tokens: 500, stream: false })
        });
        if (!upstream.ok) {
          await upstream.body?.cancel().catch(() => {});
          throw new RequestError(upstream.status === 429 ? 503 : 502,
            upstream.status === 429 ? 'provider_busy' : 'provider_unavailable');
        }
        const data = await readProviderJson(upstream);
        const choice = data?.choices?.[0];
        const story = choice?.message?.content;
        if (choice?.finish_reason !== 'stop' || typeof story !== 'string' || !story.trim() || story.length > 2000) {
          throw new RequestError(502, 'invalid_provider_response');
        }
        json(res, 200, { story: story.trim() });
      } catch (error) {
        if (timedOut) throw new RequestError(504, 'provider_timeout');
        if (error instanceof RequestError) throw error;
        throw new RequestError(502, 'provider_unavailable');
      } finally {
        clearTimeout(timer);
        res.off('close', onClose);
        active--;
      }
    } catch (error) {
      const known = error instanceof RequestError;
      // Never send provider error bodies, credentials, prompts or stack traces.
      json(res, known ? error.status : 500, { error: known ? error.code : 'internal_error' },
        { Connection: 'close' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const server = createStoryServer();
  server.listen(port, host, () => console.log(`Story backend listening on ${host}:${port}`));
  process.once('SIGTERM', () => server.close());
  process.once('SIGINT', () => server.close());
}
