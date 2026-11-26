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
