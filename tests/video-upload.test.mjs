import test from 'node:test';
import assert from 'node:assert/strict';
import { videoContentType, VIDEO_ACCEPT } from '../app/lib/video-upload.ts';
test('acepta MOV de iPhone y MIME con parámetros', () => {
  assert.equal(videoContentType({name:'IMG_01.MOV',type:'video/quicktime'}),'video/quicktime');
  assert.equal(videoContentType({name:'clip.mp4',type:'video/mp4; codecs=hvc1'}),'video/mp4');
  assert.ok(VIDEO_ACCEPT.includes('.mov'));
});
test('Safari sin MIME usa extensiones reconocidas', () => {
  for (const type of ['', 'application/octet-stream']) {
    assert.equal(videoContentType({name:'IMG.MOV',type}),'video/quicktime');
    assert.equal(videoContentType({name:'clip.MP4',type}),'video/mp4');
  }
});
test('rechaza otros tipos aunque el nombre parezca video', () => {
  assert.equal(videoContentType({name:'fake.mov',type:'text/html'}),null);
  assert.equal(videoContentType({name:'clip.exe',type:''}),null);
});
