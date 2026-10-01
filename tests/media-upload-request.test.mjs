import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaUploadRequest } from '../app/lib/media-upload-request.ts';
test('incluye referencia y no reintenta tras Load failed', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(init.headers.get('X-Upload-Id'), 'reference');
    assert.equal(init.credentials, 'include');
    throw new TypeError('Load failed');
  });
  await assert.rejects(mediaUploadRequest('/upload', {credentials:'include'}, 'reference'), /Referencia: reference/);
  assert.equal(calls, 1);
});
test('conserva errores HTTP del servidor', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status:413}));
  assert.equal((await mediaUploadRequest('/upload', {}, 'reference')).status, 413);
});
