import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, bundleRow, matchesQuery, parseQuery, productRow, sizeMatrix, sortRows } from '../app/lib/inventory-view.ts';

const cat = { id: 10, name: 'Caricatura' }, basic = { id: 30, name: 'Básicos' };
const products = [
  { id: 1, name: 'Caricatura niño', currentStock: 30, minStockAlert: 5, category: cat, gender: 'MALE', size: '2-4', color: 'Azul' },
  { id: 2, name: 'Caricatura niña', currentStock: 4, minStockAlert: 5, category: cat, gender: 'FEMALE', size: '2-4', color: 'Rosa' },
  { id: 3, name: 'Caricatura niña', currentStock: 0, minStockAlert: 5, category: cat, gender: 'FEMALE', size: '5-7', color: 'Rosa' },
  { id: 4, name: 'Essential High Quality', currentStock: 48, minStockAlert: 10, category: basic, gender: 'Hombre', size: '25-28', color: 'Negro' },
  { id: 5, name: 'Essential High Quality', currentStock: 6, minStockAlert: 10, category: basic, gender: 'Hombre', size: '22-24', color: 'Negro' },
  { id: 6, name: 'Essential High Quality', currentStock: 12, minStockAlert: 2, category: basic, gender: 'Hombre', size: '25-28', color: 'Blanco' },
];
const rows = [...products.map((product, index) => productRow(product, index === 3 ? 'Rack A · Piso 2' : '')), bundleRow({ id: 9, name: 'Caricatura 100 pares' }, 3)];

test('cada producto trae su estado y su categoría', () => {
  assert.deepEqual(rows.map(row => row.level), ['ready', 'low', 'empty', 'ready', 'low', 'ready', 'ready']);
  assert.equal(rows[0].gender, 'Hombre');
  assert.equal(rows[6].categoryKey, 'bundles');
});

test('la talla se busca exacta y las palabras desde su inicio', () => {
  const ids = (text) => rows.filter(row => matchesQuery(row, parseQuery(text))).map(row => row.id);
  assert.deepEqual(ids('essential negro 25-28'), [4]);
  assert.deepEqual(ids('caricatura 2-4'), [1, 2]);
  assert.deepEqual(ids('nina rosa'), [2, 3]);
  assert.deepEqual(ids('rack a'), [4]);
  assert.deepEqual(ids('25 - 28'), [4, 6]);
  assert.deepEqual(ids('zz'), []);
});

test('filtros y contadores se combinan', () => {
  const all = applyFilters(rows, { query: '', level: 'all', category: '' });
  assert.equal(all.results.length, 7);
  assert.deepEqual(all.levels, { all: 7, ready: 4, low: 2, empty: 1 });
  assert.deepEqual(all.categories.map(item => [item.name, item.count]), [['Básicos', 3], ['Caricatura', 3], ['Paquetes', 1]]);
  const low = applyFilters(rows, { query: '', level: 'low', category: '' });
  assert.deepEqual(low.results.map(row => row.id), [5, 2]);
  assert.deepEqual(low.categories.map(item => item.count), [1, 1, 0]);
  const cari = applyFilters(rows, { query: 'caricatura', level: 'all', category: '10' });
  assert.deepEqual(cari.results.map(row => row.id), [2, 3, 1]);
  assert.deepEqual(cari.levels, { all: 3, ready: 1, low: 1, empty: 1 });
});

test('orden: categoría, nombre, color y talla natural; paquetes al final', () => {
  assert.deepEqual(sortRows(rows).map(row => row.id), [6, 5, 4, 2, 3, 1, 9]);
});

test('tabla por tallas: una fila por producto y color, columnas ordenadas', () => {
  const groups = sizeMatrix(rows);
  assert.deepEqual(groups.map(group => group.name), ['Básicos', 'Caricatura']);
  assert.deepEqual(groups[0].sizes, ['22-24', '25-28']);
  assert.deepEqual(groups[0].lines.map(line => [line.title, line.detail, line.total]), [['Essential High Quality', 'Blanco · Hombre', 12], ['Essential High Quality', 'Negro · Hombre', 54]]);
  assert.equal(groups[0].lines[1].cells.get('22-24').id, 5);
  assert.deepEqual(groups[1].sizes, ['2-4', '5-7']);
});

test('edición de existencias: solo cuenta lo que cambió y marca lo inválido', async () => {
  const { stockChanges, parseStock } = await import('../app/lib/inventory-view.ts');
  assert.equal(parseStock(' 1,200 '), 1200);
  assert.equal(parseStock('-1'), undefined);
  assert.equal(parseStock('2.5'), undefined);
  assert.equal(parseStock(''), undefined);
  const drafts = new Map([[1, '30'], [2, '10'], [3, 'x'], [9, '5'], [99, '4']]);
  const result = stockChanges(drafts, rows);
  assert.deepEqual(result.changes, [{ id: 2, name: 'Caricatura niña · Rosa · Talla 2-4', from: 4, to: 10 }]);
  assert.deepEqual(result.invalid, [3]);
});
