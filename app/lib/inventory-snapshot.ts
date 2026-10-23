import { request } from "./api";
import { controlRequest, controlSession } from "./control-api";
import { locationMap, type LocationMap, type ProductLocation } from "./product-locations";
import type { QuickBundle, QuickProduct } from "./quick-inventory";

export type InventorySnapshot = { products: QuickProduct[]; bundles: QuickBundle[]; locations: LocationMap; loadedAt: number };
const FRESH_MS = 60_000;
// Compartido entre chats y pantallas: abrir otra búsqueda no vuelve a descargar todo.
let cache: InventorySnapshot | null = null;

export const cachedInventory = () => cache;
export const CONTROL_LOGIN_MESSAGE = "Inicia sesión en Control de ventas para consultar existencias.";

/** Productos y bundles de Control de ventas, con caché de un minuto. */
export async function loadInventory(force = false): Promise<InventorySnapshot> {
  if (!force && cache && Date.now() - cache.loadedAt < FRESH_MS) return cache;
  if (!controlSession.get()) throw new Error(CONTROL_LOGIN_MESSAGE);
  const [products, bundles, locations] = await Promise.all([
    controlRequest<QuickProduct[]>("/products/all"),
    controlRequest<QuickBundle[]>("/bundles"),
    // Las ubicaciones son un extra: si fallan, el stock se muestra igual.
    request<ProductLocation[]>("/inventory-locations").catch(() => [] as ProductLocation[]),
  ]);
  cache = { products: Array.isArray(products) ? products : [], bundles: Array.isArray(bundles) ? bundles : [], locations: locationMap(Array.isArray(locations) ? locations : []), loadedAt: Date.now() };
  return cache;
}
/** Después de vender, el stock cambió: la próxima consulta vuelve a Control. */
export const invalidateInventory = () => { cache = null; };
/** Refleja en la caché una ubicación recién guardada. */
export function updateCachedLocations(rows: ProductLocation[]) {
  if (!cache) return;
  const next = new Map(cache.locations);
  rows.forEach(row => { if (row.rack || row.level || row.side) next.set(row.productId, row); else next.delete(row.productId); });
  cache = { ...cache, locations: next };
}
