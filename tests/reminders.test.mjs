import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReminderDraft, orderMessage, phoneLabel, reminderIssues, reminderPayload, whatsappDigits, whatsappLink } from '../app/lib/reminders.ts';

test('celular para WhatsApp y enlaces', () => {
  assert.equal(whatsappDigits('272 123 4567'), '522721234567');
  assert.equal(whatsappDigits('+52 1 272 123 4567'), '5212721234567');
  assert.equal(phoneLabel('522721234567'), '+52 272 123 4567');
  assert.equal(whatsappLink('272-123-4567'), 'https://wa.me/522721234567');
  assert.equal(whatsappLink('522721234567', 'Hola Ana'), 'https://wa.me/522721234567?text=Hola%20Ana');
});

test('mensaje con saludo, nombre y pedido para confirmar', () => {
  const text = orderMessage({ contactName: ' Ana López ', products: [{ kind: 'product', id: 5, name: 'Essential High Quality · Negro · Talla 25-28', quantity: 12 }] });
  assert.equal(text, '¡Hola, Ana López! 😊 Espero que estés muy bien.\n\nTe escribo para confirmar tu pedido:\n• 12 × Essential High Quality · Negro · Talla 25-28\n\n¿Me confirmas si lo apartamos para ti?');
  assert.match(orderMessage({ contactName: 'Ana', products: [] }), /dar seguimiento a tu pedido/);
});

test('borrador: validación y envío', () => {
  const draft = emptyReminderDraft(new Date(2026, 9, 23, 18, 0));
  assert.equal(draft.date, '2026-10-24'); assert.equal(draft.time, '10:00');
  assert.deepEqual(reminderIssues(draft), ['Escribe el nombre de la persona.', 'Escribe un celular válido (10 dígitos o con lada de país).']);
  const ready = { ...draft, contactName: ' Ana ', phone: '272 123 4567', notes: ' ' };
  assert.deepEqual(reminderIssues(ready), []);
  const payload = reminderPayload(ready);
  assert.equal(payload.contactName, 'Ana'); assert.equal(payload.phone, '522721234567'); assert.equal(payload.notes, null);
  assert.equal(new Date(payload.remindAt).getHours(), 10);
});

test('plantilla del recordatorio: variables propuestas, validación y vista previa', async () => {
  const { defaultMappings, templateIssues, templatePreview, agreedDateLabel, reminderPayload } = await import('../app/lib/reminders.ts');
  const template = { id: 't1', name: 'recordatorio_pedido', language: 'es_MX', status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Hola {{1}}, tu pedido: {{2}}. Quedamos el {{3}}. {{4}}' }],
    variables: [1, 2, 3, 4].map(position => ({ component: 'body', position })) };
  const mappings = defaultMappings(template);
  assert.deepEqual(mappings.map(m => m.source), ['reminder.name', 'reminder.products', 'reminder.agreed_date', 'fixed']);
  const draft = { ...emptyReminderDraft(new Date(2026, 9, 23)), contactName: 'Ana', phone: '2721234567', agreedDate: '2026-10-31', sendMode: 'template', templateId: 't1', templateMappings: mappings };
  assert.deepEqual(templateIssues(template, draft), ['{{2}} usa la lista de productos: agrega al menos uno.', 'Escribe el texto fijo de {{4}}.']);
  const ready = { ...draft, products: [{ kind: 'custom', name: 'Bolsa', quantity: 2 }], templateMappings: mappings.map(m => m.source === 'fixed' ? { ...m, value: '¡Gracias!' } : m) };
  assert.deepEqual(templateIssues(template, ready), []);
  assert.equal(templatePreview(template, ready), 'Hola Ana, tu pedido: 2 × Bolsa. Quedamos el sábado, 31 de octubre. ¡Gracias!');
  assert.equal(agreedDateLabel(''), '');
  const payload = reminderPayload(ready);
  assert.equal(payload.sendMode, 'template'); assert.equal(payload.templateId, 't1'); assert.equal(payload.agreedDate, '2026-10-31');
  assert.equal(payload.templateMappings[0].value, undefined); assert.equal(payload.templateMappings[3].value, '¡Gracias!');
  assert.deepEqual(reminderPayload({ ...ready, sendMode: 'manual' }).templateMappings, []);
});
