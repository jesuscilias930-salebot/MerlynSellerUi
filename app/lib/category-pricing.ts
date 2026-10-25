/** Escalas de precio por categoría: todas las tallas y colores de la categoría comparten las mismas escalas. */
export type PricedProduct = { id: number; name: string; size?: string | null; category?: { id?: number | null; name?: string | null } | null };
export type ScaleRule = { minQuantity: number; maxQuantity: number; pricePerUnit: number | string; ruleName?: string };

export function categoriesOf(products: PricedProduct[]) {
  const map = new Map<number, { id: number; name: string; products: PricedProduct[] }>();
  for (const product of products) {
    const id = product.category?.id;
    if (id == null || !Number.isInteger(id)) continue;
    const entry = map.get(id) || { id, name: product.category?.name?.trim() || `Categoría ${id}`, products: [] };
    entry.products.push(product); map.set(id, entry);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const signature = (rules: ScaleRule[] | undefined) => [...(rules || [])]
  .sort((a, b) => a.minQuantity - b.minQuantity)
  .map(rule => `${rule.minQuantity}-${rule.maxQuantity}:${Number(rule.pricePerUnit).toFixed(2)}`).join("|");

/**
 * Cuántos productos de la categoría ya comparten la escala más común,
 * cuántos tienen otra distinta y cuántos no tienen ninguna.
 */
export function categoryStatus(productIds: number[], groups: Record<string, ScaleRule[] | undefined>) {
  const counts = new Map<string, { rules: ScaleRule[]; count: number }>();
  let without = 0;
  for (const id of productIds) {
    const rules = groups[String(id)];
    if (!rules?.length) { without += 1; continue; }
    const key = signature(rules);
    const entry = counts.get(key) || { rules: [...rules].sort((a, b) => a.minQuantity - b.minQuantity), count: 0 };
    entry.count += 1; counts.set(key, entry);
  }
  const common = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return {
    total: productIds.length, without, matching: common?.count || 0,
    different: productIds.length - without - (common?.count || 0),
    reference: common?.rules || [],
    uniform: productIds.length > 0 && without === 0 && counts.size === 1,
  };
}

export const sizesLabel = (products: PricedProduct[]) => [...new Set(products.map(product => product.size?.trim()).filter(Boolean))].join(", ");
