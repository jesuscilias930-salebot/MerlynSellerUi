"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { request } from "../lib/api";
import {
  draftFromReminder, emptyReminderDraft, groupRemindersByDay, linesSummary, orderMessage, phoneLabel, reminderIssues, reminderPayload,
  reminderTime, whatsappLink, type Reminder, type ReminderDraft, type ReminderLine,
} from "../lib/reminders";
import { ConfirmDialog } from "./ConfirmDialog";
import { addLine, DeliveryLinesEditor, InventoryPicker } from "./InventoryPicker";

/** Botones para escribirle por WhatsApp: solo abrir el chat, o con saludo y su pedido para confirmar. */
export function ReminderLinks({ contactName, phone, products }: { contactName: string; phone: string; products?: ReminderLine[] | null }) {
  return <>
    <a className="reminder-link" href={whatsappLink(phone)} target="_blank" rel="noreferrer">💬 Enviar mensaje</a>
    <a className="reminder-link primary" href={whatsappLink(phone, orderMessage({ contactName, products }))} target="_blank" rel="noreferrer" title={orderMessage({ contactName, products })}>🧾 Enviar mensaje con pedido</a>
  </>;
}

/** Crear o editar un recordatorio. Si falla al guardar, conserva lo capturado. */
export function ReminderForm({ reminder, prefill, onClose, onSaved }: { reminder?: Reminder; prefill?: Partial<ReminderDraft>; onClose: () => void; onSaved: (reminder: Reminder) => void }) {
  const [draft, setDraft] = useState<ReminderDraft>(() => (reminder ? draftFromReminder(reminder) : emptyReminderDraft(new Date(), prefill)));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const issues = reminderIssues(draft);
  const set = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setTouched(true);
    if (issues.length) return;
    setSaving(true); setError("");
    try {
      onSaved(await request<Reminder>(reminder ? `/reminders/${reminder.id}` : "/reminders", { method: reminder ? "PUT" : "POST", body: JSON.stringify(reminderPayload(draft)) }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el recordatorio."); }
    finally { setSaving(false); }
  };
  return <div className="delivery-modal" role="dialog" aria-modal="true" aria-label={reminder ? "Editar recordatorio" : "Nuevo recordatorio"} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
    <button type="button" className="delivery-modal-backdrop" aria-label="Cerrar" onClick={onClose} />
    <section className="delivery-modal-card">
      <header><div><p>{reminder ? "EDITAR RECORDATORIO" : "NUEVO RECORDATORIO"}</p><h2>¿A quién le escribimos?</h2></div><button type="button" className="delivery-modal-close" aria-label="Cerrar" onClick={onClose}>×</button></header>
      <form className="delivery-form" onSubmit={event => void submit(event)}>
        <div className="delivery-form-row">
          <label>Nombre<input value={draft.contactName} maxLength={120} onChange={event => set("contactName", event.target.value)} placeholder="Ej. Ana López" autoFocus /></label>
          <label>Celular<input value={draft.phone} maxLength={25} inputMode="tel" autoComplete="tel" onChange={event => set("phone", event.target.value)} placeholder="272 123 4567" /><small>10 dígitos o con lada de país.</small></label>
        </div>
        <div className="delivery-form-row">
          <label>Fecha del recordatorio<input type="date" value={draft.date} onChange={event => set("date", event.target.value)} /></label>
          <label>Hora<input type="time" value={draft.time} step={300} onChange={event => set("time", event.target.value)} /></label>
        </div>
        <div className="delivery-form-field">
          <span>Productos que quiere comprar <small>(opcional)</small></span>
          <InventoryPicker allowCustom onPick={line => set("products", addLine(draft.products, line))} />
          <DeliveryLinesEditor lines={draft.products} onChange={lines => set("products", lines)} />
        </div>
        <label>Notas<textarea value={draft.notes} maxLength={2000} onChange={event => set("notes", event.target.value)} placeholder="Ej. Pidió precio de mayoreo · paga el viernes" /></label>
        <small className="reminder-form-hint">Cuando sea la hora te avisamos en el chat interno «Recordatorios» del inbox, con botones para escribirle por WhatsApp.</small>
        {touched && issues.length > 0 && <ul className="delivery-issues" role="alert">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {error && <p className="delivery-error" role="alert"><b>No se guardó.</b> {error}</p>}
        <footer><button type="button" className="plain-button" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : reminder ? "Guardar cambios" : "Guardar recordatorio"}</button></footer>
      </form>
    </section>
  </div>;
}

type View = "upcoming" | "done" | "all";
const VIEWS: [View, string][] = [["upcoming", "Pendientes"], ["done", "Hechos"], ["all", "Todos"]];
type Pending = { kind: "delete" | "done"; reminder: Reminder } | null;

export function ReminderCard({ reminder, actions }: { reminder: Reminder; actions?: ReactNode }) {
  const status = reminder.status === "done" ? "done" : reminder.notifiedAt ? "notified" : "scheduled";
  return <article className={`delivery-card reminder-card status-${status}`}>
    <div className="delivery-card-time"><b>{reminderTime(reminder.remindAt)}</b></div>
    <div className="delivery-card-body">
      <header><strong>{reminder.contactName}</strong><span className={`delivery-status reminder-status ${status}`}>{status === "done" ? "Hecho" : status === "notified" ? "Avisado en el chat" : "Programado"}</span></header>
      <small>☎ {phoneLabel(reminder.phone)}</small>
      {reminder.products?.length > 0 && <small>📦 {linesSummary(reminder.products)}</small>}
      {reminder.notes && <small className="delivery-card-notes">📝 {reminder.notes}</small>}
      {actions && <footer>{actions}</footer>}
    </div>
  </article>;
}

/** WhatsApp → Recordatorios. */
export function RemindersPanel() {
  const [view, setView] = useState<View>("upcoming");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReminders(await request<Reminder[]>(`/reminders?view=${view}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los recordatorios."); }
    finally { setLoading(false); }
  }, [view]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("merlyn:internal-chat", refresh);
    return () => window.removeEventListener("merlyn:internal-chat", refresh);
  }, [load]);
  const run = async () => {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      if (pending.kind === "delete") await request(`/reminders/${pending.reminder.id}`, { method: "DELETE" });
      else await request(`/reminders/${pending.reminder.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
      setPending(null);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar la acción."); setPending(null); }
    finally { setBusy(false); }
  };
  const reopen = async (reminder: Reminder) => {
    try { await request(`/reminders/${reminder.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "scheduled" }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo reabrir."); }
  };
  const due = reminders.filter(reminder => reminder.status === "scheduled" && reminder.notifiedAt).length;
  return <section className="deliveries-panel reminders-panel">
    <header className="deliveries-header">
      <div><p>WHATSAPP</p><h1>Recordatorios</h1><span>Guarda a quién debes escribirle, qué quiere comprar y cuándo. A la hora indicada te llega un aviso en el chat interno «Recordatorios» del inbox con botones para escribirle por WhatsApp.</span></div>
      <button type="button" className="primary-action" onClick={() => setCreating(true)}>＋ Nuevo recordatorio</button>
    </header>
    <div className="deliveries-toolbar">
      <div className="deliveries-filters" role="tablist" aria-label="Recordatorios">{VIEWS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? "selected" : ""} onClick={() => setView(value)}>{label}</button>)}</div>
      {view === "upcoming" && due > 0 && <span className="deliveries-stats">{due} ya {due === 1 ? "avisado" : "avisados"} en el chat, sin marcar como {due === 1 ? "hecho" : "hechos"}</span>}
    </div>
    {error && <p className="delivery-error" role="alert">{error} <button type="button" className="delivery-link" onClick={() => void load()}>Reintentar</button></p>}
    {loading && !reminders.length ? <p className="deliveries-empty">Cargando recordatorios…</p>
      : reminders.length === 0 ? <div className="deliveries-empty"><b>{view === "done" ? "Aún no marcas recordatorios como hechos." : "No hay recordatorios pendientes."}</b><span>Crea uno con «Nuevo recordatorio».</span></div>
        : groupRemindersByDay(reminders).map(group => <section key={group.key} className="delivery-day"><h3>{group.label}</h3>
          {group.items.map(reminder => <ReminderCard key={reminder.id} reminder={reminder} actions={<>
            <ReminderLinks contactName={reminder.contactName} phone={reminder.phone} products={reminder.products} />
            {reminder.status === "scheduled" ? <button type="button" className="delivery-action" onClick={() => setPending({ kind: "done", reminder })}>✓ Hecho</button>
              : <button type="button" className="delivery-action" onClick={() => void reopen(reminder)}>Reabrir</button>}
            <button type="button" className="delivery-action" onClick={() => setEditing(reminder)}>Editar</button>
            <button type="button" className="delivery-action danger" onClick={() => setPending({ kind: "delete", reminder })}>Eliminar</button>
          </>} />)}
        </section>)}
    {(creating || editing) && <ReminderForm reminder={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void load(); }} />}
    <ConfirmDialog
      open={Boolean(pending)}
      tone={pending?.kind === "delete" ? "danger" : "primary"}
      busy={busy}
      title={pending?.kind === "delete" ? "¿Eliminar este recordatorio?" : "¿Marcar como hecho?"}
      confirmLabel={pending?.kind === "delete" ? "Eliminar" : "Marcar hecho"}
      cancelLabel="Volver"
      onCancel={() => setPending(null)}
      onConfirm={() => void run()}
    >
      {pending && <p>{pending.reminder.contactName} · {new Date(pending.reminder.remindAt).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{pending.kind === "delete" ? ". Se borra por completo; los avisos que ya llegaron al chat se conservan." : "."}</p>}
    </ConfirmDialog>
  </section>;
}
