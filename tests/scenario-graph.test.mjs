import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowGraph, edgeLabel, flowEdges, insertStepAfter, reachableSteps } from '../app/lib/scenario-graph.ts';
import { SCENARIO_TEMPLATES, instantiateSteps } from '../app/lib/scenario-templates.ts';

const steps = [
  { id: 'a', type: 'send_text', label: 'Hola', body: 'x', nextStepId: 'b' },
  { id: 'b', type: 'send_options', label: 'Opciones', body: 'y', options: [{ title: 'Uno', nextStepId: 'c' }, { title: 'Dos', nextStepId: 'c' }, { title: 'Ayuda', nextStepId: 'd' }, { title: 'Otra' }] },
  { id: 'c', type: 'send_text', label: 'Confirmar', body: 'z', nextStepId: 'e' },
  { id: 'd', type: 'send_text', label: 'Asesor', body: 'w', nextStepId: 'e' },
  { id: 'e', type: 'end', label: 'Fin' },
  { id: 'x', type: 'send_catalog', label: 'Huérfano' },
];

test('las opciones al mismo paso se agrupan en una conexión', () => {
  const edges = flowEdges(steps).filter(edge => edge.from === 'b');
  assert.deepEqual(edges.map(edge => [edge.to, edge.labels]), [['c', ['Uno', 'Dos']], ['d', ['Ayuda']]]);
  assert.equal(edgeLabel(edges[0]), '2 opciones');
});

test('el inicio es el primer paso y los huérfanos quedan aparte', () => {
  assert.deepEqual([...reachableSteps(steps)].sort(), ['a', 'b', 'c', 'd', 'e']);
  const graph = buildFlowGraph(steps);
  assert.deepEqual([...graph.unreachable], ['x']);
  assert.equal(graph.startId, 'a');
  const pos = id => graph.positions.get(id);
  assert.ok(pos('a').x < pos('b').x && pos('b').x < pos('c').x, 'columnas por nivel');
  assert.equal(pos('c').x, pos('d').x);
  assert.ok(pos('c').y < pos('d').y, 'orden de las opciones');
  assert.ok(pos('x').y > Math.max(pos('c').y, pos('d').y), 'huérfano debajo');
});

test('agregar después de un paso lineal lo inserta entre él y su siguiente', () => {
  const next = insertStepAfter(steps, 'c', { id: 'n', type: 'send_text', label: 'Nuevo', body: '' });
  assert.equal(next.find(s => s.id === 'c').nextStepId, 'n');
  assert.equal(next.find(s => s.id === 'n').nextStepId, 'e');
  assert.deepEqual(next.map(s => s.id), ['a', 'b', 'c', 'n', 'd', 'e', 'x']);
  const end = insertStepAfter(steps, 'c', { id: 'f', type: 'end', label: 'Fin 2' });
  assert.equal(end.find(s => s.id === 'f').nextStepId, undefined);
});

test('agregar después de opciones conecta la primera opción sin destino', () => {
  const next = insertStepAfter(steps, 'b', { id: 'n', type: 'send_text', label: 'Nuevo', body: '' });
  assert.equal(next.find(s => s.id === 'b').options[3].nextStepId, 'n');
  const wait = insertStepAfter([{ id: 'w', type: 'wait_reply', label: 'Espera', branches: [] }], 'w', { id: 'n', type: 'end', label: 'Fin' });
  assert.equal(wait[0].branches[0].nextStepId, 'n');
});

test('las plantillas generan ids únicos y conexiones válidas', () => {
  let counter = 0;
  for (const template of SCENARIO_TEMPLATES) {
    const created = instantiateSteps(template, () => `s${counter++}`);
    const ids = new Set(created.map(s => s.id));
    assert.equal(ids.size, created.length, template.id);
    for (const s of created) for (const ref of [s.nextStepId, ...(s.options || []).map(o => o.nextStepId)].filter(Boolean)) assert.ok(ids.has(ref), `${template.id}: ${ref}`);
    assert.equal(buildFlowGraph(created).unreachable.size, 0, template.id);
  }
});
