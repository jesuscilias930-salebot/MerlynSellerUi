import test from 'node:test';
import assert from 'node:assert/strict';
import { controlSaleRequest, dayLabel, draftIssues, draftToPayload, emptyDraft, groupByDay, suggestedAmount } from '../app/lib/deliveries.ts';

test('borrador por defecto: mañana a las 11 y datos del chat', () => {
  const draft = emptyDraft(new Date(2026, 9, 21, 16, 0), { customerName: 'Ana', conversationId: 'c1' });
  assert.equal(draft.date, '2026-10-22'); assert.equal(draft.time, '11:00');
  assert.equal(draft.customerName, 'Ana'); assert.equal(draft.conversationId, 'c1');
  assert.deepEqual(draftIssues(draft), ['Escribe el lugar de entrega.']);
});

test('valida y arma el envío con fecha local', () => {
  const draft = { customerName: ' Ana ', customerPhone: '', location: ' Parque ', date: '2026-10-25', time: '17:30', products: [{ kind: 'custom', name: ' Bolsa ', quantity: 2 }], notes: ' ' };
  const payload = draftToPayload(draft);
  assert.equal(payload.customerName, 'Ana'); assert.equal(payload.notes, null); assert.equal(payload.products[0].name, 'Bolsa');
  assert.equal(new Date(payload.scheduledAt).getHours(), 17);
  assert.deepEqual(draftIssues({ ...draft, customerName: '', date: '' }), ['Escribe el nombre del cliente.', 'Indica la fecha y la hora.']);
  assert.deepEqual(draftIssues({ ...draft, customerPhone: 'abc' }), ['El teléfono solo admite números.']);
});

test('agrupa por día con etiquetas', () => {
  const now = new Date(2026, 9, 21, 9);
  const at = (d, h) => new Date(2026, 9, d, h).toISOString();
  const groups = groupByDay([{ id: 'a', scheduledAt: at(21, 10) }, { id: 'b', scheduledAt: at(21, 18) }, { id: 'c', scheduledAt: at(22, 11) }, { id: 'd', scheduledAt: at(27, 11) }], now);
  assert.deepEqual(groups.map(g => g.items.map(i => i.id)), [['a', 'b'], ['c'], ['d']]);
  assert.match(groups[0].label, /^Hoy · /); assert.match(groups[1].label, /^Mañana · /);
  assert.match(dayLabel(new Date(2026, 9, 20), now), /^Ayer/);
});

test('venta para Control: separa productos y bundles, liga el chat', () => {
  const items = [{ kind: 'product', id: 3, name: 'Deportivo', quantity: 4 }, { kind: 'bundle', id: 7, name: 'Caricatura 50', quantity: 1 }];
  assert.deepEqual(controlSaleRequest({ conversationId: 'c1', customerName: ' Ana ', customerPhone: '+52 272 123 4567' }, items), {
    customerExternalId: 'c1', customerName: 'Ana', customerPhone: '522721234567',
    productsSold: [{ productId: 3, quantity: 4 }], bundlesSold: [{ bundleId: 7, quantity: 1 }],
  });
  assert.equal('customerExternalId' in controlSaleRequest({ conversationId: null, customerName: 'A', customerPhone: null }, items), false);
  assert.equal(suggestedAmount([items[1]], new Map([[7, 446.5]])), 446.5);
  assert.equal(suggestedAmount(items, new Map([[7, 446.5]])), null, 'producto suelto sin precio');
});
