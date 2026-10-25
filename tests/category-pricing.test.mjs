import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesOf, categoryStatus, sizesLabel } from '../app/lib/category-pricing.ts';

const products = [
  { id: 1, name: 'Essential', size: '25-28', category: { id: 5, name: 'Essentials' } },
  { id: 2, name: 'Essential', size: '22-25', category: { id: 5, name: 'Essentials' } },
  { id: 3, name: 'Essential', size: '22-25', category: { id: 5, name: 'Essentials' } },
  { id: 4, name: 'Tin', category: { id: 2, name: 'Tines' } },
  { id: 5, name: 'Sin categoría' },
];
const scale = [{ minQuantity: 50, maxQuantity: 99, pricePerUnit: 22 }, { minQuantity: 1, maxQuantity: 49, pricePerUnit: '24.00' }];

test('agrupa productos por categoría', () => {
  const categories = categoriesOf(products);
  assert.deepEqual(categories.map(c => [c.id, c.name, c.products.length]), [[5, 'Essentials', 3], [2, 'Tines', 1]]);
  assert.equal(sizesLabel(categories[0].products), '25-28, 22-25');
});

test('detecta si toda la categoría comparte la misma escala', () => {
  const status = categoryStatus([1, 2, 3], { 1: scale, 2: [...scale].reverse(), 3: [{ minQuantity: 1, maxQuantity: 99, pricePerUnit: 30 }] });
  assert.deepEqual({ ...status, reference: status.reference.map(r => r.minQuantity) }, { total: 3, without: 0, matching: 2, different: 1, reference: [1, 50], uniform: false });
  assert.equal(categoryStatus([1, 2], { 1: scale, 2: scale }).uniform, true);
  assert.equal(categoryStatus([1, 2], { 1: scale }).without, 1);
});
