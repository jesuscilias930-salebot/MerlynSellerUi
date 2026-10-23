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
