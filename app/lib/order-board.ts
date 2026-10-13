import type { OperationalOrder } from "../components/OrderOperations";

export const orderStages = [
  { key: "PENDING", label: "Pendiente", hint: "Pedidos nuevos y por atender" },
  { key: "ASSEMBLED", label: "Armado", hint: "Paquete armado, falta la guía" },
  { key: "LABEL_CREATED", label: "Guía creada", hint: "Listo para entregar a paquetería" },
  { key: "DISPATCHED", label: "Despachado", hint: "Enviado o entregado al cliente" },
] as const;
export type OrderStage = typeof orderStages[number]["key"];
export type BoardPages = Record<OrderStage, number>;
export type OrderDates = { startDate: string; endDate: string };
export const emptyBoardPages = (): BoardPages => ({ PENDING: 0, ASSEMBLED: 0, LABEL_CREATED: 0, DISPATCHED: 0 });
export type OrderCard = {
  id: string; folio: string; customerName: string; status: string; fulfillmentStatus?: string | null;
  createdAt: string; subtotal: number; shippingAmount?: number | null; total: number;
  trackingNumber?: string; dispatchCarrier?: string; inventoryIssue?: string;
};
export type OrderColumn = { stage: OrderStage; page: number; size: number; totalElements: number; totalPages: number; content: OrderCard[] };
export type OrdersBoard = { columns: OrderColumn[]; totalElements: number; timeZone: string; startDate?: string; endDate?: string };
export type OrderDetail = OperationalOrder & OrderCard & {
  customerPhone: string; shippingCarrier?: string; shippingService?: string; shippingEnvironment?: string;
  shippingAddress?: { recipient: string; phone: string; email: string; country: string; postalCode: string; state: string; city: string; district: string; street: string; exteriorNumber: string; interiorNumber?: string; references?: string } | null;
  lines: { kind: string; itemId: number; name: string; quantity: number; unitPrice: number; contents?: string }[];
};
export function orderBoardPath(dates: OrderDates, pages: BoardPages) {
  const params = new URLSearchParams({ size: "20" });
  if (dates.startDate) params.set("startDate", dates.startDate);
  if (dates.endDate) params.set("endDate", dates.endDate);
  const names = { PENDING: "pendingPage", ASSEMBLED: "assembledPage", LABEL_CREATED: "labelPage", DISPATCHED: "dispatchedPage" } as const;
  for (const { key } of orderStages) params.set(names[key], String(Math.max(0, Math.trunc(pages[key]))));
  return `/pending-orders/board?${params}`;
}
export function orderStageFor(state?: string | null): OrderStage {
  if (state === "PREPARING") return "ASSEMBLED";
  if (state === "LABEL_CREATED") return "LABEL_CREATED";
  if (state === "SHIPPED" || state === "DELIVERED") return "DISPATCHED";
  return "PENDING";
}
export function orderDateError({ startDate, endDate }: OrderDates) {
  for (const value of [startDate, endDate]) {
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > "9998-12-31") return "Selecciona fechas válidas.";
  }
  return startDate && endDate && startDate > endDate ? "La fecha inicial no puede ser posterior a la final." : "";
}
export const orderMoney = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
export function orderDateLabel(value: string) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "Fecha no disponible";
}
export const paymentLabel = (status: string) => ({ PAID: "Pagado", PENDING: "Pendiente de pago", PAYMENT_PENDING: "Confirmando pago en Stripe", PAID_TEST: "Pago de prueba", PAYMENT_FAILED: "Pago fallido", PAYMENT_EXPIRED: "Pago expirado" } as Record<string, string>)[status] || status;
export const fulfillmentLabel = (status?: string | null) => ({ AWAITING_PAYMENT: "Esperando pago", READY: "Por armar", PREPARING: "Armado", LABEL_CREATED: "Guía creada", SHIPPED: "Despachado", DELIVERED: "Entregado", CANCELLED: "Cancelado", REFUND_REQUESTED: "Reembolso solicitado", STOCK_ISSUE: "Revisar existencias", REVIEW_REQUIRED: "Requiere conciliación", TEST: "Pedido de prueba" } as Record<string, string>)[status || "AWAITING_PAYMENT"] || status || "Pendiente";
