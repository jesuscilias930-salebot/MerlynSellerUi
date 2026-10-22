import test from 'node:test';
import assert from 'node:assert/strict';
import { colorMap, colorSwatch, normalizeColor } from '../app/lib/product-colors.ts';

test('normaliza y mapea colores por producto', () => {
  assert.equal(normalizeColor('  azul   marino '), 'azul marino');
  assert.equal(normalizeColor('x'.repeat(60)).length, 40);
  assert.deepEqual(colorMap([{ productId: 3, color: 'Negro' }, { productId: 0, color: 'Rojo' }, { productId: 4, color: '' }]), { 3: 'Negro' });
  assert.deepEqual(colorMap(null), {});
});

test('elige la muestra más específica sin importar acentos', () => {
  assert.equal(colorSwatch('Azul marino'), '#1f2d56');
  assert.equal(colorSwatch('azul'), '#2d5bd2');
  assert.equal(colorSwatch('CAFÉ'), '#7a4e2d');
  assert.match(colorSwatch('Surtido') || '', /gradient/);
  assert.equal(colorSwatch('Tornasol'), null);
  assert.equal(colorSwatch(''), null);
});
