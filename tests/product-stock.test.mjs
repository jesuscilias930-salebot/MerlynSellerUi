import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFamilies, itemStatus, previewCaption } from '../app/lib/product-stock.ts';

const families = [
  { productId: 1, title: 'Caricatura niña · Niña', category: 'Caricatura', sizes: ['2-4', '8-10'], caption: 'Tallas disponibles: 2-4, 8-10', stock: 13, photos: [{ id: 11, url: 'u' }], productIds: [1, 2, 3] },
  { productId: 4, title: 'Playera básica · Negro · Unisex', category: 'Ropa', sizes: ['CH', 'M'], caption: 'Tallas disponibles: CH, M', stock: 8, photos: [], productIds: [4, 5] },
  { productId: 8, title: 'Tobillera · Mujer', category: 'Básicos', sizes: [], caption: null, stock: 0, photos: [{ id: 88, url: 'u' }], productIds: [8] },
];

test('busca por palabras y talla; oculta agotados si se pide', () => {
  assert.deepEqual(filterFamilies(families, 'nina').map(f => f.productId), [1]);
  assert.deepEqual(filterFamilies(families, 'negro m').map(f => f.productId), [4]);
  assert.deepEqual(filterFamilies(families, '').map(f => f.productId), [1, 4]);
  assert.deepEqual(filterFamilies(families, 'tobillera', false).map(f => f.productId), [8]);
});

test('texto final y estado de cada producto', () => {
  assert.equal(previewCaption('Nuevo modelo', families[0]), 'Nuevo modelo\nTallas disponibles: 2-4, 8-10');
  assert.equal(previewCaption('', families[0]), 'Tallas disponibles: 2-4, 8-10');
  assert.equal(previewCaption('x', families[2]), null);
  assert.equal(itemStatus(families[0], false), 'ready');
  assert.equal(itemStatus(families[1], false), 'noPhoto');
  assert.equal(itemStatus(families[1], true), 'ready');
  assert.equal(itemStatus(families[2], true), 'soldOut');
  assert.equal(itemStatus(undefined, true), 'missing');
});
