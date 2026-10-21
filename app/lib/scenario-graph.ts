import type { ScenarioStep } from "./types";

export const NODE_WIDTH = 228;
export const NODE_HEIGHT = 104;
const COLUMN = 352;
const ROW = 150;
export const START_WIDTH = 176;
const FIRST_X = 24 + START_WIDTH + 52;
const TOP = 36;

export type FlowEdge = { from: string; to: string; kind: "direct" | "fallback" | "branch"; labels: string[]; order: number };
export type FlowGraph = {
  edges: FlowEdge[];
  positions: Map<string, { x: number; y: number }>;
  unreachable: Set<string>;
  startId?: string;
  orphanTop: number;
  width: number;
  height: number;
};

/** Pasos que esperan al cliente y se conectan por opción o respuesta. */
export const BRANCHING_TYPES: ScenarioStep["type"][] = ["wait_reply", "send_options"];
export const hasNext = (step: ScenarioStep) => !BRANCHING_TYPES.includes(step.type) && step.type !== "end";

const rawEdges = (step: ScenarioStep) => [
  ...(step.nextStepId ? [{ to: step.nextStepId, kind: "direct" as const, label: "continúa" }] : []),
  ...(step.fallbackStepId ? [{ to: step.fallbackStepId, kind: "fallback" as const, label: "si no entiende" }] : []),
  ...(step.branches || []).filter(branch => branch.nextStepId).map(branch => ({ to: branch.nextStepId, kind: "branch" as const, label: branch.name.trim() || "respuesta" })),
  ...(step.options || []).filter(option => option.nextStepId).map(option => ({ to: option.nextStepId as string, kind: "branch" as const, label: option.title.trim() || "opción" })),
];

/** Conexiones agrupadas: varias opciones hacia el mismo paso son una sola línea. */
export function flowEdges(steps: ScenarioStep[]): FlowEdge[] {
  const ids = new Set(steps.map(step => step.id));
  const merged = new Map<string, FlowEdge>();
  for (const step of steps) {
    let order = 0;
    for (const edge of rawEdges(step)) {
      if (!ids.has(edge.to)) continue;
      const key = `${step.id}>${edge.to}>${edge.kind}`;
      const existing = merged.get(key);
      if (existing) existing.labels.push(edge.label);
      else merged.set(key, { from: step.id, to: edge.to, kind: edge.kind, labels: [edge.label], order: order++ });
    }
  }
  return [...merged.values()];
}

export const edgeLabel = (edge: FlowEdge) => edge.labels.length === 1 ? edge.labels[0] : `${edge.labels.length} opciones`;

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
  const reachable = reachableSteps(steps);
  // Columna = camino más largo desde el inicio (sin contar ciclos), así los
  // pasos donde se juntan varias ramas, como «Finalizar», quedan a la derecha.
  const outgoing = (id: string) => edges.filter(edge => edge.from === id).sort((a, b) => a.order - b.order);
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
  const columns = new Map<number, string[]>();
  steps.filter(step => reachable.has(step.id)).forEach(step => {
    const level = levels.get(step.id) || 0;
    columns.set(level, [...(columns.get(level) || []), step.id]);
  });
  // Ordena cada columna según el orden de sus pasos de origen para evitar cruces.
  const rowOf = new Map<string, number>();
  [...columns.keys()].sort((a, b) => a - b).forEach(level => {
    const ids = columns.get(level) as string[];
    const parentRow = (id: string) => {
      const parents = edges.filter(edge => edge.to === id && (levels.get(edge.from) ?? -1) < level);
      return parents.length ? Math.min(...parents.map(edge => (rowOf.get(edge.from) ?? 0) * 10 + edge.order)) : 0;
    };
    [...ids].sort((a, b) => parentRow(a) - parentRow(b)).forEach((id, index) => rowOf.set(id, index));
  });
  const positions = new Map<string, { x: number; y: number }>();
  let tallest = 1;
  columns.forEach((ids, level) => {
    tallest = Math.max(tallest, ids.length);
    ids.forEach(id => positions.set(id, { x: FIRST_X + level * COLUMN, y: TOP + (rowOf.get(id) || 0) * ROW }));
  });
  const unreachable = new Set(steps.filter(step => !reachable.has(step.id)).map(step => step.id));
  const orphanTop = TOP + tallest * ROW + 40;
  [...unreachable].forEach((id, index) => positions.set(id, { x: FIRST_X + index * COLUMN, y: orphanTop + 30 }));
  const maxLevel = Math.max(0, ...levels.values(), unreachable.size - 1);
  return {
    edges, positions, unreachable, startId: steps[0]?.id, orphanTop,
    width: Math.max(760, FIRST_X + (maxLevel + 1) * COLUMN),
    height: (unreachable.size ? orphanTop + 30 + ROW : TOP + tallest * ROW) + 20,
  };
}

/**
 * Inserta un paso nuevo después de `afterId` y lo conecta:
 * - pasos lineales: el nuevo queda entre el paso y su siguiente;
 * - opciones/respuestas: se conecta a la primera opción o respuesta sin destino.
 */
export function insertStepAfter(steps: ScenarioStep[], afterId: string | undefined, step: ScenarioStep): ScenarioStep[] {
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
    const target = options.findIndex(option => option.title.trim() && !option.nextStepId);
    const fallback = target >= 0 ? target : options.findIndex(option => !option.nextStepId);
    if (fallback >= 0) updatedSource = { ...source, options: options.map((option, position) => position === fallback ? { ...option, nextStepId: step.id } : option) };
  } else if (source.type === "wait_reply") {
    const branches = source.branches || [];
    const empty = branches.findIndex(branch => !branch.nextStepId);
    updatedSource = empty >= 0
      ? { ...source, branches: branches.map((branch, position) => position === empty ? { ...branch, nextStepId: step.id } : branch) }
      : { ...source, branches: [...branches, { id: `branch_${step.id}`, name: "", aiDescription: "", examples: [], nextStepId: step.id }] };
  }
  const next = [...steps];
  next[index] = updatedSource;
  next.splice(index + 1, 0, inserted);
  return next;
}
