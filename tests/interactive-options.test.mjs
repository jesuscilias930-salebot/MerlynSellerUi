import test from 'node:test';
import assert from 'node:assert/strict';
import { packageOptionsExample, parseOptionLines, resolveFormat, toOptionsPayload, validateOptionsMessage } from '../app/lib/interactive-options.ts';

test('pegar líneas separa texto y precio, quitando viñetas', () => {
  assert.deepEqual(parseOptionLines('* Caricatura 50 pares · $446.50\n\n- Deportivo Pro 450 pares | $3,999\nAyúdame a elegir'), [
    { title: 'Caricatura 50 pares', description: '$446.50' },
    { title: 'Deportivo Pro 450 pares', description: '$3,999' },
    { title: 'Ayúdame a elegir' },
  ]);
});

test('el ejemplo de paquetes es válido y se envía como lista', () => {
  const example = packageOptionsExample();
  assert.equal(example.options.length, 6);
  assert.deepEqual(validateOptionsMessage(example), []);
  assert.equal(resolveFormat(example.format, example.options), 'list');
  const payload = toOptionsPayload(example);
  assert.equal(payload.buttonText, 'Ver paquetes');
  assert.equal(payload.options[0].description, '$446.50');
});

test('formato automático usa botones solo si caben', () => {
  assert.equal(resolveFormat('auto', [{ title: 'Sí' }, { title: 'No' }]), 'buttons');
  assert.equal(resolveFormat('auto', [{ title: 'Sí', description: 'x' }]), 'list');
  const payload = toOptionsPayload({ format: 'auto', body: ' Hola ', buttonText: 'Ver', options: [{ title: 'Sí ' }, { title: '' }] });
  assert.deepEqual(payload, { format: 'auto', header: undefined, body: 'Hola', footer: undefined, options: [{ title: 'Sí' }] });
});

test('valida límites de WhatsApp con mensajes claros', () => {
  const base = { body: 'Hola', options: [{ title: 'Uno' }] };
  assert.deepEqual(validateOptionsMessage(base), []);
  assert.match(validateOptionsMessage({ ...base, body: ' ' }).join(), /texto del mensaje/);
  assert.match(validateOptionsMessage({ ...base, options: [{ title: 'Caricatura 50 pares · $446.50' }] }).join(), /supera 24/);
  assert.match(validateOptionsMessage({ ...base, format: 'buttons', options: ['a', 'b', 'c', 'd'].map(title => ({ title })) }).join(), /Usa lista/);
  assert.match(validateOptionsMessage({ ...base, options: [{ title: 'Sí' }, { title: 'SÍ' }] }).join(), /repetida/);
  assert.match(validateOptionsMessage({ ...base, options: Array.from({ length: 11 }, (_, i) => ({ title: `Opción ${i}` })) }).join(), /máximo 10/);
});
