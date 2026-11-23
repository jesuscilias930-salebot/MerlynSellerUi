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

test('informa el avance de la subida con XMLHttpRequest', async () => {
  const { mediaUploadRequest: upload, progressLabel } = await import('../app/lib/media-upload-request.ts');
  const events = []; let sentHeaders = {};
  class FakeXhr {
    constructor() { this.upload = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { sentHeaders[key.toLowerCase()] = value; }
    getResponseHeader() { return 'application/json'; }
    send() {
      this.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
      this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
      this.upload.onload();
      this.status = 202; this.responseText = '{"id":"m1"}'; this.onload();
    }
  }
  globalThis.XMLHttpRequest = FakeXhr;
  try {
    const response = await upload('/video', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'video/mp4' }, body: 'x' }, 'ref-1', progress => events.push(progress));
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { id: 'm1' });
    assert.equal(sentHeaders['x-upload-id'], 'ref-1');
    assert.deepEqual(events.map(event => `${event.phase}:${event.fraction}`), ['uploading:0', 'uploading:0.25', 'uploading:1', 'processing:1']);
    assert.equal(progressLabel({ phase: 'uploading', fraction: 0.456 }), 'Subiendo 46 %');
    assert.match(progressLabel({ phase: 'processing', fraction: 1 }), /preparando/);
  } finally { delete globalThis.XMLHttpRequest; }
});
