import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleIssues, rulePayload, splitPhrases, testRules } from '../app/lib/column-rules.ts';

test('separa frases por renglón o coma y valida', () => {
  assert.deepEqual(splitPhrases('precio de mayoreo\n distribuidor , ,'), ['precio de mayoreo', 'distribuidor']);
  assert.deepEqual(ruleIssues({ name: '', phrases: '', matchMode: 'contains', columnId: '', isActive: true }).length, 3);
  assert.deepEqual(rulePayload({ name: ' Mayoreo ', phrases: 'a, b', matchMode: 'exact', columnId: 'c', isActive: false }), { name: 'Mayoreo', phrases: ['a', 'b'], matchMode: 'exact', columnId: 'c', isActive: false });
});

test('prueba un mensaje como lo hará el servidor', () => {
  const rules = [{ id: 'r1', phrases: ['precio de mayoreo'], matchMode: 'contains', isActive: true }, { id: 'r2', phrases: ['hola'], matchMode: 'exact', isActive: true }];
  assert.equal(testRules(rules, '¿Cuál es el PRECIO de mayoreo?')?.id, 'r1');
  assert.equal(testRules(rules, 'Hola!')?.id, 'r2');
  assert.equal(testRules(rules, 'hola, precio'), null);
});
