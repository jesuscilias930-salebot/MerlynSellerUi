// Búsqueda rápida de existencias para el inbox. Los productos traen su stock de
// Control; la disponibilidad de los bundles se calcula aquí con la misma regla
// que la tienda (BundleAssortment en SockControl): primero las piezas fijas y
// después los surtidos de caricatura repartidos entre sus variantes.
export type QuickProduct = {
  id: number; name: string; currentStock: number | null; minStockAlert?: number | null;
  category?: { id?: number | null; name?: string | null } | null; gender?: string | null; size?: string | null;
};
export type QuickBundleItem = { productId: number; quantity: number; assorted?: boolean; categoryId?: number | null };
export type QuickBundle = { id: number; name: string; fixedPrice?: number | string | null; storeCategory?: string | null; items: QuickBundleItem[] };
export type StockState = "ready" | "low" | "empty";
export type QuickResult = {
  kind: "product" | "bundle"; id: number; title: string; detail: string; available: number; state: StockState; price?: number;
  /** Ubicación en bodega (solo productos), p. ej. «Rack A · Piso 2 · Lado izquierdo». */
  location?: string;
};
type LocationLike = { rack: string | null; level: string | null; side: string | null };
// Igual que formatLocation (product-locations); se repite para que este módulo no
// dependa de otros y sus pruebas de Node lo importen directamente.
const formatLocation = (location?: LocationLike) => {
  if (!location) return "";
  const part = (label: string, value: string | null) => {
    const text = (value || "").trim().replace(/\s+/g, " ");
    if (!text) return "";
    return new RegExp(`^${label}\\b`, "i").test(text) ? text : `${label} ${label === "Lado" ? text.toLowerCase() : text}`;
  };
  return [part("Rack", location.rack), part("Piso", location.level), part("Lado", location.side)].filter(Boolean).join(" · ");
};

export const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const genderLabel = (value?: string | null) => {
  const key = normalizeText(value || "");
  return ({ male: "Hombre", hombre: "Hombre", female: "Mujer", mujer: "Mujer", unisex: "Unisex", kids: "Niño", nino: "Niño", child: "Niño", children: "Niño" } as Record<string, string>)[key] || (value?.trim() || "");
};
export const productDetail = (product: QuickProduct) =>
  [product.category?.name?.trim(), genderLabel(product.gender), product.size?.trim() && `Talla ${product.size.trim()}`].filter(Boolean).join(" · ");
export const stockState = (available: number, minimum = 0): StockState => available <= 0 ? "empty" : available <= Math.max(0, minimum) ? "low" : "ready";

const stockOf = (product?: QuickProduct) => Math.max(0, Math.floor(Number(product?.currentStock) || 0));

/** Reparte piezas fijas y surtidos; lanza error si no alcanza (como `allocate` en Java). */
function allocate(fixed: Map<number, number>, demand: Map<number, number>, pools: Map<number, number[]>, stock: Map<number, number>) {
  const remaining = new Map(stock);
  for (const [id, count] of [...fixed].sort((a, b) => a[0] - b[0])) {
    if (count < 1 || (remaining.get(id) || 0) < count) throw new Error("stock");
    remaining.set(id, (remaining.get(id) || 0) - count);
  }
  for (const [anchor, slot] of [...demand].sort((a, b) => a[0] - b[0])) {
    const ids = [...new Set(pools.get(anchor) || [])].sort((a, b) => a - b);
    let count = slot;
    if (count < 1 || ids.reduce((sum, id) => sum + Math.max(0, remaining.get(id) || 0), 0) < count) throw new Error("surtido");
    while (count > 0) {
      const active = ids.filter(id => (remaining.get(id) || 0) > 0);
      const rounds = Math.min(Math.floor(count / active.length), ...active.map(id => remaining.get(id) as number));
      for (const id of active) {
        if (count === 0) break;
        const n = rounds > 0 ? rounds : 1;
        remaining.set(id, (remaining.get(id) as number) - n);
        count -= n;
      }
    }
  }
}

/** Cajas completas que se pueden armar hoy con el stock actual. */
export function bundleAvailability(bundle: QuickBundle, products: QuickProduct[]): number {
  if (!bundle.items?.length) return 0;
  const byId = new Map(products.map(product => [product.id, product]));
  const fixed = new Map<number, number>(), demand = new Map<number, number>(), pools = new Map<number, number[]>(), stock = new Map<number, number>();
  for (const item of bundle.items) {
    const quantity = Math.floor(Number(item.quantity) || 0);
    const anchor = byId.get(item.productId);
    if (quantity < 1 || !anchor) return 0;
    if (item.assorted) {
      const category = anchor.category;
      if (category?.id == null || !normalizeText(category.name || "").includes("caricatura")) return 0;
      const candidates = products.filter(product => product.category?.id === category.id).sort((a, b) => a.id - b.id);
      if (!candidates.length || candidates.length > 200) return 0;
      pools.set(anchor.id, candidates.map(product => product.id));
      candidates.forEach(product => stock.set(product.id, stockOf(product)));
      demand.set(anchor.id, (demand.get(anchor.id) || 0) + quantity);
    } else {
      fixed.set(anchor.id, (fixed.get(anchor.id) || 0) + quantity);
      stock.set(anchor.id, stockOf(anchor));
    }
  }
  const pieces = bundle.items.reduce((sum, item) => sum + Math.floor(Number(item.quantity) || 0), 0);
  let lo = 0, hi = Math.min(100000, Math.floor([...stock.values()].reduce((sum, value) => sum + value, 0) / pieces));
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo + 1) / 2);
    try {
      allocate(new Map([...fixed].map(([id, n]) => [id, n * mid])), new Map([...demand].map(([id, n]) => [id, n * mid])), pools, stock);
      lo = mid;
    } catch { hi = mid - 1; }
  }
  return lo;
}

const relevance = (query: string, title: string, haystack: string) => {
  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.length || !tokens.every(token => haystack.includes(token))) return -1;
  const name = normalizeText(title);
  return (name.startsWith(query) ? 3 : 0) + (name.includes(query) ? 2 : 0) + tokens.filter(token => name.includes(token)).length;
};

/** Busca en productos y bundles por nombre, categoría, género o talla (sin importar acentos). */
export function searchInventory(text: string, products: QuickProduct[], bundles: QuickBundle[], limit = 12, locations?: Map<number, LocationLike>): QuickResult[] {
  const query = normalizeText(text);
  if (query.length < 2) return [];
  const results: (QuickResult & { score: number })[] = [];
  for (const product of products) {
    const detail = productDetail(product);
    const location = formatLocation(locations?.get(product.id));
    const score = relevance(query, product.name, normalizeText(`${product.name} ${detail} ${product.gender || ""} ${location}`));
    if (score < 0) continue;
    const available = stockOf(product);
    results.push({ kind: "product", id: product.id, title: product.name.trim() || "Producto", detail, available, state: stockState(available, product.minStockAlert ?? 0), score, ...(location ? { location } : {}) });
  }
  for (const bundle of bundles) {
    const score = relevance(query, bundle.name, normalizeText(`${bundle.name} ${bundle.storeCategory || ""} bundle paquete`));
    if (score < 0) continue;
    const available = bundleAvailability(bundle, products);
    const pieces = bundle.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const price = Number(bundle.fixedPrice);
    results.push({ kind: "bundle", id: bundle.id, title: bundle.name.trim() || "Bundle", detail: [`Bundle de ${pieces} pares`, bundle.storeCategory?.trim()].filter(Boolean).join(" · "), available, state: stockState(available), price: Number.isFinite(price) && price > 0 ? price : undefined, score });
  }
  return results
    .sort((a, b) => b.score - a.score || Number(b.available > 0) - Number(a.available > 0) || a.title.localeCompare(b.title, "es"))
    .slice(0, limit)
    .map((entry): QuickResult => { const { score, ...result } = entry; void score; return result; });
}

/** Texto listo para el cliente; no revela cuántas piezas exactas hay. */
export function availabilityMessage(result: QuickResult) {
  const name = result.kind === "bundle" ? result.title : [result.title, result.detail].filter(Boolean).join(" · ");
  if (result.state === "empty") return `Por ahora «${name}» está agotado 😔. ¿Te muestro otra opción similar?`;
  return `¡Sí tenemos disponible «${name}»! 🙌 ¿Cuántos ${result.kind === "bundle" ? "paquetes" : "pares"} necesitas?`;
}
