import test from 'node:test';
import assert from 'node:assert/strict';
import { followUpStatusLabel, sequenceSummary, splitWait, stepIssues, toMinutes, waitLabel } from '../app/lib/follow-ups.ts';

test('esperas en minutos, horas y días', () => {
  assert.deepEqual(splitWait(1440), { value: 1, unit: 'days' });
  assert.deepEqual(splitWait(180), { value: 3, unit: 'hours' });
  assert.deepEqual(splitWait(45), { value: 45, unit: 'minutes' });
  assert.equal(toMinutes(3, 'days'), 4320); assert.equal(toMinutes(1.5, 'hours'), 90);
  assert.equal(waitLabel(60), '1 h'); assert.equal(waitLabel(4320), '3 días');
  assert.equal(sequenceSummary({ steps: [{ waitMinutes: 60 }, { waitMinutes: 1440 }], finalColumnId: 'c' }, () => 'Frío'), '1 h → 1 día · luego a Frío');
});

test('valida pasos antes de guardar', () => {
  assert.deepEqual(stepIssues([{ waitMinutes: 60, text: 'Hola' }]), []);
  assert.match(stepIssues([{ waitMinutes: 10, text: 'x' }])[0], /mínima/);
  assert.match(stepIssues([{ waitMinutes: 60, text: '  ' }])[0], /escribe un mensaje/);
  assert.match(stepIssues(Array(4).fill({ waitMinutes: 60, text: 'x' }))[0], /Hasta 3/);
});

test('estado del seguimiento en el chat', () => {
  const now = Date.parse('2026-11-24T18:00:00Z');
  assert.equal(followUpStatusLabel({ enabled: false }), null);
  assert.equal(followUpStatusLabel({ enabled: true, columnName: 'A', totalSteps: 3, stepIndex: 0, status: 'active', stoppedReason: null, nextAt: '2026-11-24T20:00:00Z', waitingForCustomer: false }, now), 'Seguimiento: paso 1 de 3 en 2 h');
  assert.match(followUpStatusLabel({ enabled: true, columnName: 'A', totalSteps: 3, stepIndex: 1, status: 'stopped', stoppedReason: 'Detenido a mano', nextAt: null, waitingForCustomer: false }, now), /detenido: Detenido a mano/);
  assert.match(followUpStatusLabel({ enabled: true, columnName: 'A', totalSteps: 2, stepIndex: 2, status: 'completed', stoppedReason: null, nextAt: null, waitingForCustomer: false }, now), /terminado/);
});
