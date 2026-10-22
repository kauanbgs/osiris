import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_PROVIDERS, sendPrompt } from '../src/services/llmService.js';
import { resolveWorkflowModel } from '../src/workflow/modelSelection.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.window = {};
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
});

function response(text) {
  return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\ndata: [DONE]\n\n');
}

test('agent model selection overrides the active model and excludes credentials', () => {
  const active = { type: 'local', modelPath: 'active.gguf' };
  const config = resolveWorkflowModel({ modelConfig: { type: 'cloud', provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'secret' } }, active);
  assert.equal(config.provider, 'groq');
  assert.equal(config.apiKey, undefined);
  assert.equal(resolveWorkflowModel({}, active), active);
  assert.throws(() => resolveWorkflowModel({ model: 'qwen2.5:7b' }, active), /antigo/);
});

test('Groq selection reaches the cloud endpoint with the selected model and saved key', async () => {
  storage.set('osiris_cloud_model_keys', JSON.stringify({ groq: 'test-key' }));
  storage.set('osiris_active_model', JSON.stringify({ type: 'local' }));
  let called = false;
  globalThis.fetch = async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(options.body).model, 'openai/gpt-oss-20b');
    return response('Groq result');
  };
  const config = resolveWorkflowModel({ modelConfig: { type: 'cloud', provider: 'groq', model: 'openai/gpt-oss-20b' } });
  const result = await sendPrompt({ prompt: 'task', activeModelOverride: config });
  assert.equal(called, true);
  assert.equal(result, 'Groq result');
});

test('a missing cloud key fails without running a local model', async () => {
  window.llama = { prompt: () => assert.fail('Unexpected local fallback') };
  await assert.rejects(sendPrompt({ prompt: 'task', activeModelOverride: { type: 'cloud', provider: 'groq', model: 'openai/gpt-oss-120b' } }), /Chave de API/);
});

test('each local request loads its chosen GGUF and local requests are serialized', async () => {
  const operations = [];
  let activeModelPath = null;
  window.llama = {
    getStatus: async () => ({ isLoaded: Boolean(activeModelPath), activeModelPath }),
    loadModel: async (path) => { activeModelPath = path; operations.push('load:' + path); },
    prompt: async () => {
      const path = activeModelPath;
      operations.push('start:' + path);
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(activeModelPath, path);
      operations.push('end:' + path);
      return path;
    },
  };
  const results = await Promise.all(['a.gguf', 'b.gguf'].map((modelPath) => sendPrompt({ prompt: 'task', activeModelOverride: { type: 'local', modelPath } })));
  assert.deepEqual(results, ['a.gguf', 'b.gguf']);
  assert.deepEqual(operations, ['load:a.gguf', 'start:a.gguf', 'end:a.gguf', 'load:b.gguf', 'start:b.gguf', 'end:b.gguf']);
});

test('canceled requests never load a model', async () => {
  const controller = new AbortController();
  controller.abort();
  window.llama = { prompt: () => assert.fail('Canceled request ran') };
  await assert.rejects(sendPrompt({ prompt: 'task', signal: controller.signal, activeModelOverride: { type: 'local' } }), { name: 'AbortError' });
});

test('Groq catalog includes current text models and no retired Mixtral or Compound', () => {
  const models = CLOUD_PROVIDERS.find((provider) => provider.id === 'groq').models;
  for (const id of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']) assert.ok(models.some((model) => model.id === id));
  assert.equal(models.some((model) => model.id.includes('mixtral') || model.id.includes('compound')), false);
  assert.equal(models.filter((model) => model.default).length, 1);
});

