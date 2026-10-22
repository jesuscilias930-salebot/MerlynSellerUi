import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVariants, cellKey, detailMaps, existingCells, groupModels, sortSizes, uniqueValues, variantName } from '../app/lib/product-variants.ts';

const products = [
  { id: 1, name: 'Deportiva · Negro', size: '25-28', gender: 'Hombre', category: { id: 2, name: 'Deportivo' }, currentStock: 30, minStockAlert: 12 },
  { id: 2, name: 'Deportiva · Blanco', size: '25-28', gender: 'Hombre', category: { id: 2, name: 'Deportivo' }, currentStock: 4, minStockAlert: 12 },
  { id: 3, name: 'Deportiva · Negro', size: '22-25', gender: 'Hombre', category: { id: 2, name: 'Deportivo' }, currentStock: 10, minStockAlert: 5 },
  { id: 4, name: 'Deportiva · Negro', size: '22-25', gender: 'Mujer', category: { id: 2, name: 'Deportivo' }, currentStock: 8, minStockAlert: 5 },
  { id: 5, name: 'Tobillera', size: 'Unitalla', gender: 'Mujer', category: { id: 3, name: 'Básicos' }, currentStock: 0, minStockAlert: 5 },
];
const { colors, models } = detailMaps([
  { productId: 1, color: 'Negro', model: 'Deportiva' }, { productId: 2, color: 'Blanco', model: 'deportiva' },
  { productId: 3, color: 'negro', model: 'Deportiva' }, { productId: 4, color: 'Negro', model: 'Deportiva' }, { productId: 5, color: 'Rosa', model: null },
]);

test('mapas de detalle, nombres y valores únicos', () => {
  assert.deepEqual(colors[5], 'Rosa'); assert.equal(models[5], undefined);
  assert.deepEqual(uniqueValues([' Negro', 'negro', '', 'Blanco ', null]), ['Negro', 'Blanco']);
  assert.equal(variantName(' Deportiva  algodón ', 'Negro'), 'Deportiva algodón · Negro');
  assert.equal(variantName('Deportiva', ''), 'Deportiva');
  assert.deepEqual(sortSizes(['Unitalla', '25-28', '2-4', '22-25', '5-7']), ['2-4', '5-7', '22-25', '25-28', 'Unitalla']);
});

test('genera combinaciones color × talla', () => {
  const combos = buildVariants('Deportiva', ['Negro', 'Blanco', 'negro'], ['22-25', '25-28']);
  assert.equal(combos.length, 4);
  assert.deepEqual(combos[0], { color: 'Negro', size: '22-25', name: 'Deportiva · Negro', key: 'negro|22-25' });
  assert.equal(buildVariants('Deportiva', [], ['22-25']).length, 1);
  assert.equal(buildVariants('Deportiva', [], []).length, 1);
});

test('agrupa por modelo, categoría y género', () => {
  const { groups, loose } = groupModels(products, models, colors);
  assert.deepEqual(loose.map(product => product.id), [5]);
  assert.equal(groups.length, 2);
  const men = groups.find(group => group.gender === 'Hombre');
  assert.deepEqual(men.colors, ['Negro', 'Blanco']);
  assert.deepEqual(men.sizes, ['22-25', '25-28']);
  assert.equal(men.cells[cellKey('Negro', '22-25')].id, 3);
  assert.equal(men.stock, 44); assert.equal(men.low, 1);
  const cells = existingCells(products, models, colors, 'DEPORTIVA', '2', 'Hombre');
  assert.ok(cells.has('negro|25-28')); assert.ok(!cells.has('rojo|25-28'));
});
