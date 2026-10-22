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
