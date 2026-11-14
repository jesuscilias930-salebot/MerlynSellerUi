// Vista de Inventario: filas listas para mostrar, búsqueda instantánea en el navegador,
// filtros por estado y categoría, y la tabla producto × talla.
// Sin dependencias de otros módulos para que las pruebas de Node lo importen directo.

export type StockLevel = "ready" | "low" | "empty";
export type InventoryRow = {
  kind: "product" | "bundle";
  id: number;
  name: string;
  /** Modelo del CRM; agrupa colores y tallas del mismo producto. */
  model: string;
  color: string;
  size: string;
  gender: string;
  category: string;
  categoryKey: string;
  stock: number;
  min: number;
  level: StockLevel;
  location: string;
  /** Texto normalizado donde se busca. */
  haystack: string;
};
type ProductLike = {
  id: number; name: string; currentStock: number | null; minStockAlert?: number | null;
  category?: { id?: number | null; name?: string | null } | null; gender?: string | null; size?: string | null;
  color?: string | null; model?: string | null;
};
type BundleLike = { id: number; name: string; storeCategory?: string | null };

export const BUNDLES_KEY = "bundles";
export const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const GENDERS: Record<string, string> = { male: "Hombre", hombre: "Hombre", female: "Mujer", mujer: "Mujer", unisex: "Unisex", kids: "Niño", nino: "Niño", child: "Niño", children: "Niño" };
export const genderLabel = (value?: string | null) => GENDERS[normalize(value || "")] || value?.trim() || "";
export const stockLevel = (stock: number, min = 0): StockLevel => stock <= 0 ? "empty" : stock <= Math.max(0, min) ? "low" : "ready";
const whole = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));

export function productRow(product: ProductLike, location = ""): InventoryRow {
  const stock = whole(product.currentStock), min = whole(product.minStockAlert);
  const category = product.category?.name?.trim() || "Sin categoría";
  const color = product.color?.trim() || "", size = product.size?.trim() || "", gender = genderLabel(product.gender), model = product.model?.trim() || "";
  return {
    kind: "product", id: product.id, name: product.name?.trim() || `Producto #${product.id}`, model, color, size, gender, category,
    categoryKey: product.category?.id != null ? String(product.category.id) : `name:${normalize(category)}`,
    stock, min, level: stockLevel(stock, min), location,
    haystack: ` ${normalize([product.name, model, color, size, gender, category, location, `#${product.id}`].join(" "))} `,
  };
}
export function bundleRow(bundle: BundleLike, available: number): InventoryRow {
  const stock = whole(available);
  const category = bundle.storeCategory?.trim() || "Paquetes";
  return { kind: "bundle", id: bundle.id, name: bundle.name?.trim() || `Paquete #${bundle.id}`, model: "", color: "", size: "", gender: "", category, categoryKey: BUNDLES_KEY, stock, min: 0, level: stockLevel(stock), location: "", haystack: ` ${normalize(`${bundle.name} ${category} paquete bundle caja`)} ` };
}

const SIZE_PATTERN = /\b\d{1,2}\s*-\s*\d{1,2}\b/g;
const sizeKey = (value: string) => value.replace(/\s+/g, "").toLowerCase();
/** «essential negro 25-28»: las tallas deben coincidir exactas; cada palabra, al inicio de una palabra del producto. */
export function parseQuery(text: string) {
  const sizes = (text.match(SIZE_PATTERN) || []).map(sizeKey);
  const words = normalize(text.replace(SIZE_PATTERN, " ")).split(" ").filter(Boolean);
  return { sizes, words };
}
export function matchesQuery(row: InventoryRow, query: ReturnType<typeof parseQuery>) {
  if (query.sizes.length && !query.sizes.includes(sizeKey(row.size))) return false;
  return query.words.every(word => row.haystack.includes(` ${word}`));
}

export type LevelFilter = "all" | StockLevel;
export type ViewFilters = { query: string; level: LevelFilter; category: string };
const byQuery = (rows: InventoryRow[], query: string) => {
  const parsed = parseQuery(query);
  return parsed.sizes.length || parsed.words.length ? rows.filter(row => matchesQuery(row, parsed)) : rows;
};
export const levelOf = (rows: InventoryRow[], level: LevelFilter) => level === "all" ? rows : rows.filter(row => row.level === level);
export const categoryOf = (rows: InventoryRow[], category: string) => category ? rows.filter(row => row.categoryKey === category) : rows;

/** Resultados y contadores; cada grupo de chips cuenta con los otros filtros aplicados. */
export function applyFilters(rows: InventoryRow[], filters: ViewFilters) {
  const searched = byQuery(rows, filters.query);
  const inCategory = categoryOf(searched, filters.category);
  const results = sortRows(levelOf(inCategory, filters.level));
  const levels = { all: inCategory.length, ready: 0, low: 0, empty: 0 } as Record<LevelFilter, number>;
  inCategory.forEach(row => { levels[row.level] += 1; });
  const withLevel = levelOf(searched, filters.level);
  const counts = new Map<string, { key: string; name: string; count: number }>();
  rows.forEach(row => { if (!counts.has(row.categoryKey)) counts.set(row.categoryKey, { key: row.categoryKey, name: row.kind === "bundle" ? "Paquetes" : row.category, count: 0 }); });
  withLevel.forEach(row => { counts.get(row.categoryKey)!.count += 1; });
  const categories = [...counts.values()].sort((a, b) => Number(a.key === BUNDLES_KEY) - Number(b.key === BUNDLES_KEY) || a.name.localeCompare(b.name, "es"));
  return { results, levels, categories, total: withLevel.length };
}

const firstNumber = (size: string) => { const match = size.match(/\d+/); return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER; };
export const compareSizes = (a: string, b: string) => firstNumber(a) - firstNumber(b) || a.localeCompare(b, "es", { numeric: true });
/** Productos primero por categoría y nombre; dentro, color y talla. Paquetes al final. */
export function sortRows(rows: InventoryRow[]) {
  return [...rows].sort((a, b) => Number(a.kind === "bundle") - Number(b.kind === "bundle") || a.category.localeCompare(b.category, "es") || (a.model || a.name).localeCompare(b.model || b.name, "es") || a.color.localeCompare(b.color, "es") || compareSizes(a.size, b.size) || a.id - b.id);
}

export type MatrixLine = { key: string; title: string; detail: string; color: string; cells: Map<string, InventoryRow>; total: number };
export type MatrixGroup = { key: string; name: string; sizes: string[]; lines: MatrixLine[] };
/** Por categoría: filas = producto · color · género; columnas = tallas. */
export function sizeMatrix(rows: InventoryRow[]): MatrixGroup[] {
  const groups = new Map<string, { name: string; sizes: Set<string>; lines: Map<string, MatrixLine> }>();
  for (const row of sortRows(rows)) {
    if (row.kind !== "product") continue;
    const group = groups.get(row.categoryKey) || { name: row.category, sizes: new Set<string>(), lines: new Map() };
    groups.set(row.categoryKey, group);
    group.sizes.add(row.size);
    const title = row.model || row.name;
    const key = normalize(`${title}|${row.color}|${row.gender}`);
    const line = group.lines.get(key) || { key, title, color: row.color, detail: [row.color, row.gender].filter(Boolean).join(" · "), cells: new Map(), total: 0 };
    group.lines.set(key, line);
    // Dos productos con la misma talla en la misma fila: se muestra la fila aparte con su nombre.
    if (line.cells.has(row.size)) {
      const alone = `${key}#${row.id}`;
      group.lines.set(alone, { key: alone, title: row.name, color: row.color, detail: [row.color, row.gender].filter(Boolean).join(" · "), cells: new Map([[row.size, row]]), total: row.stock });
      continue;
    }
    line.cells.set(row.size, row); line.total += row.stock;
  }
  return [...groups].map(([key, group]) => ({ key, name: group.name, sizes: [...group.sizes].sort(compareSizes), lines: [...group.lines.values()] }));
}

export const unitLabel = (row: Pick<InventoryRow, "kind">, count: number) => row.kind === "bundle" ? (count === 1 ? "caja" : "cajas") : (count === 1 ? "par" : "pares");
export const levelLabel = (level: StockLevel) => level === "empty" ? "Agotado" : level === "low" ? "Pocas" : "Disponible";

export type StockChange = { id: number; name: string; from: number; to: number };
/** Cantidad escrita en la edición de existencias: entero de 0 a mil millones; si no, undefined. */
export function parseStock(text: string): number | undefined {
  const clean = text.trim().replace(/,/g, "");
  if (!/^\d+$/.test(clean)) return undefined;
  const value = Number(clean);
  return Number.isSafeInteger(value) && value <= 1_000_000_000 ? value : undefined;
}
/** Cambios a guardar (solo los que difieren de la existencia actual) y productos con una cantidad inválida. */
export function stockChanges(drafts: Map<number, string>, rows: InventoryRow[]) {
  const byId = new Map(rows.filter(row => row.kind === "product").map(row => [row.id, row]));
  const changes: StockChange[] = [], invalid: number[] = [];
  drafts.forEach((text, id) => {
    const row = byId.get(id);
    if (!row) return;
    const value = parseStock(text);
    if (value === undefined) invalid.push(id);
    else if (value !== row.stock) changes.push({ id, name: [row.name, row.color, row.size && `Talla ${row.size}`].filter(Boolean).join(" · "), from: row.stock, to: value });
  });
  return { changes, invalid };
}
