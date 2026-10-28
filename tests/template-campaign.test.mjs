import test from 'node:test';
import assert from 'node:assert/strict';
import { templateCampaignIssues, templateCampaignPreview } from '../app/lib/template-campaign.ts';

const template = {
  components: [{ type: 'BODY', text: 'Hola {{1}}, tenemos {{2}}.' }, { type: 'FOOTER', text: 'Merlyn Mayoreo' }],
  variables: [{ component: 'body', position: 1 }, { component: 'body', position: 2 }],
  mappings: [{ component: 'body', position: 1, source: 'contact.name' }, { component: 'body', position: 2, source: 'manual', label: 'Novedad' }],
};

test('vista previa y validación de la plantilla masiva', () => {
  assert.equal(templateCampaignPreview(template, { 'body:2': 'paquetes nuevos' }), 'Hola [nombre del cliente], tenemos paquetes nuevos.\n\nMerlyn Mayoreo');
  assert.deepEqual(templateCampaignIssues(template, {}), ['Escribe el valor de «Novedad».']);
  assert.deepEqual(templateCampaignIssues(template, { 'body:2': 'x' }), []);
  assert.deepEqual(templateCampaignIssues({ ...template, mappings: [] }, {}).length, 2);
  assert.match(templateCampaignIssues({ ...template, components: [{ type: 'HEADER', format: 'IMAGE' }] }, { 'body:2': 'x' })[0], /encabezado/);
});
