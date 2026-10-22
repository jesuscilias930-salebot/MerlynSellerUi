import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSizesDesc, groupBySize, sizeLabel } from '../app/lib/size-groups.ts';

test('agrupa por talla en orden descendente y deja "Sin talla" al final', () => {
  const groups = groupBySize([
    { name: 'Tobillera', size: '22-25' }, { name: 'Deportiva', size: '25-28' }, { name: 'Bebé', size: '2-4' },
    { name: 'Caricatura', size: ' 22-25 ' }, { name: 'Lisa', size: null }, { name: 'Escolar', size: 'Unitalla' }, { name: 'Alta', size: '5-7' },
  ]);
  assert.deepEqual(groups.map(group => group.size), ['Unitalla', '25-28', '22-25', '5-7', '2-4', '']);
  assert.deepEqual(groups[2].items.map(item => item.name), ['Caricatura', 'Tobillera']);
  assert.equal(groups.at(-1).label, 'Sin talla');
  assert.equal(sizeLabel('25-28'), 'Talla 25-28');
  assert.ok(compareSizesDesc('22-25', '25-28') > 0);
});
