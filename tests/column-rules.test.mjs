import test from 'node:test';
import assert from 'node:assert/strict';
import { nationalNumber, ruleIssues, rulePayload, splitPhrases, testRules } from '../app/lib/column-rules.ts';

test('separa frases por renglón o coma y valida', () => {
  assert.deepEqual(splitPhrases('precio de mayoreo\n distribuidor , ,'), ['precio de mayoreo', 'distribuidor']);
  assert.deepEqual(ruleIssues({ name: '', phrases: '', areaCodes: '', matchMode: 'contains', columnId: '', isActive: true }).length, 3);
  assert.deepEqual(rulePayload({ name: ' Mayoreo ', phrases: 'a, b', areaCodes: '272, (278) 272', matchMode: 'exact', columnId: 'c', isActive: false }), { name: 'Mayoreo', phrases: ['a', 'b'], areaCodes: ['272', '278'], matchMode: 'exact', columnId: 'c', isActive: false });
});

test('prueba un mensaje como lo hará el servidor', () => {
  const rules = [{ id: 'r1', phrases: ['precio de mayoreo'], matchMode: 'contains', isActive: true }, { id: 'r2', phrases: ['hola'], matchMode: 'exact', isActive: true }];
  assert.equal(testRules(rules, '¿Cuál es el PRECIO de mayoreo?')?.id, 'r1');
  assert.equal(testRules(rules, 'Hola!')?.id, 'r2');
  assert.equal(testRules(rules, 'hola, precio'), null);
});

test('prueba por lada como el servidor', () => {
  const rules = [
    { id: 'general', phrases: ['catalogo'], matchMode: 'contains', isActive: true },
    { id: 'orizaba', phrases: ['catalogo'], areaCodes: ['272'], matchMode: 'contains', isActive: true },
    { id: 'cdmx', phrases: [], areaCodes: ['55'], matchMode: 'contains', isActive: true },
  ];
  assert.equal(testRules(rules, 'el catálogo', '272 123 4567')?.id, 'orizaba');
  assert.equal(testRules(rules, 'el catálogo', '+52 1 33 1111 2222')?.id, 'general');
  assert.equal(testRules(rules, 'hola', '5215512345678')?.id, 'cdmx');
  assert.equal(testRules(rules, 'hola', ''), null);
  assert.equal(nationalNumber('fb:123'), null);
  assert.ok(ruleIssues({ name: 'x', phrases: '', areaCodes: '2721234567', matchMode: 'contains', columnId: 'c', isActive: true })[0].includes('no es una lada'));
  assert.deepEqual(ruleIssues({ name: 'x', phrases: '', areaCodes: '272', matchMode: 'contains', columnId: 'c', isActive: true }), []);
});
