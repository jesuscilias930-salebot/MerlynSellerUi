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
export function suggestions(rows: Iterable<ProductLocation>, key: "rack" | "level" | "side") {
  const used = [...rows].map(row => clean(row[key])).filter(Boolean);
  const defaults = key === "level" ? DEFAULT_LEVELS : key === "side" ? DEFAULT_SIDES : [];
  const unique = new Map<string, string>();
  for (const value of [...used, ...defaults]) if (!unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value);
  return [...unique.values()].sort(natural);
}
/** Racks con sus pisos, ordenados, para el filtro «¿Qué hay en…?». */
export function rackIndex(rows: Iterable<ProductLocation>) {
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
