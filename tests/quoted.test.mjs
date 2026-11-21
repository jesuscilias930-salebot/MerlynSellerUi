import test from 'node:test';
import assert from 'node:assert/strict';
import { quotedLabel, quotedThumbnailKind } from '../app/lib/quoted.ts';

test('la cita dice qué se respondió en vez de [image]', () => {
  assert.equal(quotedLabel('image', null), '📷 Foto');
  assert.equal(quotedLabel('image', 'Hoodie gris'), '📷 Hoodie gris');
  assert.equal(quotedLabel('video', ''), '🎥 Video');
  assert.equal(quotedLabel('document', null, 'catalogo.pdf'), '📄 catalogo.pdf');
  assert.equal(quotedLabel('location', '📍 Bodega Merlyn\nSur 5\nhttps://maps'), '📍 Bodega Merlyn');
  assert.equal(quotedLabel('interactive', '{"kind":"options"}'), 'Mensaje con opciones');
  assert.equal(quotedLabel('text', 'Hola'), 'Hola');
  assert.equal(quotedLabel(undefined, null), 'Mensaje');
});

test('solo fotos, stickers y videos con archivo llevan miniatura', () => {
  assert.equal(quotedThumbnailKind('image', true), 'image');
  assert.equal(quotedThumbnailKind('sticker', true), 'image');
  assert.equal(quotedThumbnailKind('video', true), 'video');
  assert.equal(quotedThumbnailKind('image', false), null);
  assert.equal(quotedThumbnailKind('document', true), null);
});
