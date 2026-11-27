import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignNames, groupByCampaign, scenarioTab } from '../app/lib/scenario-groups.ts';

const s = (id, campaign, templateTrigger = null) => ({ id, campaign, templateTrigger });

test('pestañas: con plantilla va a «de plantilla»', () => {
  assert.equal(scenarioTab(s('a', null)), 'normal');
  assert.equal(scenarioTab(s('b', null, { templateId: 't' })), 'template');
});

test('grupos por campaña en orden alfabético, «Genérico» al final y sin reordenar dentro', () => {
  const list = [s('1', null), s('2', 'Campaña 120'), s('3', 'Essentials'), s('4', ' campaña 120 '), s('5', ''), s('6', 'Campaña 20')];
  assert.deepEqual(campaignNames(list), ['Campaña 20', 'Campaña 120', 'Essentials']);
  const groups = groupByCampaign(list);
  assert.deepEqual(groups.map(g => [g.label, g.scenarios.map(x => x.id)]), [['Campaña 20', ['6']], ['Campaña 120', ['2', '4']], ['Essentials', ['3']], ['Genérico', ['1', '5']]]);
  assert.deepEqual(groupByCampaign([]), []);
});

import { belongsToBoard, scenarioBoardIds } from '../app/lib/scenario-groups.ts';
test('dashboard del escenario: explícito o por las columnas a las que mueve', () => {
  const boardOf = new Map([['c-120', 'b-120'], ['c-ess', 'b-ess']]);
  const moves120 = { steps: [{ type: 'send_text' }, { type: 'move_column', columnId: 'c-120' }] };
  assert.deepEqual([...scenarioBoardIds(moves120, boardOf)], ['b-120']);
  assert.ok(belongsToBoard({ boardId: 'b-ess', steps: [] }, 'b-ess', boardOf));
  assert.ok(!belongsToBoard({ steps: [{ type: 'move_column', columnId: 'borrada' }] }, 'b-120', boardOf));
  assert.deepEqual([...scenarioBoardIds({ boardId: 'b-ess', ...moves120 }, boardOf)].sort(), ['b-120', 'b-ess']);
});
