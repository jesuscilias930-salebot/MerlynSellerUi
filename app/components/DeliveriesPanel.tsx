"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";
import { groupByDay, type Delivery, type DeliveryDraft } from "../lib/deliveries";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeliveryCard } from "./DeliveryCard";
import { DeliveryForm, DeliverySaleForm } from "./DeliveryForms";
import { ToolAccordion } from "./ToolAccordion";

type Pending = { kind: "cancel" | "delete" | "deliver"; delivery: Delivery } | null;

/** Lista con acciones: editar, registrar venta, marcar entregada, cancelar y eliminar (con confirmación). */
function DeliveryList({ deliveries, grouped, compact, onChanged, onRemoved }: { deliveries: Delivery[]; grouped: boolean; compact?: boolean; onChanged: (delivery: Delivery) => void; onRemoved: (id: string) => void }) {
  const [editing, setEditing] = useState<Delivery | null>(null);
  const [selling, setSelling] = useState<Delivery | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      if (pending.kind === "delete") { await request(`/deliveries/${pending.delivery.id}`, { method: "DELETE" }); onRemoved(pending.delivery.id); }
      else onChanged(await request<Delivery>(`/deliveries/${pending.delivery.id}/status`, { method: "PATCH", body: JSON.stringify({ status: pending.kind === "cancel" ? "cancelled" : "delivered" }) }));
      setPending(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar la acción."); setPending(null); }
    finally { setBusy(false); }
  };
  const reactivate = async (delivery: Delivery) => {
    try { onChanged(await request<Delivery>(`/deliveries/${delivery.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "scheduled" }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo reactivar."); }
  };
  const actions = (delivery: Delivery) => <>
    {!delivery.saleRecordedAt && delivery.status !== "cancelled" && <button type="button" className="delivery-action primary" onClick={() => setSelling(delivery)}>💵 Registrar venta</button>}
    {delivery.status === "scheduled" && <button type="button" className="delivery-action" onClick={() => setPending({ kind: "deliver", delivery })}>✓ Entregada</button>}
    {delivery.status !== "cancelled" && <button type="button" className="delivery-action" onClick={() => setEditing(delivery)}>Editar</button>}
    {delivery.status === "scheduled" && !delivery.saleRecordedAt && <button type="button" className="delivery-action subtle" onClick={() => setPending({ kind: "cancel", delivery })}>Cancelar</button>}
    {delivery.status === "cancelled" && <button type="button" className="delivery-action" onClick={() => void reactivate(delivery)}>Reactivar</button>}
    {!delivery.saleRecordedAt && <button type="button" className="delivery-action danger" onClick={() => setPending({ kind: "delete", delivery })}>Eliminar</button>}
  </>;
  const cards = (items: Delivery[]) => items.map(delivery => <DeliveryCard key={delivery.id} delivery={delivery} compact={compact} actions={actions(delivery)} />);
  return <>
    {error && <p className="delivery-error" role="alert">{error}</p>}
    {grouped ? groupByDay(deliveries).map(group => <section key={group.key} className="delivery-day"><h3>{group.label}</h3>{cards(group.items)}</section>) : cards(deliveries)}
    {editing && <DeliveryForm delivery={editing} onClose={() => setEditing(null)} onSaved={saved => { onChanged(saved); setEditing(null); }} />}
    {selling && <DeliverySaleForm delivery={selling} onClose={() => setSelling(null)} onSaved={saved => { onChanged(saved); setSelling(null); }} />}
    <ConfirmDialog
      open={Boolean(pending)}
      tone={pending?.kind === "deliver" ? "primary" : "danger"}
      busy={busy}
      title={pending?.kind === "delete" ? "¿Eliminar esta entrega?" : pending?.kind === "cancel" ? "¿Cancelar esta entrega?" : "¿Marcar como entregada?"}
      confirmLabel={pending?.kind === "delete" ? "Eliminar" : pending?.kind === "cancel" ? "Cancelar entrega" : "Marcar entregada"}
      cancelLabel="Volver"
      onCancel={() => setPending(null)}
      onConfirm={() => void run()}
    >
      {pending && <p>{pending.delivery.customerName} · {new Date(pending.delivery.scheduledAt).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{pending.kind === "deliver" ? ". Si también cobraste, mejor usa «Registrar venta»." : pending.kind === "delete" ? ". Se borra por completo." : ". Quedará en el historial como cancelada."}</p>}
    </ConfirmDialog>
  </>;
}

type Filter = "upcoming" | "today" | "past" | "all";
const FILTERS: [Filter, string][] = [["upcoming", "Próximas"], ["today", "Hoy"], ["past", "Pasadas"], ["all", "Todas"]];
const startOfDay = (offset = 0) => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset); };
const queryFor = (filter: Filter) => {
  const params = new URLSearchParams();
  if (filter === "upcoming") params.set("from", startOfDay().toISOString());
  if (filter === "today") { params.set("from", startOfDay().toISOString()); params.set("to", startOfDay(1).toISOString()); }
  if (filter === "past") { params.set("to", startOfDay().toISOString()); params.set("order", "desc"); }
  return params.toString();
};

/** WhatsApp → Entregas. */
export function DeliveriesPanel() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [showCancelled, setShowCancelled] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDeliveries(await request<Delivery[]>(`/deliveries?${queryFor(filter)}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar las entregas."); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const visible = useMemo(() => deliveries.filter(delivery => showCancelled || delivery.status !== "cancelled"), [deliveries, showCancelled]);
  const today = deliveries.filter(delivery => delivery.status === "scheduled" && new Date(delivery.scheduledAt) >= startOfDay() && new Date(delivery.scheduledAt) < startOfDay(1)).length;
  const pendingSales = deliveries.filter(delivery => delivery.status === "delivered" && !delivery.saleRecordedAt).length;
  return <section className="deliveries-panel">
    <header className="deliveries-header">
      <div><p>WHATSAPP</p><h1>Entregas</h1><span>Agenda entregas en persona y registra la venta al entregar. También puedes agendarlas desde un chat del inbox, en Herramientas → Gestión de venta.</span></div>
      <button type="button" className="primary-action" onClick={() => setCreating(true)}>＋ Nueva entrega</button>
    </header>
    <div className="deliveries-toolbar">
      <div className="deliveries-filters" role="tablist" aria-label="Periodo">{FILTERS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <label className="delivery-check"><input type="checkbox" checked={showCancelled} onChange={event => setShowCancelled(event.target.checked)} /> Mostrar canceladas</label>
      {filter !== "past" && <span className="deliveries-stats">{today} programada{today === 1 ? "" : "s"} para hoy{pendingSales ? ` · ${pendingSales} entregada${pendingSales === 1 ? "" : "s"} sin venta` : ""}</span>}
    </div>
    {error && <p className="delivery-error" role="alert">{error} <button type="button" className="delivery-link" onClick={() => void load()}>Reintentar</button></p>}
    {loading && !deliveries.length ? <p className="deliveries-empty">Cargando entregas…</p> : visible.length === 0 ? <div className="deliveries-empty"><b>No hay entregas {filter === "past" ? "pasadas" : filter === "today" ? "para hoy" : "próximas"}.</b><span>Agenda una con «Nueva entrega» o desde un chat.</span></div>
      : <DeliveryList deliveries={visible} grouped onChanged={saved => setDeliveries(current => current.map(item => item.id === saved.id ? saved : item))} onRemoved={id => setDeliveries(current => current.filter(item => item.id !== id))} />}
    {creating && <DeliveryForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
  </section>;
}

/** Herramienta del chat: entregas de esta conversación y botón para agendar. */
export function ChatDeliveriesCard({ conversationId, prefill }: { conversationId?: string; prefill: Partial<DeliveryDraft> }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    if (!conversationId) return;
    try { setDeliveries(await request<Delivery[]>(`/deliveries?conversationId=${conversationId}&order=desc`)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar las entregas."); }
  }, [conversationId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const upcoming = deliveries.filter(delivery => delivery.status !== "cancelled").slice(0, 5);
  return <ToolAccordion icon="🛵" title="Entregas" description={upcoming.some(item => item.status === "scheduled") ? `${upcoming.filter(item => item.status === "scheduled").length} programada(s) con este cliente` : "Agenda una entrega en persona y registra la venta."}>
    <button type="button" className="tool-primary-button" disabled={!conversationId} onClick={() => setCreating(true)}>＋ Agendar entrega</button>
    {error && <p className="delivery-error">{error}</p>}
    {upcoming.length > 0 && <DeliveryList compact grouped={false} deliveries={upcoming} onChanged={saved => setDeliveries(current => current.map(item => item.id === saved.id ? saved : item))} onRemoved={id => setDeliveries(current => current.filter(item => item.id !== id))} />}
    {creating && <DeliveryForm prefill={{ ...prefill, conversationId }} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
  </ToolAccordion>;
}
