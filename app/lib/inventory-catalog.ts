export type InventoryProduct = { id: number; name: string; categoryId: number | null; categoryName: string | null; gender: string | null; size: string | null; currentStock: number; minStockAlert: number | null };
export type InventoryCategory = { categoryId: number | null; name: string | null; productCount: number };
export type InventoryPage = { content: InventoryProduct[]; page: number; size: number; totalElements: number; totalPages: number };

export const inventoryCategoryKey = (category: InventoryCategory) => category.categoryId == null ? "uncategorized" : String(category.categoryId);
export const inventoryCategoryName = (category: { name: string | null }) => category.name?.trim() || "Sin categoría";
export const inventoryProductName = (product: InventoryProduct) => [product.name?.trim() || "Producto", product.categoryName?.trim() || "Sin categoría", product.gender?.trim() || "Sin género", product.size?.trim()].filter(Boolean).join(" · ");
export const inventorySearchText = (text: string) => text.trim().length >= 2 ? text.trim() : "";
export const inventoryStockState = (product: InventoryProduct) => product.currentStock === 0 ? "empty" : product.currentStock <= (product.minStockAlert ?? 0) ? "low" : "ready";

export function inventoryFilterParams(q: string, productId?: number) {
  const params = new URLSearchParams();
  if (productId != null) params.set("productId", String(productId));
  else if (q) params.set("q", q);
  return params;
}
export function inventoryPagePath(category: InventoryCategory, q: string, productId: number | undefined, page: number, size = 20) {
  const params = inventoryFilterParams(q, productId);
  if (category.categoryId == null) params.set("uncategorized", "true");
  else params.set("categoryId", String(category.categoryId));
  params.set("page", String(page)); params.set("size", String(size));
  return `/products/inventory?${params}`;
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/**
 * Control no conoce el color (vive en el CRM): separa del texto los colores conocidos
 * para buscar el resto en Control y filtrar por color aquí. «essential negro» → «essential» + [negro].
 */
export function splitColorQuery(text: string, colors: Iterable<string>) {
  let rest = ` ${fold(text)} `;
  const found: string[] = [];
  const known = [...new Set([...colors].map(fold).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const color of known) {
    const word = ` ${color} `;
    if (rest.includes(word)) { found.push(color); rest = rest.replace(word, " "); }
  }
  return found.length ? { text: rest.replace(/\s+/g, " ").trim(), colors: found } : { text: text.trim(), colors: [] };
}
export const matchesColor = (color: string | undefined, colors: string[]) => !colors.length || Boolean(color && colors.includes(fold(color)));
