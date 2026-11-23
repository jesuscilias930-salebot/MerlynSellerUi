import test from 'node:test';
import assert from 'node:assert/strict';
import { fileSha256 } from '../app/lib/video-upload.ts';

test('la huella del video es estable y distingue archivos distintos', async () => {
  const hash = await fileSha256(new Blob(['abc']));
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await fileSha256(new Blob(['abc'])), hash);
  assert.notEqual(await fileSha256(new Blob(['abd'])), hash);
});
