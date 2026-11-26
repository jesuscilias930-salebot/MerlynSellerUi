import test from 'node:test';
import assert from 'node:assert/strict';
import { addPhrase, selectableTemplates, templateQuickReplies } from '../app/lib/scenario-template-trigger.ts';

test('botones de respuesta rápida de la plantilla', () => {
  const template = { components: [{ type: 'BODY', text: 'Hola' }, { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Sí, la quiero' }, { type: 'URL', text: 'Ver' }, { type: 'QUICK_REPLY', text: ' Tengo una duda ' }, { type: 'QUICK_REPLY', text: 'Sí, la quiero' }] }] };
  assert.deepEqual(templateQuickReplies(template), ['Sí, la quiero', 'Tengo una duda']);
  assert.deepEqual(templateQuickReplies(null), []);
});

test('agregar frase sin repetir', () => {
  assert.equal(addPhrase('Hola\n', 'Sí, la quiero'), 'Hola\nSí, la quiero');
  assert.equal(addPhrase('sí, la quiero', 'Sí, la quiero'), 'sí, la quiero');
  assert.equal(addPhrase('', 'Tengo una duda'), 'Tengo una duda');
});

test('solo plantillas aprobadas, más la ya elegida', () => {
  const templates = [{ id: 'a', status: 'APPROVED' }, { id: 'b', status: 'PENDING' }, { id: 'c', status: 'REJECTED' }];
  assert.deepEqual(selectableTemplates(templates).map(t => t.id), ['a']);
  assert.deepEqual(selectableTemplates(templates, { templateId: 'c', templateName: 'x' }).map(t => t.id), ['a', 'c']);
});
