"use client";

import { useEffect, useRef, useState } from "react";
import { controlRequest } from "../lib/control-api";
import { fulfillmentLabel, orderDateLabel, orderStageFor, orderStages, paymentLabel, type OrderCard, type OrderDetail } from "../lib/order-board";
import { shippingDraftKey, type ShippingDraft } from "../lib/shipping-draft";
import { OrderBreakdown } from "./OrderBreakdown";
import { OrderOperations } from "./OrderOperations";
import detailStyles from "./StoreOrdersPanel.module.css";
import styles from "./OrdersBoard.module.css";

export function OrderDetailsModal({ card, revision, onClose, onUpdated, onOpenShipping }: { card: OrderCard; revision: number; onClose: () => void; onUpdated: () => void; onOpenShipping: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [retry, setRetry] = useState(0), [saving, setSaving] = useState(false), [shippingBusy, setShippingBusy] = useState(false), [shippingError, setShippingError] = useState("");
  const [result, setResult] = useState<{ key: string; data?: OrderDetail; error?: string }>();
  const key = `${card.id}:${revision}:${retry}`, loading = result?.key !== key;
  const order = result?.data;
  const locked = saving || shippingBusy;
  useEffect(() => { const element = dialog.current; if (element?.isConnected && !element.open) element.showModal(); return () => { if (element?.open) element.close(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    controlRequest<OrderDetail>(`/pending-orders/${encodeURIComponent(card.id)}`, { signal: controller.signal, cache: "no-store" })
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ key, data: previous?.data, error: error instanceof Error ? error.message : "No se pudo cargar el pedido." })); });
    return () => controller.abort();
  }, [card.id, key]);
  async function prepareShipping() {
    if (!order || locked || loading || result?.error) return;
    setShippingBusy(true); setShippingError("");
    try {
      const draft = await controlRequest<{ orderId: string; folio: string; destination: NonNullable<OrderDetail["shippingAddress"]>; lines: OrderDetail["lines"]; parcel: { pairs: number; weightKg: number; lengthCm: number; widthCm: number; heightCm: number; declaredValue: number } }>(`/pending-orders/${encodeURIComponent(order.id)}/shipping-draft`, { cache: "no-store" });
      const a = draft.destination, p = draft.parcel;
      if (!a || !p || [p.weightKg, p.lengthCm, p.widthCm, p.heightCm].some(value => !Number.isFinite(Number(value)) || Number(value) <= 0)) throw new Error("Revisa los pesos y empaques del pedido antes de cotizar.");
      const saved: ShippingDraft = { source: "order", orderId: draft.orderId, orderFolio: draft.folio, orderLines: draft.lines.map(line => ({ name: line.name, quantity: line.quantity })), pairs: p.pairs,
        destination: { name: a.recipient, phone: a.phone, email: a.email, street: a.street, number: a.exteriorNumber, interiorNumber: a.interiorNumber, references: a.references, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode, district: a.district },
        package: { type: "box", content: `Calcetines · ${p.pairs} pares`, amount: 1, declaredValue: Number(p.declaredValue), weight: Number(p.weightKg), dimensions: { length: Number(p.lengthCm), width: Number(p.widthCm), height: Number(p.heightCm) } } };
      sessionStorage.setItem(shippingDraftKey, JSON.stringify(saved)); onOpenShipping();
    } catch (error) { setShippingError(error instanceof Error ? error.message : "No se pudo preparar el envío."); }
    finally { setShippingBusy(false); }
  }
  const currentStage = orderStageFor(order?.fulfillmentStatus ?? card.fulfillmentStatus);
  return <dialog className={styles.modal} ref={dialog} aria-labelledby="order-modal-title" onCancel={event => { event.preventDefault(); if (!locked) onClose(); }}>
    <header className={styles.modalHeader}><div><small>DETALLE DEL PEDIDO</small><h2 id="order-modal-title">#{card.id.slice(0, 8).toUpperCase()} · {order?.customerName || card.customerName || "Compra como invitado"}</h2><p>{card.folio} · {orderDateLabel(card.createdAt)}</p></div><button type="button" autoFocus disabled={locked} onClick={onClose} aria-label="Cerrar detalle del pedido">✕</button></header>
    <div className={styles.modalBody}>
      <ol className={styles.progress} aria-label="Seguimiento del pedido">{orderStages.map((stage, index) => <li key={stage.key} aria-current={stage.key === currentStage ? "step" : undefined} className={stage.key === currentStage ? styles.currentStep : ""}><span>{index + 1}</span>{stage.label}</li>)}</ol>
      <div className={styles.detailStatus}><strong>{paymentLabel(order?.status || card.status)}</strong><span>{fulfillmentLabel(order?.fulfillmentStatus ?? card.fulfillmentStatus)}</span></div>
      {loading && <p role="status">Actualizando detalle…</p>}
      {result?.error && <div role="alert" className={styles.error}><span>{result.error} No se pueden hacer cambios hasta actualizar el pedido.</span><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
      {order && <div className={detailStyles.orderLayout}>
        <OrderBreakdown {...order}/>
        <aside className={detailStyles.orderSidebar} aria-label="Entrega y seguimiento">
          <OrderOperations order={order} onUpdated={onUpdated} onBusyChange={setSaving} disabled={loading || !!result?.error || shippingBusy}/>
          <button type="button" className={styles.primary} disabled={locked || loading || !!result?.error || !order.shippingAddress} onClick={() => void prepareShipping()}>{shippingBusy ? "Preparando datos…" : "Cotizar envío en Envia"}</button>
          {shippingError && <p role="alert" className={styles.error}>{shippingError}</p>}
          <section className={styles.address} aria-label="Dirección de entrega"><h3>Dirección de entrega</h3>
            {order.shippingAddress ? <><p><strong>{order.shippingAddress.recipient}</strong><br/>{order.shippingAddress.phone}<br/>{order.shippingAddress.email}</p><p>{order.shippingAddress.street} {order.shippingAddress.exteriorNumber}{order.shippingAddress.interiorNumber && ` · Interior ${order.shippingAddress.interiorNumber}`}<br/>{order.shippingAddress.district}, C.P. {order.shippingAddress.postalCode}<br/>{order.shippingAddress.city}, {order.shippingAddress.state}, {order.shippingAddress.country}</p>{order.shippingAddress.references && <p>Referencias: {order.shippingAddress.references}</p>}</> : <p>Dirección pendiente. Contacta al cliente con el folio del pedido.{order.customerPhone && <><br/>WhatsApp: {order.customerPhone}</>}</p>}
          </section>
        </aside>
      </div>}
    </div>
  </dialog>;
}
