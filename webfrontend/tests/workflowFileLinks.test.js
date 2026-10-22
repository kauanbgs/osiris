import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAgentFileNodes } from '../src/workflow/getConnectedFiles.js';

const nodes = [{ id: 'a', type: 'agent' }, { id: 'f', type: 'file' }, { id: 'b', type: 'agent' }];
const ids = (edge) => {
  const { inputs, outputs } = getAgentFileNodes('a', nodes, [{ id: 'e', ...edge }]);
  return { inputs: inputs.map((node) => node.id), outputs: outputs.map((node) => node.id) };
};

test('any handle on the agent can feed or receive a file, by handle or arrow direction', () => {
  // agent bottom handle -> file: how the reported workflow was wired
  assert.deepEqual(ids({ source: 'a', sourceHandle: 'agent-out', target: 'f', targetHandle: 'input' }), { inputs: [], outputs: ['f'] });
  assert.deepEqual(ids({ source: 'a', sourceHandle: 'output', target: 'f', targetHandle: 'input' }), { inputs: [], outputs: ['f'] });
  assert.deepEqual(ids({ source: 'f', sourceHandle: 'files', target: 'a', targetHandle: 'files' }), { inputs: ['f'], outputs: [] });
  // drawn backwards: the agent-side handle wins over the arrow
  assert.deepEqual(ids({ source: 'f', sourceHandle: 'files', target: 'a', targetHandle: 'output' }), { inputs: [], outputs: ['f'] });
  assert.deepEqual(ids({ source: 'a', sourceHandle: 'files', target: 'f', targetHandle: 'input' }), { inputs: ['f'], outputs: [] });
  assert.deepEqual(ids({ source: 'f', sourceHandle: 'files', target: 'a', targetHandle: 'agent-in' }), { inputs: ['f'], outputs: [] });
  // agent-to-agent links are not files
  assert.deepEqual(ids({ source: 'a', sourceHandle: 'agent-out', target: 'b', targetHandle: 'agent-in' }), { inputs: [], outputs: [] });
});
