import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, applyFileOperations, buildFileEditInstruction } from '../src/workflow/agentFiles.js';

const file = (fileName, fileContent, filePath = '/p/' + fileName) => ({ fileName, fileContent, filePath });

test('edits change only the matched snippets and keep CRLF files intact', () => {
  assert.equal(applyEdits('a\nb\nc\n', [{ find: 'b', replace: 'B' }]), 'a\nB\nc\n');
  assert.equal(applyEdits('one\r\ntwo\r\n', [{ find: 'one\ntwo', replace: 'uno\ndos' }]), 'uno\r\ndos\r\n');
  assert.equal(applyEdits('keep\ndrop\n', [{ find: 'drop\n', replace: '' }]), 'keep\n');
});

test('a missing or ambiguous snippet leaves the whole file unchanged and reports why', () => {
  const errors = [];
  const files = [file('a.js', 'x = 1\nx = 1\n')];
  const next = applyFileOperations(files, [{ action: 'edit', fileName: 'a.js', edits: [{ find: 'x = 1', replace: 'x = 2' }] }], errors);
  assert.equal(next[0].fileContent, 'x = 1\nx = 1\n');
  assert.match(errors[0], /mais de uma vez/);

  const missing = [];
  applyFileOperations(files, [{ action: 'edit', fileName: 'a.js', edits: [{ find: 'y', replace: 'z' }] }], missing);
  assert.match(missing[0], /nao encontrado/);
});

test('edit preserves the real path and full-content update still works', () => {
  const files = [file('a.js', 'const a = 1;\n'), file('b.js', '')];
  const next = applyFileOperations(files, [
    { action: 'edit', fileName: 'a.js', edits: [{ find: '1', replace: '2' }] },
    { action: 'update', fileName: 'b.js', content: 'new\n' },
  ]);
  assert.equal(next[0].fileContent, 'const a = 2;\n');
  assert.equal(next[0].filePath, '/p/a.js');
  assert.equal(next[1].fileContent, 'new\n');
});

test('edit prompt puts the request first and last, and skips files already in context', () => {
  const nodes = [{ data: { files: [file('a.js', 'SECRET CONTENT')] } }];
  const inContext = buildFileEditInstruction('rename foo', nodes, '', [file('a.js', 'SECRET CONTENT')]);
  assert.doesNotMatch(inContext.fileContext, /SECRET CONTENT/);
  assert.match(inContext.instruction, /^PEDIDO DO USUARIO[^\n]*\nrename foo/);
  assert.match(inContext.instruction, /LEMBRETE DO PEDIDO: rename foo$/);
  assert.doesNotMatch(inContext.instruction, /SECRET CONTENT/);

  const outside = buildFileEditInstruction('rename foo', nodes);
  assert.match(outside.fileContext, /SECRET CONTENT/);
});
