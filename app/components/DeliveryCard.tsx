"use client";

import { useMemo, type ReactNode } from "react";
import { linesSummary, mapsUrl, money, PAYMENT_LABELS, STATUS_LABELS, timeLabel, type Delivery } from "../lib/deliveries";
import { withProductDetails } from "../lib/reminders";
import { useInventoryProducts } from "../lib/use-inventory-products";

export function DeliveryCard({ delivery, actions, compact = false }: { delivery: Delivery; actions?: ReactNode; compact?: boolean }) {
  const inventory = useInventoryProducts();
  // Producto · color · talla, aunque la entrega se haya guardado solo con el nombre.
  const products = useMemo(() => withProductDetails(delivery.products, inventory), [delivery.products, inventory]);
  return <article className={`delivery-card status-${delivery.status}${compact ? " compact" : ""}`}>
    <div className="delivery-card-time"><b>{timeLabel(delivery.scheduledAt)}</b>{compact && <small>{new Date(delivery.scheduledAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}</small>}</div>
    <div className="delivery-card-body">
      <header><strong>{delivery.customerName}</strong><span className={`delivery-status ${delivery.status}`}>{STATUS_LABELS[delivery.status]}</span></header>
      <a href={mapsUrl(delivery.location)} target="_blank" rel="noreferrer">📍 {delivery.location}</a>
      {delivery.customerPhone && !compact && <small>☎ {delivery.customerPhone}</small>}
      {products.length > 0 && <small>📦 {linesSummary(products)}</small>}
      {delivery.notes && <small className="delivery-card-notes">📝 {delivery.notes}</small>}
      {delivery.saleRecordedAt && <p className="delivery-card-sale">💵 Venta: {money(delivery.saleAmount)} · {delivery.salePaymentMethod ? PAYMENT_LABELS[delivery.salePaymentMethod] : ""}{delivery.controlSaleId ? ` · Control #${delivery.controlSaleId}` : ""}</p>}
      {actions && <footer>{actions}</footer>}
    </div>
  </article>;
}
