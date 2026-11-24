import test from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedMessageInfo } from '../app/lib/unsupported-message.ts';

test('explica qué envió el cliente y qué hacer', () => {
  assert.match(unsupportedMessageInfo({ type: 'poll_creation' }).title, /encuesta/);
  assert.match(unsupportedMessageInfo({ type: 'edit' }).title, /editó/);
  assert.match(unsupportedMessageInfo({ code: 131060 }).hint, /anuncio/);
  const generic = unsupportedMessageInfo(undefined);
  assert.match(generic.title, /no comparte/);
  assert.match(generic.hint, /ver una vez/);
  assert.match(unsupportedMessageInfo({ type: 'algo_nuevo' }).title, /no comparte/);
});
