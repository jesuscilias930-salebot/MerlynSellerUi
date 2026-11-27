import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledLabel, scheduleSummary, timeLabel } from '../app/lib/remarketing-schedule.ts';

test('horas legibles', () => {
  assert.equal(timeLabel('21:00'), '9:00 p. m.');
  assert.equal(timeLabel('09:05'), '9:05 a. m.');
  assert.equal(timeLabel('00:30'), '12:30 a. m.');
  assert.equal(timeLabel('12:00'), '12:00 p. m.');
  assert.equal(scheduleSummary({ isActive: true, pauseAt: '21:00', resumeAt: '09:00', deferCampaigns: true }), 'Pausa de 9:00 p. m. a 9:00 a. m.');
  assert.match(scheduleSummary({ isActive: false, pauseAt: '21:00', resumeAt: '09:00', deferCampaigns: true }), /Sin pausa/);
});

test('etiqueta de programado: hoy, mañana u otra fecha', () => {
  const now = new Date(2026, 10, 26, 22, 0);
  assert.equal(scheduledLabel(new Date(2026, 10, 26, 23, 30).toISOString(), now), '11:30 p. m.');
  assert.equal(scheduledLabel(new Date(2026, 10, 27, 9, 0).toISOString(), now), 'mañana 9:00 a. m.');
  assert.match(scheduledLabel(new Date(2026, 10, 29, 9, 0).toISOString(), now), /9:00 a\. m\.$/);
  assert.equal(scheduledLabel('nope', now), '');
});
