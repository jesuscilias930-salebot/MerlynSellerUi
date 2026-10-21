export type DeliveryLine = { kind: "product" | "bundle" | "custom"; id?: number; name: string; quantity: number };
export type PaymentMethod = "cash" | "transfer" | "card" | "deposit" | "other";
export type DeliveryStatus = "scheduled" | "delivered" | "cancelled";
export type Delivery = {
  id: string; conversationId: string | null; customerName: string; customerPhone: string | null; location: string;
  scheduledAt: string; products: DeliveryLine[]; notes: string | null; status: DeliveryStatus;
  saleAmount: string | null; salePaymentMethod: PaymentMethod | null; saleItems: DeliveryLine[] | null;
  controlSaleId: number | null; saleRecordedAt: string | null; createdAt: string; updatedAt: string;
};
export type DeliveryDraft = {
  conversationId?: string | null; customerName: string; customerPhone: string; location: string;
  date: string; time: string; products: DeliveryLine[]; notes: string;
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", deposit: "Depósito", other: "Otro" };
export const STATUS_LABELS: Record<DeliveryStatus, string> = { scheduled: "Programada", delivered: "Entregada", cancelled: "Cancelada" };

const pad = (value: number) => String(value).padStart(2, "0");
/** Fecha y hora locales para los campos del formulario. */
export const toLocalInputs = (date: Date) => ({ date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` });
const dayKey = (date: Date) => toLocalInputs(date).date;

export function emptyDraft(now = new Date(), prefill: Partial<DeliveryDraft> = {}): DeliveryDraft {
  // Propuesta: mañana a las 11:00, el horario más común de entregas.
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0);
  return { customerName: "", customerPhone: "", location: "", ...toLocalInputs(tomorrow), products: [], notes: "", ...prefill };
}
export function draftFromDelivery(delivery: Delivery): DeliveryDraft {
  return {
    conversationId: delivery.conversationId, customerName: delivery.customerName, customerPhone: delivery.customerPhone || "",
    location: delivery.location, ...toLocalInputs(new Date(delivery.scheduledAt)), products: delivery.products || [], notes: delivery.notes || "",
  };
}
export function draftIssues(draft: DeliveryDraft): string[] {
  const issues: string[] = [];
  if (!draft.customerName.trim()) issues.push("Escribe el nombre del cliente.");
  if (!draft.location.trim()) issues.push("Escribe el lugar de entrega.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time) || Number.isNaN(new Date(`${draft.date}T${draft.time}`).getTime())) issues.push("Indica la fecha y la hora.");
  if (draft.customerPhone && !/^[\d +()-]*$/.test(draft.customerPhone)) issues.push("El teléfono solo admite números.");
  if (draft.products.some(line => !line.name.trim() || !(line.quantity >= 1))) issues.push("Revisa nombre y cantidad de cada producto.");
  return issues;
}
export function draftToPayload(draft: DeliveryDraft) {
  return {
    conversationId: draft.conversationId || null,
    customerName: draft.customerName.trim(), customerPhone: draft.customerPhone.trim() || null, location: draft.location.trim(),
    scheduledAt: new Date(`${draft.date}T${draft.time}`).toISOString(),
    products: draft.products.map(line => ({ ...line, name: line.name.trim(), quantity: Math.max(1, Math.floor(line.quantity)) })),
    notes: draft.notes.trim() || null,
  };
}

const weekday = (date: Date) => date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
export function dayLabel(date: Date, now = new Date()) {
  const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  const named = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : diff === -1 ? "Ayer" : "";
  return named ? `${named} · ${weekday(date)}` : weekday(date).replace(/^./, letter => letter.toUpperCase());
}
export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });

/** Agrupa por día local, en el orden recibido. */
export function groupByDay(deliveries: Delivery[], now = new Date()) {
  const groups: { key: string; label: string; items: Delivery[] }[] = [];
  for (const delivery of deliveries) {
    const date = new Date(delivery.scheduledAt);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(delivery);
    else groups.push({ key, label: dayLabel(date, now), items: [delivery] });
  }
  return groups;
}

export const linesSummary = (lines: DeliveryLine[] | null | undefined) =>
  (lines || []).map(line => `${line.quantity} × ${line.name}`).join(", ");
export const mapsUrl = (location: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
export const money = (value: number | string | null | undefined) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: amount % 1 ? 2 : 0 }) : "";
};

/** Venta para Control de ventas: descuenta stock (productos y bundles) y la liga al cliente. */
export function controlSaleRequest(delivery: Pick<Delivery, "conversationId" | "customerName" | "customerPhone">, items: DeliveryLine[]) {
  const digits = (delivery.customerPhone || "").replace(/\D/g, "");
  return {
    ...(delivery.conversationId ? { customerExternalId: delivery.conversationId } : {}),
    customerName: delivery.customerName.trim(),
    ...(digits.length >= 8 && digits.length <= 15 ? { customerPhone: digits } : {}),
    productsSold: items.filter(line => line.kind === "product" && line.id).map(line => ({ productId: line.id as number, quantity: line.quantity })),
    bundlesSold: items.filter(line => line.kind === "bundle" && line.id).map(line => ({ bundleId: line.id as number, quantity: line.quantity })),
  };
}
/** Sugerencia de monto con los precios de bundles; los productos sueltos no traen precio. */
export function suggestedAmount(items: DeliveryLine[], bundlePrices: Map<number, number>): number | null {
  if (!items.length || items.some(line => line.kind !== "bundle" || !bundlePrices.get(line.id as number))) return null;
  return items.reduce((sum, line) => sum + (bundlePrices.get(line.id as number) as number) * line.quantity, 0);
}
