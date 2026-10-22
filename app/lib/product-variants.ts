// Modelos con variantes: cada combinación de color y talla es un producto de Control
// (con su propio stock) y el CRM guarda el modelo que las agrupa.
export type ProductDetail = { productId: number; color?: string | null; model?: string | null };
export type VariantProduct = {
  id: number; name: string; currentStock?: number; minStockAlert?: number;
  category?: { id?: number; name?: string } | null; gender?: string | null; size?: string | null;
};
export type ModelGroup<P extends VariantProduct = VariantProduct> = {
  key: string; model: string; categoryId: string; categoryName: string; gender: string;
  colors: string[]; sizes: string[]; products: P[]; cells: Record<string, P>;
  stock: number; low: number;
};
export type VariantCombo = { color: string; size: string; name: string; key: string };

export const MAX_VARIANTS = 300;
const clean = (value: string | null | undefined) => (value || "").trim().replace(/\s+/g, " ");
export const normalizeModel = (value: string) => clean(value).slice(0, 80);
const lower = (value: string | null | undefined) => clean(value).toLocaleLowerCase("es");
/** Clave de celda de la matriz (color × talla), sin distinguir mayúsculas. */
export const cellKey = (color?: string | null, size?: string | null) => `${lower(color)}|${lower(size)}`;

export function detailMaps(rows: ProductDetail[] | null | undefined) {
  const colors: Record<number, string> = {}, models: Record<number, string> = {};
  for (const row of rows || []) {
    if (!row || !(row.productId > 0)) continue;
    if (row.color) colors[row.productId] = row.color;
    if (row.model) models[row.productId] = row.model;
  }
  return { colors, models };
}

/** Quita vacíos y repetidos (sin importar mayúsculas), conservando el primero. */
export function uniqueValues(values: (string | null | undefined)[]) {
  const seen = new Set<string>(); const result: string[] = [];
  for (const value of values) {
    const text = clean(value); const key = lower(text);
    if (text && !seen.has(key)) { seen.add(key); result.push(text); }
  }
  return result;
}

/** Tallas en orden natural: 2-4, 5-7, 22-25, 25-28… y al final las que no tienen número. */
export function sortSizes(sizes: string[]) {
  const first = (size: string) => { const match = size.match(/\d+(?:\.\d+)?/); return match ? Number(match[0]) : Infinity; };
  return [...sizes].sort((a, b) => first(a) - first(b) || a.localeCompare(b, "es", { numeric: true }));
}

export const variantName = (model: string, color?: string | null) => (clean(color) ? `${normalizeModel(model)} · ${clean(color)}` : normalizeModel(model));

/** Todas las combinaciones color × talla. Sin colores o sin tallas, esa dimensión queda vacía. */
export function buildVariants(model: string, colors: string[], sizes: string[]): VariantCombo[] {
  const colorList = uniqueValues(colors), sizeList = uniqueValues(sizes);
  const result: VariantCombo[] = [];
  for (const color of colorList.length ? colorList : [""])
    for (const size of sizeList.length ? sizeList : [""])
      result.push({ color, size, name: variantName(model, color), key: cellKey(color, size) });
  return result;
}

const groupKey = (model: string, categoryId: string, gender: string) => `${lower(model)}|${categoryId}|${lower(gender)}`;
/** Agrupa por modelo (y categoría y género). Los productos sin modelo quedan en `loose`. */
export function groupModels<P extends VariantProduct>(products: P[], models: Record<number, string>, colors: Record<number, string>) {
  const groups = new Map<string, ModelGroup<P>>(); const loose: P[] = [];
  for (const product of products) {
    const model = clean(models[product.id]);
    if (!model) { loose.push(product); continue; }
    const categoryId = product.category?.id == null ? "" : String(product.category.id);
    const gender = clean(product.gender);
    const key = groupKey(model, categoryId, gender);
    const group = groups.get(key) ?? { key, model, categoryId, categoryName: product.category?.name || "Sin categoría", gender, colors: [], sizes: [], products: [], cells: {}, stock: 0, low: 0 };
    group.products.push(product);
    const cell = cellKey(colors[product.id], product.size);
    if (!group.cells[cell]) group.cells[cell] = product;
    const stock = Number(product.currentStock || 0);
    group.stock += stock;
    if (stock <= Number(product.minStockAlert ?? 0)) group.low += 1;
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.colors = uniqueValues(group.products.map(product => colors[product.id] || ""));
    if (group.products.some(product => !clean(colors[product.id]))) group.colors.push("");
    group.sizes = sortSizes(uniqueValues(group.products.map(product => product.size)));
    if (group.products.some(product => !clean(product.size))) group.sizes.push("");
  }
  return { groups: [...groups.values()].sort((a, b) => a.model.localeCompare(b.model, "es") || a.gender.localeCompare(b.gender, "es")), loose };
}

/** Combinaciones que ya existen para ese modelo, categoría y género. */
export function existingCells(products: VariantProduct[], models: Record<number, string>, colors: Record<number, string>, model: string, categoryId: string, gender: string) {
  const key = groupKey(model, categoryId, gender);
  const cells = new Set<string>();
  for (const product of products) {
    const productModel = clean(models[product.id]);
    if (!productModel) continue;
    if (groupKey(productModel, product.category?.id == null ? "" : String(product.category.id), clean(product.gender)) === key) cells.add(cellKey(colors[product.id], product.size));
  }
  return cells;
}
