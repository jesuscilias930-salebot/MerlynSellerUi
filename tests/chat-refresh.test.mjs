import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshIndependently, refreshAfterAcceptedUpload } from '../app/lib/chat-refresh.ts';
test('actualiza mensajes aunque falle la recarga de leads', async () => {
  let updated = false;
  await assert.rejects(refreshIndependently([
    async () => { throw new TypeError('Load failed'); },
    async () => { updated = true; },
  ]), /Load failed/);
  assert.equal(updated, true);
});
test('un envío aceptado no se reporta como envío fallido ni se repite', async () => {
  let calls = 0;
  const notice = await refreshAfterAcceptedUpload(async () => { calls++; throw new TypeError('Load failed'); });
  assert.match(notice, /Archivo aceptado/);
  assert.match(notice, /No necesitas reenviarlo/);
  assert.equal(calls, 1);
});
test('una sincronización exitosa no muestra error', async () => {
  assert.equal(await refreshAfterAcceptedUpload(async () => {}), null);
});
