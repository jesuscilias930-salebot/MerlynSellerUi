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

const fold = (value?: string | null) => (value || "").trim().replace(/\s+/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
export type SizeSiblings<T> = { key: string; primary: T; products: T[]; sizes: string[] };
/**
 * Productos que solo cambian de talla (mismo nombre, categoría, género y color) en una
 * sola tarjeta: comparten fotos y composición. La principal es la que ya tiene más fotos.
 */
export function groupSizeSiblings<T extends CatalogProductIdentity & { id: number; size?: string | null }>(products: T[], colors: Record<number, string>, photoCount: (id: number) => number = () => 0): SizeSiblings<T>[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const key = [fold(product.name), product.category?.id ?? fold(product.category?.name), fold(product.gender), fold(colors[product.id])].join("|");
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  return [...groups].map(([key, items]) => {
    const primary = [...items].sort((a, b) => photoCount(b.id) - photoCount(a.id) || a.id - b.id)[0];
    const sizes = [...new Set(items.map(item => (item.size || "").trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a, "es", { numeric: true, sensitivity: "base" }));
    return { key, primary, products: items, sizes };
  });
}
