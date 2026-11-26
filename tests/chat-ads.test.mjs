import test from 'node:test';
import assert from 'node:assert/strict';
import { chatAdDraft, chatAdPayload, triggerLines } from '../app/lib/chat-ads.ts';

test('frases: una por línea, sin vacías ni repetidas', () => {
  assert.deepEqual(triggerLines(' Hola quiero info \n\nHola quiero info\nx\n¿Precio?'), ['Hola quiero info', '¿Precio?']);
});

test('chatAd: valida y arma lo que se guarda', () => {
  const draft = { ...chatAdDraft(), name: ' Paquete emprendedor ', triggers: '¡Hola! Quiero información', buttons: [{ label: ' Modelos ', text: '  ', imageIds: ['a', 'a', 'b'] }, { label: '', text: '', imageIds: [] }] };
  assert.deepEqual(chatAdPayload(draft), { payload: { name: 'Paquete emprendedor', isActive: true, triggerExamples: ['¡Hola! Quiero información'], buttons: [{ label: 'Modelos', imageIds: ['a', 'b'] }] } });
  assert.match(chatAdPayload({ ...draft, triggers: '' }).error, /frase/);
  assert.match(chatAdPayload({ ...draft, buttons: [{ label: 'Fotos', text: 'Hola', imageIds: [] }] }).error, /imagen para «Fotos»/);
  assert.match(chatAdPayload({ ...draft, buttons: [{ label: '', text: 'Hola', imageIds: ['a'] }] }).error, /nombre al botón 1/);
  assert.match(chatAdPayload({ ...draft, buttons: [] }).error, /al menos un botón/);
  const ad = { id: '1', name: 'A', isActive: false, triggerExamples: ['uno', 'dos'], buttons: [{ label: 'B', imageIds: ['x'] }], position: 0 };
  assert.deepEqual(chatAdDraft(ad), { id: '1', name: 'A', isActive: false, triggers: 'uno\ndos', buttons: [{ label: 'B', text: '', imageIds: ['x'] }] });
});
