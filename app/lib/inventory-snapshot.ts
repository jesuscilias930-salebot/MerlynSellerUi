import { controlRequest, controlSession } from "./control-api";
import type { QuickBundle, QuickProduct } from "./quick-inventory";

export type InventorySnapshot = { products: QuickProduct[]; bundles: QuickBundle[]; loadedAt: number };
const FRESH_MS = 60_000;
// Compartido entre chats y pantallas: abrir otra búsqueda no vuelve a descargar todo.
let cache: InventorySnapshot | null = null;

export const cachedInventory = () => cache;
export const CONTROL_LOGIN_MESSAGE = "Inicia sesión en Control de ventas para consultar existencias.";

/** Productos y bundles de Control de ventas, con caché de un minuto. */
export async function loadInventory(force = false): Promise<InventorySnapshot> {
  if (!force && cache && Date.now() - cache.loadedAt < FRESH_MS) return cache;
  if (!controlSession.get()) throw new Error(CONTROL_LOGIN_MESSAGE);
  const [products, bundles] = await Promise.all([controlRequest<QuickProduct[]>("/products/all"), controlRequest<QuickBundle[]>("/bundles")]);
  cache = { products: Array.isArray(products) ? products : [], bundles: Array.isArray(bundles) ? bundles : [], loadedAt: Date.now() };
  return cache;
}
/** Después de vender, el stock cambió: la próxima consulta vuelve a Control. */
export const invalidateInventory = () => { cache = null; };
