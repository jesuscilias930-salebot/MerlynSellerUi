import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityMessage, bundleAvailability, searchInventory } from '../app/lib/quick-inventory.ts';

const caricatura = { id: 10, name: 'Caricatura' };
const products = [
  { id: 1, name: 'Caricatura niño', currentStock: 30, minStockAlert: 5, category: caricatura, gender: 'MALE', size: '2-4' },
  { id: 2, name: 'Caricatura niña', currentStock: 20, minStockAlert: 5, category: caricatura, gender: 'FEMALE', size: '2-4' },
  { id: 3, name: 'Deportivo Pro', currentStock: 4, minStockAlert: 10, category: { id: 20, name: 'Deportivo' }, gender: 'UNISEX', size: '25-28' },
  { id: 4, name: 'Térmico', currentStock: 0, category: { id: 30, name: 'Invierno' } },
];

test('disponibilidad de bundles: piezas fijas y surtido de caricatura', () => {
  assert.equal(bundleAvailability({ id: 1, name: 'Fijo', items: [{ productId: 3, quantity: 2 }] }, products), 2);
  assert.equal(bundleAvailability({ id: 2, name: 'Surtido', items: [{ productId: 1, quantity: 10, assorted: true }] }, products), 5, '50 pares entre variantes / 10');
  assert.equal(bundleAvailability({ id: 3, name: 'Mixto', items: [{ productId: 1, quantity: 10 }, { productId: 1, quantity: 10, assorted: true }] }, products), 2, 'las fijas se apartan primero');
  assert.equal(bundleAvailability({ id: 4, name: 'Surtido inválido', items: [{ productId: 3, quantity: 1, assorted: true }] }, products), 0, 'solo caricatura admite surtido');
  assert.equal(bundleAvailability({ id: 5, name: 'Agotado', items: [{ productId: 4, quantity: 1 }] }, products), 0);
});

test('busca sin acentos por nombre, categoría, talla y bundles', () => {
  const bundles = [{ id: 7, name: 'Caricatura 50 pares', fixedPrice: '446.50', items: [{ productId: 1, quantity: 50, assorted: true }] }];
  const results = searchInventory('caricatura', products, bundles);
  assert.deepEqual(results.map(r => `${r.kind}:${r.id}`).sort(), ['bundle:7', 'product:1', 'product:2']);
  const bundle = results.find(r => r.kind === 'bundle');
  assert.equal(bundle.available, 1); assert.equal(bundle.price, 446.5);
  const withEmpty = searchInventory('o', products, []);
  assert.deepEqual(withEmpty, [], 'mínimo 2 letras');
  assert.equal(searchInventory('termico', products, [])[0].state, 'empty');
  assert.equal(searchInventory('deportivo', products, [])[0].state, 'low');
  assert.deepEqual(searchInventory('nina 2-4', products, []).map(r => r.id), [2]);
  assert.deepEqual(searchInventory('x', products, []), []);
});

test('mensajes para el cliente no revelan existencias exactas', () => {
  const [ready] = searchInventory('caricatura nino', products, []);
  assert.match(availabilityMessage(ready), /^¡Sí tenemos disponible «Caricatura niño · Caricatura · Hombre · Talla 2-4»!/);
  assert.doesNotMatch(availabilityMessage(ready), /30/);
  assert.match(availabilityMessage(searchInventory('termico', products, [])[0]), /agotado/);
});

test('muestra y busca por ubicación en bodega', () => {
  const locations = new Map([[1, { productId: 1, rack: 'A', level: '2', side: 'Izquierdo' }]]);
  const [hit] = searchInventory('rack a', products, [], 12, locations);
  assert.equal(hit.id, 1);
  assert.equal(hit.location, 'Rack A · Piso 2 · Lado izquierdo');
  assert.equal(searchInventory('caricatura nina', products, [], 12, locations)[0].location, undefined);
});

test('incluye ubicaciones por talla y color y permite buscarlas', async () => {
  const { searchInventory } = await import('../app/lib/quick-inventory.ts');
  const products = [{ id: 9, name: 'Essential High Quality', currentStock: 200, minStockAlert: 10, size: null }];
  const slots = new Map([[9, [{ size: '25-28', color: 'Negro', quantity: 40, rack: 'A', level: '2', side: null }]]]);
  const [result] = searchInventory('essential 25-28', products, [], 12, new Map(), slots);
  assert.deepEqual(result.slots, ['Talla 25-28 · Negro: Rack A · Piso 2 (40 pzas)']);
  assert.equal(searchInventory('essential 22-25', products, [], 12, new Map(), slots).length, 0);
});
