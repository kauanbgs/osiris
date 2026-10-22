import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConnectedNotes, buildNoteContext } from '../src/workflow/getConnectedNotes.js';

const text = (id, value) => ({ id, type: 'text', data: { text: value } });
const agent = (id) => ({ id, type: 'agent', data: {} });

test('notes linked in either direction reach the agent; unlinked and empty ones do not', () => {
  const nodes = [agent('a'), text('in', 'Use TypeScript'), text('out', 'Prazo: sexta'), text('empty', '  '), text('loose', 'ignore')];
  const edges = [{ source: 'in', target: 'a' }, { source: 'a', target: 'out' }, { source: 'empty', target: 'a' }];
  const notes = getConnectedNotes('a', nodes, edges);
  assert.deepEqual(notes, ['Use TypeScript', 'Prazo: sexta']);
  assert.match(buildNoteContext(notes), /NOTAS CONECTADAS[\s\S]*- Use TypeScript\n- Prazo: sexta/);
  assert.equal(buildNoteContext([]), '');
});
