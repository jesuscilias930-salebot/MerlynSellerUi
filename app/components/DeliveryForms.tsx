"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { request } from "../lib/api";
import { controlRequest } from "../lib/control-api";
import { cachedInventory, invalidateInventory } from "../lib/inventory-snapshot";
import {
  controlSaleRequest, draftFromDelivery, draftIssues, draftToPayload, emptyDraft, linesSummary, money, PAYMENT_LABELS, suggestedAmount,
  type Delivery, type DeliveryDraft, type DeliveryLine, type PaymentMethod,
} from "../lib/deliveries";
import { ConfirmDialog } from "./ConfirmDialog";
import { addLine, DeliveryLinesEditor, InventoryPicker } from "./InventoryPicker";

function Modal({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: ReactNode }) {
  return <div className="delivery-modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
    <button type="button" className="delivery-modal-backdrop" aria-label="Cerrar" onClick={onClose} />
    <section className="delivery-modal-card">
      <header><div><p>{kicker}</p><h2>{title}</h2></div><button type="button" className="delivery-modal-close" aria-label="Cerrar" onClick={onClose}>×</button></header>
      {children}
    </section>
  </div>;
}

/** Crear o editar una entrega. Si falla al guardar, conserva lo capturado y muestra el error. */
export function DeliveryForm({ delivery, prefill, onClose, onSaved }: { delivery?: Delivery; prefill?: Partial<DeliveryDraft>; onClose: () => void; onSaved: (delivery: Delivery) => void }) {
  const [draft, setDraft] = useState<DeliveryDraft>(() => (delivery ? draftFromDelivery(delivery) : emptyDraft(new Date(), prefill)));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const issues = draftIssues(draft);
  const set = <K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const fromChat = Boolean(draft.conversationId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setTouched(true);
    if (issues.length) return;
    setSaving(true); setError("");
    try {
      const saved = await request<Delivery>(delivery ? `/deliveries/${delivery.id}` : "/deliveries", { method: delivery ? "PUT" : "POST", body: JSON.stringify(draftToPayload(draft)) });
      onSaved(saved);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la entrega."); }
    finally { setSaving(false); }
  };
  return <Modal kicker={delivery ? "EDITAR ENTREGA" : "NUEVA ENTREGA"} title={delivery ? "Reprogramar o editar" : "Agendar entrega"} onClose={onClose}>
    <form className="delivery-form" onSubmit={event => void submit(event)}>
      <div className="delivery-form-row">
        <label>Nombre del cliente<input value={draft.customerName} maxLength={120} onChange={event => set("customerName", event.target.value)} placeholder="Ej. Ana López" />{fromChat && <small>Tomado de WhatsApp; puedes cambiarlo.</small>}</label>
        <label>Teléfono {fromChat ? "(del chat)" : "(opcional)"}<input value={draft.customerPhone} maxLength={20} inputMode="tel" readOnly={fromChat} onChange={event => set("customerPhone", event.target.value)} placeholder="272 123 4567" /></label>
      </div>
      <label>Lugar de entrega<input value={draft.location} maxLength={300} onChange={event => set("location", event.target.value)} placeholder="Ej. Parque Castillo, Orizaba · frente a la fuente" /></label>
      <div className="delivery-form-row">
        <label>Fecha<input type="date" value={draft.date} onChange={event => set("date", event.target.value)} /></label>
        <label>Hora<input type="time" value={draft.time} step={300} onChange={event => set("time", event.target.value)} /></label>
      </div>
      <div className="delivery-form-field">
        <span>Productos a entregar <small>(opcional)</small></span>
        <InventoryPicker allowCustom onPick={line => set("products", addLine(draft.products, line))} />
        <DeliveryLinesEditor lines={draft.products} onChange={lines => set("products", lines)} />
      </div>
      <label>Notas<textarea value={draft.notes} maxLength={2000} onChange={event => set("notes", event.target.value)} placeholder="Ej. Llamar al llegar · paga en efectivo · trae cambio de $500" /></label>
      {touched && issues.length > 0 && <ul className="delivery-issues" role="alert">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {error && <p className="delivery-error" role="alert"><b>No se guardó.</b> {error}</p>}
      <footer><button type="button" className="plain-button" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : delivery ? "Guardar cambios" : "Agendar entrega"}</button></footer>
    </form>
  </Modal>;
}

/**
 * Venta en persona: Control de ventas descuenta el stock y la entrega guarda
 * monto y forma de pago. Si Control ya registró la venta pero falló el segundo
 * paso, el reintento solo liga la venta (no descuenta otra vez).
 */
export function DeliverySaleForm({ delivery, onClose, onSaved }: { delivery: Delivery; onClose: () => void; onSaved: (delivery: Delivery) => void }) {
  const [items, setItems] = useState<DeliveryLine[]>(() => (delivery.products || []).filter(line => line.kind !== "custom"));
  const bundlePrices = useMemo(() => new Map((cachedInventory()?.bundles || []).map(bundle => [bundle.id, Number(bundle.fixedPrice)] as [number, number]).filter(([, price]) => price > 0)), []);
  const suggested = suggestedAmount(items, bundlePrices);
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [markDelivered, setMarkDelivered] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [controlSaleId, setControlSaleId] = useState<number | null>(null);
  const issues = [
    !items.length ? "Agrega al menos un producto o bundle vendido." : "",
    !(Number(amount) > 0) ? "Escribe el monto cobrado." : "",
    !payment ? "Elige el tipo de pago." : "",
  ].filter(Boolean);
  const pieces = items.reduce((sum, line) => sum + line.quantity, 0);
  const save = async () => {
    setConfirm(false); setSaving(true); setError("");
    let saleId = controlSaleId;
    try {
      if (!saleId) {
        const sale = await controlRequest<{ id: number }>("/sales", { method: "POST", body: JSON.stringify(controlSaleRequest(delivery, items)) });
        saleId = sale.id; setControlSaleId(sale.id); invalidateInventory();
      }
      const saved = await request<Delivery>(`/deliveries/${delivery.id}/sale`, { method: "POST", body: JSON.stringify({ amount: Number(amount), paymentMethod: payment, items, controlSaleId: saleId, markDelivered }) });
      onSaved(saved);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo registrar la venta.";
      setError(saleId ? `La venta #${saleId} ya se registró en Control y descontó el stock, pero no se pudo ligar a la entrega: ${message} Reintenta: no se descontará otra vez.` : message);
    } finally { setSaving(false); }
  };
  return <Modal kicker="VENTA EN PERSONA" title={`Registrar venta · ${delivery.customerName}`} onClose={onClose}>
    <div className="delivery-form">
      <div className="delivery-form-field">
        <span>Producto adquirido</span>
        {!controlSaleId && <InventoryPicker placeholder="Buscar producto o bundle vendido…" onPick={line => setItems(current => addLine(current, line))} />}
        {controlSaleId ? <p className="delivery-note">{linesSummary(items)}</p> : <DeliveryLinesEditor lines={items} onChange={setItems} />}
        {(delivery.products || []).some(line => line.kind === "custom") && <small className="delivery-note">Los productos escritos como texto ({linesSummary(delivery.products.filter(line => line.kind === "custom"))}) no descuentan inventario; búscalos arriba si son del catálogo.</small>}
      </div>
      <div className="delivery-form-row">
        <label>Monto cobrado (MXN)<input type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" />{suggested && Number(amount) !== suggested && <small><button type="button" className="delivery-link" onClick={() => setAmount(String(suggested))}>Usar precio de bundles: {money(suggested)}</button></small>}</label>
        <div className="delivery-form-field"><span>Tipo de pago</span><div className="delivery-payments" role="radiogroup" aria-label="Tipo de pago">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map(method => <button key={method} type="button" role="radio" aria-checked={payment === method} className={payment === method ? "selected" : ""} onClick={() => setPayment(method)}>{PAYMENT_LABELS[method]}</button>)}
        </div></div>
      </div>
      <label className="delivery-check"><input type="checkbox" checked={markDelivered} onChange={event => setMarkDelivered(event.target.checked)} /> Marcar la entrega como entregada</label>
      <p className="delivery-note">Se descontarán {pieces} pieza{pieces === 1 ? "" : "s"} del inventario en Control de ventas (los bundles descuentan todos sus componentes).</p>
      {error && <p className="delivery-error" role="alert">{error}</p>}
      <footer><button type="button" className="plain-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-action" disabled={saving || issues.length > 0} title={issues.join(" ")} onClick={() => setConfirm(true)}>{saving ? "Registrando…" : controlSaleId ? "Reintentar ligar la venta" : "Registrar venta"}</button></footer>
      {issues.length > 0 && <small className="delivery-note">{issues.join(" ")}</small>}
    </div>
    <ConfirmDialog open={confirm} title={`¿Registrar venta por ${money(amount)}?`} confirmLabel="Registrar venta" busy={saving} onCancel={() => setConfirm(false)} onConfirm={() => void save()}>
      <p>{linesSummary(items)} · {payment ? PAYMENT_LABELS[payment] : ""}</p>
      {!controlSaleId && <p>Se descontará del inventario y no se puede deshacer desde aquí.</p>}
    </ConfirmDialog>
  </Modal>;
}
