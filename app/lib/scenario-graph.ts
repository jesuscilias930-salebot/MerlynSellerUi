import type { ScenarioStep } from "./types";

// Medidas del lienzo (en px del lienzo, antes del zoom).
export const NODE_WIDTH = 248;
const HEAD_HEIGHT = 88;
export const PORT_TOP = 76;
export const PORT_ROW = 28;
export const START_WIDTH = 190;
export const START_HEIGHT = 120;
const START_X = 40;
const FIRST_X = START_X + START_WIDTH + 90;
const COLUMN = NODE_WIDTH + 150;
const TOP = 60;
const GAP = 46;
/** Altura del centro de la entrada respecto al borde superior de la tarjeta. */
export const INPUT_Y = 40;

export type FlowPort = { index: number; label: string; to?: string; kind: "branch" | "fallback" };
export type FlowEdge = { from: string; to: string; kind: "direct" | "fallback" | "branch"; port?: number; label: string };
export type FlowGraph = {
  edges: FlowEdge[];
  positions: Map<string, { x: number; y: number }>;
  heights: Map<string, number>;
  unreachable: Set<string>;
  startId?: string;
  start: { x: number; y: number };
  orphanTop: number;
  width: number;
  height: number;
};

/** Pasos que esperan al cliente y se conectan por opción o respuesta. */
export const BRANCHING_TYPES: ScenarioStep["type"][] = ["wait_reply", "send_options"];
export const hasNext = (step: ScenarioStep) => !BRANCHING_TYPES.includes(step.type) && step.type !== "end";

/** Salidas con nombre de un paso (una por opción o respuesta, más «si no entiende»). */
export function stepPorts(step: ScenarioStep): FlowPort[] {
  const ports: FlowPort[] = [];
  if (step.type === "send_options")
    (step.options || []).forEach((option, index) => { if (option.title.trim()) ports.push({ index, label: option.title.trim(), to: option.nextStepId, kind: "branch" }); });
  if (step.type === "wait_reply")
    (step.branches || []).forEach((branch, index) => ports.push({ index, label: branch.name.trim() || `Respuesta ${index + 1}`, to: branch.nextStepId || undefined, kind: "branch" }));
  if (step.fallbackStepId && BRANCHING_TYPES.includes(step.type))
    ports.push({ index: -1, label: "Si no entiende", to: step.fallbackStepId, kind: "fallback" });
  return ports;
}
export const nodeHeight = (step: ScenarioStep) => {
  const ports = stepPorts(step).length;
  return ports ? PORT_TOP + ports * PORT_ROW + 12 : HEAD_HEIGHT;
};
/** Altura (desde el borde superior) de la salida `slot`; sin puertos es la salida única. */
export const outputY = (step: ScenarioStep, slot?: number) =>
  slot === undefined ? HEAD_HEIGHT / 2 : PORT_TOP + slot * PORT_ROW + PORT_ROW / 2;

export function flowEdges(steps: ScenarioStep[]): FlowEdge[] {
  const ids = new Set(steps.map(step => step.id));
  const edges: FlowEdge[] = [];
  for (const step of steps) {
    if (step.nextStepId && ids.has(step.nextStepId) && !BRANCHING_TYPES.includes(step.type))
      edges.push({ from: step.id, to: step.nextStepId, kind: "direct", label: "continúa" });
    stepPorts(step).forEach((port, slot) => {
      if (port.to && ids.has(port.to)) edges.push({ from: step.id, to: port.to, kind: port.kind, port: slot, label: port.label });
    });
  }
  return edges;
}

/** Pasos alcanzables desde el primero (el que se ejecuta al iniciar). */
export function reachableSteps(steps: ScenarioStep[]): Set<string> {
  const edges = flowEdges(steps);
  const seen = new Set<string>();
  const pending = steps[0] ? [steps[0].id] : [];
  while (pending.length) {
    const id = pending.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.filter(edge => edge.from === id).forEach(edge => pending.push(edge.to));
  }
  return seen;
}

export function buildFlowGraph(steps: ScenarioStep[]): FlowGraph {
  const edges = flowEdges(steps);
  const byId = new Map(steps.map(step => [step.id, step]));
  const reachable = reachableSteps(steps);
  const heights = new Map(steps.map(step => [step.id, nodeHeight(step)]));
  // Columna = camino más largo desde el inicio (sin ciclos): los pasos donde se
  // juntan varias ramas, como «Finalizar», quedan a la derecha.
  const outgoing = (id: string) => edges.filter(edge => edge.from === id);
  const backEdges = new Set<FlowEdge>();
  const state = new Map<string, "open" | "done">();
  const visit = (id: string) => {
    state.set(id, "open");
    for (const edge of outgoing(id)) {
      const target = state.get(edge.to);
      if (target === "open") backEdges.add(edge);
      else if (!target) visit(edge.to);
    }
    state.set(id, "done");
  };
  if (steps[0]) visit(steps[0].id);
  const levels = new Map<string, number>();
  if (steps[0]) levels.set(steps[0].id, 0);
  for (let pass = 0; pass < steps.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (backEdges.has(edge) || !levels.has(edge.from)) continue;
      const next = (levels.get(edge.from) as number) + 1;
      if (next > (levels.get(edge.to) ?? -1)) { levels.set(edge.to, next); changed = true; }
    }
    if (!changed) break;
  }
  const positions = new Map<string, { x: number; y: number }>();
  const maxLevel = Math.max(0, ...levels.values());
  let bottom = TOP + START_HEIGHT;
  for (let level = 0; level <= maxLevel; level += 1) {
    const ids = steps.filter(step => reachable.has(step.id) && levels.get(step.id) === level).map(step => step.id);
    // Cada tarjeta intenta alinearse con la salida que la alcanza primero.
    const desired = (id: string) => {
      const ys = edges.filter(edge => edge.to === id && !backEdges.has(edge) && positions.has(edge.from))
        .map(edge => (positions.get(edge.from) as { y: number }).y + outputY(byId.get(edge.from) as ScenarioStep, edge.port) - INPUT_Y);
      return ys.length ? Math.min(...ys) : TOP;
    };
    let cursor = -Infinity;
    ids.map(id => ({ id, y: desired(id) })).sort((a, b) => a.y - b.y).forEach(({ id, y }) => {
      const top = Math.max(y, cursor + GAP, TOP);
      positions.set(id, { x: FIRST_X + level * COLUMN, y: top });
      cursor = top + (heights.get(id) as number);
      bottom = Math.max(bottom, cursor);
    });
  }
  const unreachable = new Set(steps.filter(step => !reachable.has(step.id)).map(step => step.id));
  const orphanTop = bottom + 90;
  let orphanBottom = orphanTop;
  [...unreachable].forEach((id, index) => {
    positions.set(id, { x: FIRST_X + index * COLUMN, y: orphanTop + 44 });
    orphanBottom = Math.max(orphanBottom, orphanTop + 44 + (heights.get(id) as number));
  });
  const first = steps[0] && positions.get(steps[0].id);
  const start = { x: START_X, y: (first?.y ?? TOP) + INPUT_Y - START_HEIGHT / 2 };
  const right = Math.max(FIRST_X + NODE_WIDTH, ...[...positions.values()].map(p => p.x + NODE_WIDTH));
  return {
    edges, positions, heights, unreachable, startId: steps[0]?.id, start, orphanTop,
    width: right + 80,
    height: (unreachable.size ? orphanBottom : bottom) + 60,
  };
}

/**
 * Inserta un paso nuevo después de `afterId` y lo conecta:
 * - con `port`: a esa opción o respuesta;
 * - pasos lineales: el nuevo queda entre el paso y su siguiente;
 * - opciones/respuestas: a la primera sin destino.
 */
export function insertStepAfter(steps: ScenarioStep[], afterId: string | undefined, step: ScenarioStep, port?: number): ScenarioStep[] {
  const index = steps.findIndex(item => item.id === afterId);
  if (index < 0) return [...steps, step];
  const source = steps[index];
  let updatedSource = source;
  let inserted = step;
  if (hasNext(source)) {
    if (source.nextStepId && hasNext(step)) inserted = { ...step, nextStepId: source.nextStepId };
    updatedSource = { ...source, nextStepId: step.id };
  } else if (source.type === "send_options") {
    const options = source.options || [];
    const free = options.findIndex(option => option.title.trim() && !option.nextStepId);
    const target = port !== undefined && port >= 0 ? port : free >= 0 ? free : options.findIndex(option => !option.nextStepId);
    if (target >= 0) updatedSource = { ...source, options: options.map((option, position) => position === target ? { ...option, nextStepId: step.id } : option) };
  } else if (source.type === "wait_reply") {
    const branches = source.branches || [];
    const empty = port !== undefined && port >= 0 ? port : branches.findIndex(branch => !branch.nextStepId);
    updatedSource = empty >= 0
      ? { ...source, branches: branches.map((branch, position) => position === empty ? { ...branch, nextStepId: step.id } : branch) }
      : { ...source, branches: [...branches, { id: `branch_${step.id}`, name: "", aiDescription: "", examples: [], nextStepId: step.id }] };
  }
  const next = [...steps];
  next[index] = updatedSource;
  next.splice(index + 1, 0, inserted);
  return next;
}
