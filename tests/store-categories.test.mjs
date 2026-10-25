import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesPayload, categoryIssues, categoryRows, sectionsPreview } from '../app/lib/store-categories.ts';

const categories = [{ id: 6, name: 'Essentials High Quality' }, { id: 5, name: 'Essentials' }, { id: 7, name: 'Tines' }, { id: 0, name: 'x' }];

test('sin configuración cada categoría va sola; con configuración se juntan', () => {
  const rows = categoryRows(categories, [{ categoryId: 6, categoryName: 'Essentials High Quality', section: 'Essentials', position: 1 }]);
  assert.deepEqual(rows.map(row => [row.categoryId, row.section, row.position]), [[5, 'Essentials', '0'], [6, 'Essentials', '1'], [7, 'Tines', '0']]);
  assert.deepEqual(sectionsPreview(rows), [
    { section: 'Essentials', position: 0, categories: ['Essentials', 'Essentials High Quality'] },
    { section: 'Tines', position: 0, categories: ['Tines'] },
  ]);
});

test('unifica mayúsculas y acentos del nombre de sección y valida', () => {
  const rows = [
    { categoryId: 5, categoryName: 'Essentials', section: 'Essentials', position: '0' },
    { categoryId: 6, categoryName: 'Essentials HQ', section: ' essentials ', position: '' },
  ];
  assert.deepEqual(categoriesPayload(rows).categories.map(row => [row.section, row.position]), [['Essentials', 0], ['Essentials', 0]]);
  assert.deepEqual(categoryIssues([{ ...rows[0], section: ' ', position: 'a' }]), ['Escribe en qué sección se muestra cada categoría.', 'El orden debe ser un número de 0 a 999.']);
});
