import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWorkflow, runWorkflow } from '../src/workflow/runWorkflow.js';
import { executeAgentNode } from '../src/workflow/executeAgentNode.js';

const agent = (id, data = {}) => ({ id, type: 'agent', data: { label: id.toUpperCase(), ...data } });
const edge = (source, target, extra = {}) => ({ id: source + target, source, target, ...extra });

test('fresh output and handoff instructions reach the next agent for any connected handle', async () => {
  const transfers = [];
  const calls = [];
  const nodes = [agent('b'), agent('a', { output: 'STALE', handoffPrompt: 'Implement the generated plan' })];
  await runWorkflow({ nodes, edges: [edge('a', 'b', { targetHandle: 'files', sourceHandle: 'output' })],
    onTransfer: (message) => transfers.push(message),
    executeAgent: async (id, context) => { calls.push({ id, context }); return id === 'a' ? 'FRESH PLAN: write tests' : 'done'; },
  });
  assert.deepEqual(calls.map((call) => call.id), ['a', 'b']);
  assert.match(calls[1].context, /FRESH PLAN/);
  assert.match(calls[1].context, /Implement the generated plan/);
  assert.doesNotMatch(calls[1].context, /STALE/);
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].label, 'A');
  assert.equal(transfers[0].targetLabel, 'B');
  assert.equal(transfers[0].saved, false);
});

test('a join waits for all prerequisites, including when starting a connected chain', async () => {
  const calls = [];
  const nodes = [agent('c'), agent('a'), agent('b'), agent('unrelated')];
  await runWorkflow({ nodes, edges: [edge('a', 'c'), edge('b', 'c')], startAgentId: 'a',
    executeAgent: async (id, context) => { calls.push(id); if (id === 'c') { assert.match(context, /result-a/); assert.match(context, /result-b/); } return 'result-' + id; },
  });
  assert.deepEqual(calls, ['a', 'b', 'c']);
});

test('duplicate visual connections do not deliver the same instructions twice', async () => {
  let count = 0;
  await runWorkflow({ nodes: [agent('a'), agent('b')], edges: [edge('a', 'b'), edge('a', 'b', { id: 'second' })],
    onTransfer: () => count++, executeAgent: async () => 'result' });
  assert.equal(count, 1);
});

test('cycles fail before any agent executes', async () => {
  let called = false;
  await assert.rejects(runWorkflow({ nodes: [agent('a'), agent('b')], edges: [edge('a', 'b'), edge('b', 'a')],
    executeAgent: async () => { called = true; } }), /Ciclo/);
  assert.equal(called, false);
});

test('failure stops downstream execution and reports the failing agent', async () => {
  const errors = [];
  const calls = [];
  await assert.rejects(runWorkflow({ nodes: [agent('a'), agent('b')], edges: [edge('a', 'b')],
    onAgentError: (id, label, error) => errors.push({ id, message: error.message }),
    executeAgent: async (id) => { calls.push(id); throw new Error('provider failed'); } }), /provider failed/);
  assert.deepEqual(calls, ['a']);
  assert.deepEqual(errors, [{ id: 'a', message: 'provider failed' }]);
});

test('cancellation never reports a completed agent or runs the next step', async () => {
  const abort = new AbortController();
  const done = [];
  const calls = [];
  await assert.rejects(runWorkflow({ nodes: [agent('a'), agent('b')], edges: [edge('a', 'b')], signal: abort.signal,
    onAgentDone: (id) => done.push(id), executeAgent: async (id) => { calls.push(id); abort.abort(); return 'late result'; } }), { name: 'AbortError' });
  assert.deepEqual(calls, ['a']);
  assert.deepEqual(done, []);
});

test('single-agent execution labels saved predecessor context and runs only the requested agent', async () => {
  const transfers = [];
  const calls = [];
  await runWorkflow({ nodes: [agent('a', { output: 'previous plan' }), agent('b'), agent('c')],
    edges: [edge('a', 'b'), edge('b', 'c')], onlyAgentId: 'b', onTransfer: (message) => transfers.push(message),
    executeAgent: async (id, context) => { calls.push(id); assert.match(context, /previous plan/); return 'done'; } });
  assert.deepEqual(calls, ['b']);
  assert.equal(transfers[0].saved, true);
});

test('real executor passes the upstream handoff into the chosen cloud model prompt', async () => {
  const oldStorage = globalThis.localStorage;
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.localStorage = { getItem: (key) => key === 'osiris_cloud_model_keys' ? JSON.stringify({ groq: 'test-key' }) : null };
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const text = requests.length === 1 ? 'Build a calculator with addition' : 'Calculator implemented';
    return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\ndata: [DONE]\n\n');
  };
  try {
    const modelConfig = { type: 'cloud', provider: 'groq', model: 'openai/gpt-oss-20b' };
    const nodes = [agent('planner', { prompt: 'Create a plan', handoffPrompt: 'Implement this plan', modelConfig }), agent('coder', { prompt: 'Write the code', modelConfig })];
    const edges = [edge('planner', 'coder')];
    const results = await runWorkflow({ nodes, edges, executeAgent: (agentId, agentContext) => executeAgentNode({ agentId, agentContext, nodes, edges, instruction: nodes.find((node) => node.id === agentId).data.prompt }) });
    assert.equal(results.length, 2);
    assert.equal(requests[1].model, 'openai/gpt-oss-20b');
    assert.match(requests[1].messages.at(-1).content, /Build a calculator with addition/);
    assert.match(requests[1].messages.at(-1).content, /Implement this plan/);
    assert.match(requests[1].messages.at(-1).content, /Write the code/);
  } finally {
    globalThis.localStorage = oldStorage;
    globalThis.fetch = oldFetch;
  }
});
