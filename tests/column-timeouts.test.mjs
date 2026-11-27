import test from 'node:test';
import assert from 'node:assert/strict';
import { timeoutDraft, timeoutMinutes, timeoutSummary } from '../app/lib/follow-ups.ts';

test('espera del ⏳: mínimo 30 min, máximo 90 días', () => {
  assert.deepEqual(timeoutMinutes('3', 'days'), { minutes: 4320 });
  assert.deepEqual(timeoutMinutes('2', 'hours'), { minutes: 120 });
  assert.match(timeoutMinutes('10', 'minutes').error, /mínima/);
  assert.match(timeoutMinutes('91', 'days').error, /máxima/);
  assert.match(timeoutMinutes('', 'days').error, /cuánto/);
});

test('resumen y borrador', () => {
  const names = { r2: 'R2' };
  assert.equal(timeoutSummary({ waitMinutes: 4320, targetColumnId: 'r2' }, id => names[id]), '3 días sin respuesta → R2');
  assert.match(timeoutSummary({ waitMinutes: 60, targetColumnId: 'x' }, () => undefined), /columna eliminada/);
  assert.deepEqual(timeoutDraft(null), { waitValue: '3', waitUnit: 'days', targetColumnId: '', isActive: true });
  assert.deepEqual(timeoutDraft({ id: 't', columnId: 'c', targetColumnId: 'r2', waitMinutes: 120, isActive: false }), { waitValue: '2', waitUnit: 'hours', targetColumnId: 'r2', isActive: false });
});
