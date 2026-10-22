// Agrupación por talla: orden alfabético descendente (los números en orden natural:
// 25-28 antes que 22-25 y que 2-4). Los productos sin talla van al final.
const clean = (value: string | null | undefined) => (value || "").trim().replace(/\s+/g, " ");
export const compareSizesDesc = (a: string, b: string) => clean(b).localeCompare(clean(a), "es", { numeric: true, sensitivity: "base" });
export const sizeLabel = (size: string | null | undefined) => clean(size) ? `Talla ${clean(size)}` : "Sin talla";

export type SizeGroup<T> = { key: string; size: string; label: string; items: T[] };
export function groupBySize<T extends { name?: string | null; size?: string | null }>(items: T[]): SizeGroup<T>[] {
  const groups = new Map<string, SizeGroup<T>>();
  for (const item of items) {
    const size = clean(item.size);
    const key = size.toLocaleLowerCase("es");
    const group = groups.get(key) ?? { key: key || "__none__", size, label: sizeLabel(size), items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const byName = (a: T, b: T) => (a.name || "").localeCompare(b.name || "", "es", { numeric: true, sensitivity: "base" });
  return [...groups.values()]
    .map(group => ({ ...group, items: [...group.items].sort(byName) }))
    .sort((a, b) => (!a.size ? 1 : !b.size ? -1 : compareSizesDesc(a.size, b.size)));
}
