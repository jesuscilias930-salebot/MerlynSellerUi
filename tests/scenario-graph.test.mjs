import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowGraph, flowEdges, insertStepAfter, nodeHeight, outputY, reachableSteps, stepPorts } from '../app/lib/scenario-graph.ts';
import { SCENARIO_TEMPLATES, instantiateSteps } from '../app/lib/scenario-templates.ts';

const steps = [
  { id: 'a', type: 'send_text', label: 'Hola', body: 'x', nextStepId: 'b' },
  { id: 'b', type: 'send_options', label: 'Opciones', body: 'y', options: [{ title: 'Uno', nextStepId: 'c' }, { title: 'Dos', nextStepId: 'c' }, { title: 'Ayuda', nextStepId: 'd' }, { title: 'Otra' }] },
  { id: 'c', type: 'send_text', label: 'Confirmar', body: 'z', nextStepId: 'e' },
  { id: 'd', type: 'send_text', label: 'Asesor', body: 'w', nextStepId: 'e' },
  { id: 'e', type: 'end', label: 'Fin' },
  { id: 'x', type: 'send_catalog', label: 'Huérfano' },
];

test('cada opción es una salida propia con su conexión', () => {
  const ports = stepPorts(steps[1]);
  assert.deepEqual(ports.map(p => [p.label, p.to]), [['Uno', 'c'], ['Dos', 'c'], ['Ayuda', 'd'], ['Otra', undefined]]);
  const edges = flowEdges(steps).filter(edge => edge.from === 'b');
  assert.deepEqual(edges.map(edge => [edge.port, edge.to]), [[0, 'c'], [1, 'c'], [2, 'd']]);
  assert.ok(nodeHeight(steps[1]) > nodeHeight(steps[0]), 'la tarjeta crece con las opciones');
  assert.ok(outputY(steps[1], 1) > outputY(steps[1], 0));
  const wait = { id: 'w', type: 'wait_reply', label: 'Espera', branches: [{ id: 'r', name: '', examples: [], nextStepId: 'a' }], fallbackStepId: 'a' };
  assert.deepEqual(stepPorts(wait).map(p => [p.label, p.kind]), [['Respuesta 1', 'branch'], ['Si no entiende', 'fallback']]);
});

test('el inicio es el primer paso, sin encimar tarjetas, y los huérfanos quedan abajo', () => {
  assert.deepEqual([...reachableSteps(steps)].sort(), ['a', 'b', 'c', 'd', 'e']);
  const graph = buildFlowGraph(steps);
  assert.deepEqual([...graph.unreachable], ['x']);
  const pos = id => graph.positions.get(id);
  assert.ok(pos('a').x < pos('b').x && pos('b').x < pos('c').x);
  assert.equal(pos('c').x, pos('d').x);
  assert.ok(pos('d').y >= pos('c').y + graph.heights.get('c'), 'no se enciman');
  assert.ok(pos('e').x > pos('c').x, 'el final a la derecha');
  assert.ok(pos('x').y > graph.orphanTop);
  assert.ok(graph.width > pos('e').x && graph.height > pos('x').y);
});

test('agregar después de un paso lineal lo inserta entre él y su siguiente', () => {
  const next = insertStepAfter(steps, 'c', { id: 'n', type: 'send_text', label: 'Nuevo', body: '' });
  assert.equal(next.find(s => s.id === 'c').nextStepId, 'n');
  assert.equal(next.find(s => s.id === 'n').nextStepId, 'e');
  assert.deepEqual(next.map(s => s.id), ['a', 'b', 'c', 'n', 'd', 'e', 'x']);
});

test('agregar desde una opción la conecta a esa opción', () => {
  const free = insertStepAfter(steps, 'b', { id: 'n', type: 'send_text', label: 'Nuevo', body: '' });
  assert.equal(free.find(s => s.id === 'b').options[3].nextStepId, 'n');
  const port = insertStepAfter(steps, 'b', { id: 'n', type: 'send_text', label: 'Nuevo', body: '' }, 1);
  assert.equal(port.find(s => s.id === 'b').options[1].nextStepId, 'n');
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
