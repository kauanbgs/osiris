import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abortable } from '../src/services/llmService.js';

test('stop rejects at once while the prompt is still queued or running', async () => {
  const controller = new AbortController();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const result = abortable(pending, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  release('late');
});

test('an already stopped signal never starts waiting, and no signal keeps the promise', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(abortable(new Promise(() => {}), controller.signal), { name: 'AbortError' });
  assert.equal(await abortable(Promise.resolve('ok')), 'ok');
});
