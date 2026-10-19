import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleIssues, toHoursPayload, DAY_ORDER } from '../app/lib/business-hours.ts';

const base = () => ({
  enabled: true, timezone: 'America/Mexico_City', closedDates: [], defaultMessage: 'Fuera de horario', rules: [], moveToAttention: true, continueAutomations: false,
  schedule: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: day !== 0, intervals: day !== 0 ? [{ start: '08:00', end: '18:00' }] : [] })),
});

test('lunes primero y sin problemas con el horario por defecto', () => {
  assert.deepEqual(DAY_ORDER, [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(scheduleIssues(base()), []);
});

test('detecta horas invertidas, encimadas, día abierto sin horario y mensajes incompletos', () => {
  const config = base();
  config.schedule[1].intervals = [{ start: '18:00', end: '08:00' }];
  config.schedule[2].intervals = [{ start: '08:00', end: '14:00' }, { start: '13:00', end: '18:00' }];
  config.schedule[3].intervals = [];
  config.defaultMessage = ' ';
  config.rules = [{ id: 'a', name: 'Precios', examples: [' '], body: 'x' }];
  assert.deepEqual(scheduleIssues(config), [
    'El lunes: la hora de cierre debe ser después de la de apertura.',
    'El martes tiene horarios que se enciman.',
    'Agrega un horario al miércoles o márcalo como cerrado.',
    'Escribe el mensaje general fuera de horario.',
    'Completa nombre, frases y mensaje del mensaje 1.',
  ]);
});

test('el payload limpia frases vacías y horarios de días cerrados', () => {
  const config = base();
  config.schedule[0] = { day: 0, open: false, intervals: [{ start: '09:00', end: '13:00' }] };
  config.rules = [{ id: 'a', name: ' Precios ', examples: ['precio', ' ', ' cuánto '], body: ' Hola ' }];
  const payload = toHoursPayload(config);
  assert.deepEqual(payload.schedule[0].intervals, []);
  assert.deepEqual(payload.rules[0], { id: 'a', name: 'Precios', examples: ['precio', 'cuánto'], body: 'Hola' });
});
