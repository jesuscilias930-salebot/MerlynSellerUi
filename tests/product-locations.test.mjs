import test from 'node:test';
import assert from 'node:assert/strict';
import { draftPayload, formatLocation, rackIndex, suggestions } from '../app/lib/product-locations.ts';

test('formatea la ubicación sin repetir palabras', () => {
  assert.equal(formatLocation({ rack: 'A', level: '2', side: 'Izquierdo' }), 'Rack A · Piso 2 · Lado izquierdo');
  assert.equal(formatLocation({ rack: 'Rack 3', level: null, side: '' }), 'Rack 3');
  assert.equal(formatLocation({ rack: '', level: 'piso alto', side: null }), 'piso alto');
  assert.equal(formatLocation(null), '');
});

test('limpia el envío y vacíos se vuelven null', () => {
  assert.deepEqual(draftPayload([4], { rack: '  B ', level: '', side: ' Frente ' }), { productIds: [4], rack: 'B', level: null, side: 'Frente' });
});

test('sugerencias y racks ordenados de forma natural', () => {
  const rows = [{ productId: 1, rack: 'R10', level: '2', side: 'derecho' }, { productId: 2, rack: 'R2', level: '10', side: null }, { productId: 3, rack: 'R2', level: '1', side: null }];
  assert.deepEqual(suggestions(rows, 'rack'), ['R2', 'R10']);
  assert.deepEqual(suggestions(rows, 'side'), ['Atrás', 'derecho', 'Frente', 'Izquierdo']);
  assert.deepEqual(rackIndex(rows), [{ rack: 'R2', levels: ['1', '10'] }, { rack: 'R10', levels: ['2'] }]);
});

test('ubicaciones por talla y color: etiqueta, validación y envío', async () => {
  const { emptySlotDraft, slotDrafts, slotIssues, slotLabel, slotMap, slotPayload, slotPieces } = await import('../app/lib/product-locations.ts');
  assert.equal(slotLabel({ size: '25-28', color: 'Negro' }), 'Talla 25-28 · Negro');
  assert.equal(slotLabel({ size: null, color: 'Gris' }), 'Gris');
  const map = slotMap([{ productId: 4, size: '25-28', color: null, quantity: 10, rack: 'A', level: null, side: null }, { productId: 4, size: '22-25', color: null, quantity: null, rack: 'B', level: null, side: null }]);
  assert.equal(map.get(4).length, 2);
  const drafts = slotDrafts(map.get(4));
  const next = emptySlotDraft(drafts[1]);
  assert.equal(next.rack, 'B'); assert.equal(next.size, '');
  assert.deepEqual(slotIssues([...drafts, { ...next, rack: '', size: '22-25 ' }]), ['Fila 3: indica rack, piso o lado.', 'Fila 3: repite la talla y color de la fila 2.']);
  assert.deepEqual(slotIssues([...drafts, emptySlotDraft()]), []);
  assert.deepEqual(slotPayload([...drafts, emptySlotDraft()]).slots, [
    { size: '25-28', color: null, quantity: 10, rack: 'A', level: null, side: null },
    { size: '22-25', color: null, quantity: null, rack: 'B', level: null, side: null },
  ]);
  assert.equal(slotPieces(map.get(4)), 10);
});
