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

export type QuoteShipment = { id: string; carrier: string; service: string; trackingNumber?: string | null; labelUrl?: string | null; status?: string; price?: string | number | null; currency?: string | null; createdAt?: string };
/** Texto para avisar al cliente su número de guía. */
export function trackingMessage(shipment: Pick<QuoteShipment, "carrier" | "service" | "trackingNumber">): string {
  return shipment.trackingNumber
    ? `Tu pedido va por ${shipment.carrier.toUpperCase()} (${shipment.service}). Número de guía: ${shipment.trackingNumber}.`
    : `Tu guía de ${shipment.carrier.toUpperCase()} (${shipment.service}) ya está generada; te comparto el número de rastreo en cuanto esté disponible.`;
}

const CARRIERS: Record<string, string> = { dhl: "DHL", fedex: "FedEx", ups: "UPS", estafeta: "Estafeta", redpack: "Redpack", paquetexpress: "Paquetexpress", sendex: "Sendex", "99minutos": "99minutos", jtexpress: "J&T Express", ampm: "AMPM", tresguerras: "Tresguerras", quiken: "Quiken", noventa9minutos: "99minutos", dostavista: "Dostavista" };
export const carrierName = (carrier: string) => CARRIERS[carrier.trim().toLowerCase()] || (carrier.length <= 4 ? carrier.toUpperCase() : carrier.charAt(0).toUpperCase() + carrier.slice(1).toLowerCase());

/** Mensaje para ofrecer al cliente la opción más económica. */
export function bestPriceMessage(rates: QuoteRate[]): string | null {
  const best = ratesByPrice(rates).find(rate => ratePrice(rate) !== "Precio no disponible");
  if (!best) return null;
  return `El envío con mejor precio es con ${carrierName(best.carrier)} en ${ratePrice(best)}. ¿Le gustaría que seleccionemos esta paquetería para enviar su pedido?`;
}

/** «hace 5 min», «hace 2 h». */
export function quoteAge(savedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}
