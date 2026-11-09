import type { ShippingBundle, StoredShippingPackage } from "./shipping-package";
import type { ShippingAddress, ShippingParcel } from "./chat-shipping-draft";
import type { Chat, QuoteBundleRef } from "./types";

export type QuoteRate = { carrier: string; service: string; serviceDescription?: string; deliveryEstimate?: string; deliveryDays?: string | number; totalPrice?: string | number; currency?: string };

/** Referencia guardable de un bundle de Control. */
export const quoteBundleRef = (bundle: Pick<ShippingBundle, "id" | "name">): QuoteBundleRef => ({ id: String(bundle.id), name: bundle.name });

/** Paquete del chat (si tiene) tal como se muestra junto al nombre: «(Paquete 100 pares)». */
export const chatQuoteBundle = (chat: Pick<Chat, "quoteBundleId" | "quoteBundleName"> | null | undefined): QuoteBundleRef | null =>
  chat?.quoteBundleId && chat.quoteBundleName ? { id: chat.quoteBundleId, name: chat.quoteBundleName } : null;

/** Paquete guardado (p. ej. el de un bundle, vía bundleShippingPackage) como paquete editable del formulario. */
export function storedParcel(stored: StoredShippingPackage | null, name = "Productos"): ShippingParcel | null {
  if (!stored) return null;
  return {
    type: stored.type || "box", content: stored.content || name, amount: String(stored.amount ?? 1), declaredValue: String(stored.declaredValue ?? 0),
    weight: String(stored.weight ?? ""), length: String(stored.dimensions?.length ?? ""), width: String(stored.dimensions?.width ?? ""), height: String(stored.dimensions?.height ?? ""),
  };
}

/** Datos mínimos que Envia exige del destino; devuelve lo que falta en español. */
export function missingDestinationFields(address: ShippingAddress): string[] {
  const missing: string[] = [];
  if (!address.name.trim()) missing.push("nombre");
  if (address.phone.replace(/\D/g, "").length < 8) missing.push("teléfono");
  if (address.street.trim().length < 3) missing.push("calle");
  if (!address.postalCode.trim()) missing.push("código postal");
  if (!address.city.trim() || !address.state.trim()) missing.push("ciudad");
  return missing;
}

const amount = (value: QuoteRate["totalPrice"]) => {
  const number = Number(value);
  return Number.isFinite(number) && value !== "" && value != null ? number : null;
};
/** Más baratas primero; las tarifas sin precio al final. */
export const ratesByPrice = (rates: QuoteRate[]) => [...rates].sort((a, b) => (amount(a.totalPrice) ?? Number.MAX_SAFE_INTEGER) - (amount(b.totalPrice) ?? Number.MAX_SAFE_INTEGER));

export function rateDelivery(rate: QuoteRate): string {
  if (rate.deliveryEstimate) return rate.deliveryEstimate;
  const days = Number(rate.deliveryDays);
  return Number.isFinite(days) && days > 0 ? `${days} día${days === 1 ? "" : "s"} hábil${days === 1 ? "" : "es"}` : "";
}
export function ratePrice(rate: QuoteRate): string {
  const value = amount(rate.totalPrice);
  if (value === null) return "Precio no disponible";
  return `${new Intl.NumberFormat("es-MX", { style: "currency", currency: rate.currency || "MXN" }).format(value)}${rate.currency && rate.currency !== "MXN" ? ` ${rate.currency}` : ""}`;
}
/** Texto listo para el chat con una opción de envío. */
export function rateMessage(rate: QuoteRate, destination: Pick<ShippingAddress, "city" | "postalCode">, bundleName?: string): string {
  const place = [destination.city, destination.postalCode && `CP ${destination.postalCode}`].filter(Boolean).join(", ");
  const delivery = rateDelivery(rate);
  return `Envío${bundleName ? ` de ${bundleName}` : ""}${place ? ` a ${place}` : ""} por ${rate.carrier.toUpperCase()} (${rate.serviceDescription || rate.service}): ${ratePrice(rate)}${delivery ? ` · entrega en ${delivery}` : ""}.`;
}
