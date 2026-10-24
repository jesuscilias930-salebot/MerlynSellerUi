"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";
import { controlRequest } from "../lib/control-api";
import { controlSaleRequest, money, PAYMENT_LABELS, suggestedAmount, type PaymentMethod } from "../lib/deliveries";
import { cachedInventory, invalidateInventory } from "../lib/inventory-snapshot";
import {
  conversationHref, linesSummary, openConversation, phoneLabel, reminderDay, reminderTime, SALE_STATUS_LABELS,
  type PendingSale, type ReminderLine, type SaleStatus,
} from "../lib/reminders";
import { ConfirmDialog } from "./ConfirmDialog";
import { addLine, DeliveryLinesEditor, InventoryPicker } from "./InventoryPicker";

type SaleRef = Pick<PendingSale, "id" | "contactName" | "phone" | "conversationId" | "items">;

/**
 * Cobrar la venta pendiente: se registra en Control de ventas (descuenta stock) y
 * se marca pagada. Si Control ya registró la venta y falló el segundo paso, el
 * reintento solo la liga (no descuenta otra vez).
 */
export function SalePayForm({ sale, onClose, onPaid }: { sale: SaleRef; onClose: () => void; onPaid: (sale: PendingSale) => void }) {
  const [items, setItems] = useState<ReminderLine[]>(() => (sale.items || []).filter(line => line.kind !== "custom"));
  const bundlePrices = useMemo(() => new Map((cachedInventory()?.bundles || []).map(bundle => [bundle.id, Number(bundle.fixedPrice)] as [number, number]).filter(([, price]) => price > 0)), []);
  const suggested = suggestedAmount(items, bundlePrices);
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
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
        const created = await controlRequest<{ id: number }>("/sales", { method: "POST", body: JSON.stringify(controlSaleRequest({ conversationId: sale.conversationId, customerName: sale.contactName, customerPhone: sale.phone }, items)) });
        saleId = created.id; setControlSaleId(created.id); invalidateInventory();
      }
      onPaid(await request<PendingSale>(`/pending-sales/${sale.id}/pay`, { method: "POST", body: JSON.stringify({ amount: Number(amount), paymentMethod: payment, items, controlSaleId: saleId }) }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo registrar el pago.";
      setError(saleId ? `La venta #${saleId} ya se registró en Control y descontó el stock, pero no se pudo marcar como pagada: ${message} Reintenta: no se descontará otra vez.` : message);
    } finally { setSaving(false); }
  };
  return <div className="delivery-modal" role="dialog" aria-modal="true" aria-label="Registrar pago" onKeyDown={event => { if (event.key === "Escape" && !saving) onClose(); }}>
    <button type="button" className="delivery-modal-backdrop" aria-label="Cerrar" onClick={() => !saving && onClose()} />
    <section className="delivery-modal-card">
      <header><div><p>VENTA PENDIENTE</p><h2>Registrar pago · {sale.contactName}</h2></div><button type="button" className="delivery-modal-close" aria-label="Cerrar" onClick={onClose} disabled={saving}>×</button></header>
      <div className="delivery-form">
        <div className="delivery-form-field">
          <span>Productos vendidos</span>
          {!controlSaleId && <InventoryPicker placeholder="Buscar producto o bundle vendido…" onPick={line => setItems(current => addLine(current, line))} />}
          {controlSaleId ? <p className="delivery-note">{linesSummary(items)}</p> : <DeliveryLinesEditor lines={items} onChange={setItems} />}
          {(sale.items || []).some(line => line.kind === "custom") && <small className="delivery-note">Los productos escritos como texto ({linesSummary(sale.items.filter(line => line.kind === "custom"))}) no descuentan inventario; búscalos arriba si son del catálogo.</small>}
        </div>
        <div className="delivery-form-row">
          <label>Monto cobrado (MXN)<input type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" />{suggested && Number(amount) !== suggested && <small><button type="button" className="delivery-link" onClick={() => setAmount(String(suggested))}>Usar precio de bundles: {money(suggested)}</button></small>}</label>
          <div className="delivery-form-field"><span>Tipo de pago</span><div className="delivery-payments" role="radiogroup" aria-label="Tipo de pago">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map(method => <button key={method} type="button" role="radio" aria-checked={payment === method} className={payment === method ? "selected" : ""} onClick={() => setPayment(method)}>{PAYMENT_LABELS[method]}</button>)}
          </div></div>
        </div>
        <p className="delivery-note">Se registrará en Control de ventas y se descontarán {pieces} pieza{pieces === 1 ? "" : "s"} del inventario. Si el recordatorio aún no llega, se cancela.</p>
        {error && <p className="delivery-error" role="alert">{error}</p>}
        <footer><button type="button" className="plain-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="button" className="primary-action" disabled={saving || issues.length > 0} title={issues.join(" ")} onClick={() => setConfirm(true)}>{saving ? "Registrando…" : controlSaleId ? "Reintentar marcar pagada" : "Registrar pago"}</button></footer>
        {issues.length > 0 && <small className="delivery-note">{issues.join(" ")}</small>}
      </div>
      <ConfirmDialog open={confirm} title={`¿Registrar pago por ${money(amount)}?`} confirmLabel="Registrar pago" busy={saving} onCancel={() => setConfirm(false)} onConfirm={() => void save()}>
        <p>{linesSummary(items)} · {payment ? PAYMENT_LABELS[payment] : ""}</p>
        {!controlSaleId && <p>Se descontará del inventario y no se puede deshacer desde aquí.</p>}
      </ConfirmDialog>
    </section>
  </div>;
}

/** Botones de una venta pendiente: registrar pago o cerrar sin venta (con confirmación). */
export function SaleActions({ sale, onChanged }: { sale: SaleRef; onChanged: () => void }) {
  const [paying, setPaying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = async () => {
    setBusy(true); setError("");
    try { await request(`/pending-sales/${sale.id}/cancel`, { method: "POST" }); setClosing(false); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cerrar la venta."); setClosing(false); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" className="delivery-action primary" onClick={() => setPaying(true)}>💵 Registrar pago</button>
    <button type="button" className="delivery-action subtle" onClick={() => setClosing(true)}>Cerrar sin venta</button>
    {error && <small className="delivery-error">{error}</small>}
    {paying && <SalePayForm sale={sale} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); onChanged(); }} />}
    <ConfirmDialog open={closing} tone="danger" busy={busy} title="¿Cerrar la venta sin pago?" confirmLabel="Cerrar sin venta" cancelLabel="Volver" onCancel={() => setClosing(false)} onConfirm={() => void close()}>
      <p>{sale.contactName} · {linesSummary(sale.items) || "sin productos"}. Si su recordatorio aún no llega, se cancela.</p>
    </ConfirmDialog>
  </>;
}

const FILTERS: [SaleStatus, string][] = [["open", "Pendientes de pago"], ["paid", "Pagadas"], ["cancelled", "Cerradas sin venta"]];

/** Recordatorios → Ventas pendientes. */
export function PendingSalesList() {
  const [status, setStatus] = useState<SaleStatus>("open");
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setSales(await request<PendingSale[]>(`/pending-sales?status=${status}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar las ventas."); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <>
    <div className="deliveries-toolbar">
      <div className="deliveries-filters" role="tablist" aria-label="Estado de la venta">{FILTERS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>{label}</button>)}</div>
    </div>
    {error && <p className="delivery-error" role="alert">{error} <button type="button" className="delivery-link" onClick={() => void load()}>Reintentar</button></p>}
    {loading && !sales.length ? <p className="deliveries-empty">Cargando ventas…</p>
      : sales.length === 0 ? <div className="deliveries-empty"><b>{status === "open" ? "No hay ventas pendientes de pago." : status === "paid" ? "Aún no hay ventas pagadas desde recordatorios." : "No hay ventas cerradas sin pago."}</b><span>Cada recordatorio crea una venta pendiente de pago.</span></div>
        : sales.map(sale => <article key={sale.id} className={`delivery-card pending-sale-card sale-${sale.status}`}>
          <div className="delivery-card-time"><b>{sale.status === "paid" ? money(sale.amount) : "💰"}</b></div>
          <div className="delivery-card-body">
            <header><strong>{sale.contactName}</strong><span className={`delivery-status sale-status ${sale.status}`}>{SALE_STATUS_LABELS[sale.status]}</span></header>
            <small>☎ {phoneLabel(sale.phone)}</small>
            <small>📦 {linesSummary(sale.status === "paid" ? sale.paidItems : sale.items) || "Sin productos"}</small>
            {sale.reminderAt && <small>⏰ Recordatorio: {reminderDay(sale.reminderAt)} · {reminderTime(sale.reminderAt)} · {sale.reminderStatus === "cancelled" ? "cancelado" : sale.reminderStatus === "done" ? "hecho" : sale.reminderNotifiedAt ? "ya avisado" : "programado"}{sale.reminderMode === "template" ? " · automático" : ""}</small>}
            {sale.status === "paid" && <p className="delivery-card-sale">💵 {money(sale.amount)} · {sale.paymentMethod ? PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] : ""} · Control #{sale.controlSaleId}</p>}
            <footer>
              {sale.status === "open" && <SaleActions sale={sale} onChanged={() => void load()} />}
              {sale.conversationId && <a className="delivery-action" href={conversationHref(sale.conversationId)} onClick={event => { event.preventDefault(); openConversation(sale.conversationId as string); }}>💬 Abrir chat</a>}
            </footer>
          </div>
        </article>)}
  </>;
}
