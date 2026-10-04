export type CatalogProductIdentity = { name: string; gender?: string | null; category?: { id?: number | null; name?: string | null } | null };

export function catalogProductName(product: CatalogProductIdentity): string {
  return [product.name.trim(), product.category?.name?.trim() || "Sin categoría", product.gender?.trim() || "Sin género"].join(" · ");
}

export function groupCatalogProducts<T extends CatalogProductIdentity>(products: T[]) {
  const groups = new Map<string, { key: string; name: string; products: T[] }>();
  for (const product of products) {
    const name = product.category?.name?.trim() || "Sin categoría";
    const key = product.category?.id != null ? `id:${product.category.id}` : product.category?.name?.trim() ? `name:${name}` : "uncategorized";
    const group = groups.get(key) || { key, name, products: [] };
    group.products.push(product);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key === "uncategorized" ? 1 : b.key === "uncategorized" ? -1 : a.name.localeCompare(b.name, "es"));
}
