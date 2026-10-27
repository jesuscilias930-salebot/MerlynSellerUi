import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOptions } from '../app/lib/autocomplete.ts';

const options = [
  { value: '1', label: 'Essential High Quality · Negro · Talla 25-28', keywords: 'Essentials Hombre' },
  { value: '2', label: 'Essential High Quality · Blanco · Talla 22-25', keywords: 'Essentials Mujer' },
  { value: '3', label: 'Calcetín caricatura', detail: '30 disponibles', keywords: 'Caricatura Niño' },
];

test('filtra por todas las palabras sin importar acentos ni orden', () => {
  assert.deepEqual(filterOptions(options, 'negro essential').map(o => o.value), ['1']);
  assert.deepEqual(filterOptions(options, 'calcetin nino').map(o => o.value), ['3']);
  assert.deepEqual(filterOptions(options, '22-25').map(o => o.value), ['2']);
  assert.deepEqual(filterOptions(options, '').map(o => o.value), ['1', '2', '3']);
  assert.deepEqual(filterOptions(options, 'tines'), []);
});

test('prioriza lo que empieza igual que lo escrito', () => {
  const ranked = filterOptions([{ value: 'a', label: 'Tin deportivo', keywords: 'caricatura' }, { value: 'b', label: 'Caricatura dama' }], 'caricatura');
  assert.deepEqual(ranked.map(o => o.value), ['b', 'a']);
});
