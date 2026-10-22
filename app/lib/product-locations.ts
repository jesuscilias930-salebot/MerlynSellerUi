export type ProductLocation = { productId: number; rack: string | null; level: string | null; side: string | null; updatedAt?: string };
export type LocationDraft = { rack: string; level: string; side: string };
export type LocationMap = Map<number, ProductLocation>;

export const DEFAULT_LEVELS = ["1", "2", "3", "4", "5"];
export const DEFAULT_SIDES = ["Izquierdo", "Derecho", "Frente", "Atrás"];

const clean = (value?: string | null) => (value || "").trim().replace(/\s+/g, " ");
export const hasLocation = (location?: ProductLocation | null) => Boolean(location && (location.rack || location.level || location.side));

/** «Rack A · Piso 2 · Lado izquierdo»; agrega la palabra solo si el valor no la trae. */
export function formatLocation(location?: Partial<ProductLocation> | LocationDraft | null) {
  if (!location) return "";
  const part = (label: string, value?: string | null) => {
    const text = clean(value);
    if (!text) return "";
    return new RegExp(`^${label}\\b`, "i").test(text) ? text : `${label} ${label === "Lado" ? text.toLowerCase() : text}`;
  };
  return [part("Rack", location.rack), part("Piso", location.level), part("Lado", location.side)].filter(Boolean).join(" · ");
}
export const draftOf = (location?: ProductLocation | null): LocationDraft => ({ rack: location?.rack || "", level: location?.level || "", side: location?.side || "" });
export const draftPayload = (productIds: number[], draft: LocationDraft) => ({ productIds, rack: clean(draft.rack) || null, level: clean(draft.level) || null, side: clean(draft.side) || null });
export const locationMap = (rows: ProductLocation[]): LocationMap => new Map(rows.map(row => [row.productId, row]));

const natural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
/** Valores ya usados (para sugerir) más los comunes. */
export function suggestions(rows: Iterable<{ rack?: string | null; level?: string | null; side?: string | null }>, key: "rack" | "level" | "side") {
  const used = [...rows].map(row => clean(row[key])).filter(Boolean);
  const defaults = key === "level" ? DEFAULT_LEVELS : key === "side" ? DEFAULT_SIDES : [];
  const unique = new Map<string, string>();
  for (const value of [...used, ...defaults]) if (!unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value);
  return [...unique.values()].sort(natural);
}
/** Racks con sus pisos, ordenados, para el filtro «¿Qué hay en…?». */
export function rackIndex(rows: Iterable<{ rack?: string | null; level?: string | null }>) {
  const index = new Map<string, Set<string>>();
  for (const row of rows) {
    const rack = clean(row.rack);
    if (!rack) continue;
    if (!index.has(rack)) index.set(rack, new Set());
    const level = clean(row.level);
    if (level) index.get(rack)?.add(level);
  }
  return [...index].sort((a, b) => natural(a[0], b[0])).map(([rack, levels]) => ({ rack, levels: [...levels].sort(natural) }));
}
export const sameText = (a?: string | null, b?: string | null) => clean(a).toLowerCase() === clean(b).toLowerCase();

// Ubicación por talla y/o color dentro de un mismo producto (un solo stock en Control).
export type LocationSlot = { productId: number; size: string | null; color: string | null; quantity: number | null; rack: string | null; level: string | null; side: string | null };
export type SlotDraft = { key: string; size: string; color: string; quantity: string; rack: string; level: string; side: string };
export type SlotMap = Map<number, LocationSlot[]>;

let slotCounter = 0;
const slotKey = () => `slot-${(slotCounter += 1)}`;
export function slotMap(rows: LocationSlot[]): SlotMap {
  const map: SlotMap = new Map();
  for (const row of rows) {
    if (!row || !(row.productId > 0)) continue;
    map.set(row.productId, [...(map.get(row.productId) || []), row]);
  }
  return map;
}
/** «Talla 25-28 · Negro». */
export const slotLabel = (slot: { size?: string | null; color?: string | null }) =>
  [clean(slot.size) ? `Talla ${clean(slot.size)}` : "", clean(slot.color)].filter(Boolean).join(" · ") || "Sin talla ni color";
export const slotDrafts = (slots: LocationSlot[]): SlotDraft[] => slots.map(slot => ({
  key: slotKey(), size: slot.size || "", color: slot.color || "", quantity: slot.quantity == null ? "" : String(slot.quantity),
  rack: slot.rack || "", level: slot.level || "", side: slot.side || "",
}));
/** Fila nueva: repite rack, piso y lado de la anterior (suele ser el mismo rack). */
export const emptySlotDraft = (previous?: SlotDraft): SlotDraft => ({ key: slotKey(), size: "", color: "", quantity: "", rack: previous?.rack || "", level: previous?.level || "", side: previous?.side || "" });
const blank = (draft: SlotDraft) => ![draft.size, draft.color, draft.quantity, draft.rack, draft.level, draft.side].some(value => clean(value));
export function slotIssues(drafts: SlotDraft[]): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  drafts.forEach((draft, index) => {
    if (blank(draft)) return;
    const row = `Fila ${index + 1}`;
    if (!clean(draft.size) && !clean(draft.color)) issues.push(`${row}: indica la talla o el color.`);
    if (!clean(draft.rack) && !clean(draft.level) && !clean(draft.side)) issues.push(`${row}: indica rack, piso o lado.`);
    if (clean(draft.quantity) && !(Number.isInteger(Number(draft.quantity)) && Number(draft.quantity) >= 0)) issues.push(`${row}: las piezas deben ser un número entero.`);
    const key = `${clean(draft.size).toLowerCase()}|${clean(draft.color).toLowerCase()}`;
    if (seen.has(key)) issues.push(`${row}: repite la talla y color de la fila ${(seen.get(key) || 0) + 1}.`);
    else seen.set(key, index);
  });
  return issues;
}
export const slotPayload = (drafts: SlotDraft[]) => ({
  slots: drafts.filter(draft => !blank(draft)).map(draft => ({
    size: clean(draft.size) || null, color: clean(draft.color) || null,
    quantity: clean(draft.quantity) ? Number(draft.quantity) : null,
    rack: clean(draft.rack) || null, level: clean(draft.level) || null, side: clean(draft.side) || null,
  })),
});
export const slotPieces = (slots: { quantity?: number | string | null }[]) =>
  slots.reduce((sum, slot) => sum + (Number.isFinite(Number(slot.quantity)) ? Number(slot.quantity || 0) : 0), 0);
