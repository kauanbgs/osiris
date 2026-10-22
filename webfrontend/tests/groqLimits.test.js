import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroqRateLimiter, parseResetDuration, abortableDelay } from '../src/services/groqRateLimit.js';
import { prepareGroqPrompt } from '../src/workflow/groqBudget.js';
import { sendPrompt } from '../src/services/llmService.js';

test('parses Groq reset durations including milliseconds', () => {
  assert.equal(parseResetDuration('2m59.56s'), 179560);
  assert.equal(parseResetDuration('7.66s'), 7660);
  assert.equal(parseResetDuration('250ms'), 250);
  assert.equal(parseResetDuration('2'), 2000);
});

test('429 retries respect Retry-After and announce the wait', async () => {
  let time = 0, calls = 0;
  const waits = [], notices = [];
  const schedule = createGroqRateLimiter({ now: () => time, delay: async (ms) => { waits.push(ms); time += ms; } });
  const response = await schedule({ model: 'test', estimatedTokens: 2000, onNotice: (notice) => notices.push(notice), request: async () => {
    calls++;
    return calls === 1 ? new Response(JSON.stringify({ error: { message: 'Tokens per minute reached' } }), { status: 429, headers: { 'retry-after': '2' } }) : new Response('ok');
  } });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2250]);
  assert.match(notices[0].message, /Nova tentativa/);
});

test('remaining token headers delay the next request before sending it', async () => {
  let time = 0;
  const waits = [];
  const schedule = createGroqRateLimiter({ now: () => time, delay: async (ms) => { waits.push(ms); time += ms; } });
  await schedule({ model: 'test', estimatedTokens: 2000, request: async () => new Response('ok', { headers: { 'x-ratelimit-remaining-tokens': '100', 'x-ratelimit-reset-tokens': '5s' } }) });
  await schedule({ model: 'test', estimatedTokens: 2000, request: async () => { assert.equal(time, 5250); return new Response('ok'); } });
  assert.deepEqual(waits, [5250]);
});

test('daily quotas and oversized requests fail once instead of retrying', async () => {
  for (const message of ['Tokens per day reached (TPD)', 'Request too large for model: Limit 8000']) {
    let calls = 0;
    const schedule = createGroqRateLimiter({ delay: () => assert.fail('Unexpected retry') });
    await assert.rejects(schedule({ model: 'test', estimatedTokens: 1000, request: async () => { calls++; return new Response(JSON.stringify({ error: { message } }), { status: 429 }); } }), /Groq:/);
    assert.equal(calls, 1);
  }
});

test('retry count is bounded and the request queue recovers after failure', async () => {
  let calls = 0;
  const schedule = createGroqRateLimiter({ delay: async () => {} });
  await assert.rejects(schedule({ model: 'test', estimatedTokens: 1000, request: async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Rate limit' } }), { status: 429, headers: { 'retry-after': '1' } }); } }), /renovacao/);
  assert.equal(calls, 3);
  const result = await schedule({ model: 'another', estimatedTokens: 1, request: async () => new Response('recovered') });
  assert.equal(await result.text(), 'recovered');
});

test('stop cancels waiting without dispatching another request', async () => {
  const abort = new AbortController();
  let calls = 0;
  const schedule = createGroqRateLimiter({ delay: async (_ms, signal) => { abort.abort(); signal.throwIfAborted(); } });
  await assert.rejects(schedule({ model: 'test', estimatedTokens: 100, signal: abort.signal, request: async () => {
    calls++; return new Response('{}', { status: 429, headers: { 'retry-after': '2' } });
  } }), { name: 'AbortError' });
  assert.equal(calls, 1);
  await assert.rejects(abortableDelay(1000, abort.signal), { name: 'AbortError' });
});

test('handoff context is bounded and reductions are explicitly reported', () => {
  const original = 'x'.repeat(20000);
  const budget = prepareGroqPrompt('CURRENT TASK', original, 'FILE CONTENT');
  assert.ok(budget.maxOutputTokens > 1024 && budget.maxOutputTokens <= 4096);
  assert.ok(budget.prompt.length < 6000);
  assert.match(budget.prompt, /CURRENT TASK/);
  assert.match(budget.prompt, /FILE CONTENT/);
  assert.equal(budget.notices.length, 1);
  assert.equal(original.length, 20000);
});

test('large source files are rejected before dispatch, never silently clipped', () => {
  assert.throws(() => prepareGroqPrompt('task', '', 'x'.repeat(30000)), /Nenhum arquivo foi cortado/);
});

test('Groq requests cap output and incomplete code is rejected before file application', async () => {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => key === 'osiris_cloud_model_keys' ? '{"groq":"test"}' : null };
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).max_completion_tokens, 1024);
    return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'incomplete file' }, finish_reason: 'length' }] }) + '\n\ndata: [DONE]\n\n');
  };
  try {
    await assert.rejects(sendPrompt({ prompt: 'task', maxOutputTokens: 1024, activeModelOverride: { type: 'cloud', provider: 'groq', model: 'test' } }), /resultado incompleto/);
  } finally { globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage; }
});

async function withGroqMock(fetchMock, run) {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => key === 'osiris_cloud_model_keys' ? '{"groq":"test"}' : null };
  globalThis.fetch = fetchMock;
  try { return await run(); } finally { globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage; }
}
function streamedPart(content, finishReason) {
  // No trailing newline: the last SSE frame still needs to be consumed.
  return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content }, finish_reason: finishReason }] }));
}
const groqModel = { type: 'cloud', provider: 'groq', model: 'openai/gpt-oss-20b' };

test('long JSON continues from the exact prefix and returns a complete document', async () => {
  const requests = [], notices = [], chunks = [];
  await withGroqMock(async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    assert.equal(request.reasoning_effort, 'low');
    assert.ok(request.max_completion_tokens > 1024);
    const estimatedInput = Math.ceil(new TextEncoder().encode(JSON.stringify(request.messages)).length / 3);
    assert.ok(estimatedInput + request.max_completion_tokens <= 7000);
    if (requests.length === 1) return streamedPart('{"fileOperations":[{"content":"hello ', 'length');
    assert.equal(request.messages.at(-2).role, 'assistant');
    assert.equal(request.messages.at(-2).content, '{"fileOperations":[{"content":"hello ');
    return streamedPart('world"}],"message":"done"}', 'stop');
  }, async () => {
    const result = await sendPrompt({ prompt: 'write a file', continueOnLength: true, activeModelOverride: groqModel, onNotice: (notice) => notices.push(notice), onChunk: (text) => chunks.push(text) });
    assert.equal(JSON.parse(result).fileOperations[0].content, 'hello world');
    assert.equal(chunks.at(-1), result);
  });
  assert.equal(requests.length, 2);
  assert.equal(notices[0].type, 'continuation');
});

test('continuations are bounded and incomplete files never become successful results', async () => {
  let requests = 0;
  await withGroqMock(async () => { requests++; return streamedPart('unfinished ', 'length'); }, async () => {
    await assert.rejects(sendPrompt({ prompt: 'task', continueOnLength: true, activeModelOverride: groqModel }), /resultado incompleto/);
  });
  assert.equal(requests, 3);
});

test('cancelling after a partial response prevents continuation requests', async () => {
  let requests = 0;
  const abort = new AbortController();
  await withGroqMock(async () => { requests++; return streamedPart('unfinished ', 'length'); }, async () => {
    await assert.rejects(sendPrompt({ prompt: 'task', continueOnLength: true, signal: abort.signal, activeModelOverride: groqModel, onNotice: () => abort.abort() }), { name: 'AbortError' });
  });
  assert.equal(requests, 1);
});

test('larger prompts reduce the response allocation to remain within the estimated quota', () => {
  const small = prepareGroqPrompt('task', '', '');
  const large = prepareGroqPrompt('task', '', 'x'.repeat(13000));
  assert.equal(small.maxOutputTokens, 4096);
  assert.ok(large.maxOutputTokens < small.maxOutputTokens);
  assert.ok(large.maxOutputTokens >= 512);
});
