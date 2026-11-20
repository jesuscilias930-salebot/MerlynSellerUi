import test from 'node:test';
import assert from 'node:assert/strict';
import { chatDay, dayOffset, leadsInRange, rangeLabel } from '../app/lib/lead-move.ts';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const leads = [
  { id: 'a', lastMessageAt: at(2026, 11, 18, 23), updated_at: at(2026, 11, 1) },
  { id: 'b', lastMessageAt: at(2026, 11, 20, 0), updated_at: at(2026, 11, 1) },
  { id: 'c', lastMessageAt: null, updated_at: at(2026, 11, 10) },
];

test('sin fechas entran todos; con fechas, por el día local del último mensaje', () => {
  assert.equal(leadsInRange(leads, {}), leads);
  assert.deepEqual(leadsInRange(leads, { from: '2026-11-18', to: '2026-11-18' }).map(l => l.id), ['a']);
  assert.deepEqual(leadsInRange(leads, { from: '2026-11-19' }).map(l => l.id), ['b']);
  assert.deepEqual(leadsInRange(leads, { to: '2026-11-15' }).map(l => l.id), ['c']);
  assert.equal(chatDay(leads[2]), '2026-11-10');
});

test('textos y atajos de fechas', () => {
  assert.match(rangeLabel({ from: '2026-11-01', to: '2026-11-15' }), /^del 1 .*nov.* al 15 .*nov/);
  assert.match(rangeLabel({ to: '2026-11-15' }), /^hasta el 15/);
  assert.equal(rangeLabel({}), '');
  assert.equal(dayOffset(-7, new Date(2026, 10, 20, 10)), '2026-11-13');
});
