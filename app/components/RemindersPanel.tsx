"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { request } from "../lib/api";
import { money } from "../lib/deliveries";
import { useInventoryProducts } from "../lib/use-inventory-products";
import {
  agreedDateLabel, conversationHref, defaultMappings, draftFromReminder, emptyReminderDraft, groupRemindersByDay, linesSummary, MESSAGE_STATUS_LABELS,
  openConversation, orderMessage, phoneLabel, productsChanged, withProductDetails, reminderIssues, reminderPayload, reminderTime, SALE_STATUS_LABELS, SOURCE_LABELS, templateIssues,
  templatePreview, whatsappLink, type MappingSource, type Reminder, type ReminderDraft, type ReminderLine, type ReminderTemplate,
} from "../lib/reminders";
import { ConfirmDialog } from "./ConfirmDialog";
import { addLine, DeliveryLinesEditor, InventoryPicker } from "./InventoryPicker";
import { PendingSalesList, SaleActions } from "./PendingSales";

/** Botones para escribirle por WhatsApp: solo abrir el chat, o con saludo y su pedido para confirmar. */
export function ReminderLinks({ contactName, phone, products: saved }: { contactName: string; phone: string; products?: ReminderLine[] | null }) {
  const inventory = useInventoryProducts();
  const products = useMemo(() => withProductDetails(saved, inventory), [saved, inventory]);
  return <>
    <a className="reminder-link" href={whatsappLink(phone)} target="_blank" rel="noreferrer">💬 Enviar mensaje</a>
    <a className="reminder-link primary" href={whatsappLink(phone, orderMessage({ contactName, products }))} target="_blank" rel="noreferrer" title={orderMessage({ contactName, products })}>🧾 Enviar mensaje con pedido</a>
  </>;
}

/** Plantillas oficiales para el envío automático (se cargan una vez por formulario). */
function useTemplates() {
  const [templates, setTemplates] = useState<ReminderTemplate[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<ReminderTemplate[]>("/whatsapp-templates")
      .then(rows => { if (active) setTemplates(Array.isArray(rows) ? rows : []); })
      .catch(reason => { if (active) { setTemplates([]); setError(reason instanceof Error ? reason.message : "No se pudieron cargar las plantillas."); } });
    return () => { active = false; };
  }, []);
  return { templates, error };
}

/** Crear o editar un recordatorio. Si falla al guardar, conserva lo capturado. */
export function ReminderForm({ reminder, prefill, onClose, onSaved }: { reminder?: Reminder; prefill?: Partial<ReminderDraft>; onClose: () => void; onSaved: (reminder: Reminder) => void }) {
  const [draft, setDraft] = useState<ReminderDraft>(() => (reminder ? draftFromReminder(reminder) : emptyReminderDraft(new Date(), prefill)));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { templates, error: templatesError } = useTemplates();
  const approved = useMemo(() => (templates || []).filter(template => template.status === "APPROVED"), [templates]);
  const template = (templates || []).find(item => item.id === draft.templateId);
  const issues = [...reminderIssues(draft), ...templateIssues(template, draft)];
  const set = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const chooseTemplate = (id: string) => {
    const next = (templates || []).find(item => item.id === id);
    setDraft(current => ({ ...current, templateId: id, templateMappings: next ? defaultMappings(next, id === current.templateId ? current.templateMappings : []) : [] }));
  };
  const setMapping = (index: number, patch: { source?: MappingSource; value?: string }) =>
    setDraft(current => ({ ...current, templateMappings: current.templateMappings.map((mapping, position) => position === index ? { ...mapping, ...patch } : mapping) }));
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
    <section className="delivery-modal-card reminder-modal-card">
      <header><div><p>{reminder ? "EDITAR RECORDATORIO" : "NUEVO RECORDATORIO"}</p><h2>¿A quién le escribimos?</h2></div><button type="button" className="delivery-modal-close" aria-label="Cerrar" onClick={onClose}>×</button></header>
      <form className="delivery-form" onSubmit={event => void submit(event)}>
        <div className="delivery-form-row">
          <label>Nombre<input value={draft.contactName} maxLength={120} onChange={event => set("contactName", event.target.value)} placeholder="Ej. Ana López" autoFocus /></label>
          <label>Celular<input value={draft.phone} maxLength={25} inputMode="tel" autoComplete="tel" onChange={event => set("phone", event.target.value)} placeholder="272 123 4567" /><small>10 dígitos o con lada de país.</small></label>
        </div>
        <div className="delivery-form-field">
          <span>Productos que quiere comprar <small>(opcional)</small></span>
          <InventoryPicker allowCustom onPick={line => set("products", addLine(draft.products, line))} />
          <DeliveryLinesEditor lines={draft.products} onChange={lines => set("products", lines)} />
        </div>
        <div className="delivery-form-row">
          <label>Fecha acordada<input type="date" value={draft.agreedDate} onChange={event => set("agreedDate", event.target.value)} /><small>El día que quedó de comprar o recoger.</small></label>
          <span />
        </div>
        <div className="delivery-form-row">
          <label>Fecha del recordatorio<input type="date" value={draft.date} onChange={event => set("date", event.target.value)} /></label>
          <label>Hora<input type="time" value={draft.time} step={300} onChange={event => set("time", event.target.value)} /></label>
        </div>
        <div className="delivery-form-field">
          <span>¿Cómo se envía?</span>
          <div className="reminder-mode" role="radiogroup" aria-label="Tipo de envío">
            <button type="button" role="radio" aria-checked={draft.sendMode === "manual"} onClick={() => set("sendMode", "manual")}><b>✋ Manual</b><small>Te llega el aviso al chat interno con los enlaces para escribirle.</small></button>
            <button type="button" role="radio" aria-checked={draft.sendMode === "template"} onClick={() => { set("sendMode", "template"); if (!draft.templateId && approved.length === 1) chooseTemplate(approved[0].id); }}><b>🤖 Automático con plantilla</b><small>Se le envía la plantilla de WhatsApp y te avisamos en el chat interno.</small></button>
          </div>
        </div>
        {draft.sendMode === "template" && <div className="reminder-template">
          {templates === null ? <small>Cargando plantillas…</small> : !approved.length ? <p className="delivery-error">No tienes plantillas aprobadas por WhatsApp. {templatesError || "Créalas en Meta y sincronízalas en WhatsApp → Plantillas oficiales."}</p> : <>
            <label>Plantilla<select value={draft.templateId} onChange={event => chooseTemplate(event.target.value)}>
              <option value="">Elige una plantilla aprobada</option>
              {approved.map(item => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}
              {template && template.status !== "APPROVED" && <option value={template.id}>{template.name} ({template.status})</option>}
            </select></label>
            {template && <>
              {draft.templateMappings.length > 0 && <div className="reminder-mappings">
                {draft.templateMappings.map((mapping, index) => <div key={`${mapping.component}-${mapping.position}`} className="reminder-mapping">
                  <code>{mapping.component === "header" ? "Encabezado " : ""}{`{{${mapping.position}}}`}</code>
                  <select aria-label={`Valor de {{${mapping.position}}}`} value={mapping.source} onChange={event => setMapping(index, { source: event.target.value as MappingSource })}>
                    {(Object.keys(SOURCE_LABELS) as MappingSource[]).map(source => <option key={source} value={source}>{SOURCE_LABELS[source]}</option>)}
                  </select>
                  {mapping.source === "fixed" && <input aria-label={`Texto fijo de {{${mapping.position}}}`} value={mapping.value || ""} maxLength={200} onChange={event => setMapping(index, { value: event.target.value })} placeholder="Texto" />}
                </div>)}
              </div>}
              <div className="reminder-preview"><span>Vista previa</span><p>{templatePreview(template, draft)}</p></div>
            </>}
          </>}
        </div>}
        <label>Notas <small>(internas, no se envían)</small><textarea value={draft.notes} maxLength={2000} onChange={event => set("notes", event.target.value)} placeholder="Ej. Pidió precio de mayoreo · paga el viernes" /></label>
        <small className="reminder-form-hint">{reminder ? "" : "Se creará una venta pendiente de pago con estos productos. Si la cobras o la cierras antes de la hora, el recordatorio se cancela."}</small>
        {touched && issues.length > 0 && <ul className="delivery-issues" role="alert">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {error && <p className="delivery-error" role="alert"><b>No se guardó.</b> {error}</p>}
        <footer><button type="button" className="plain-button" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : reminder ? "Guardar cambios" : "Guardar recordatorio"}</button></footer>
      </form>
    </section>
  </div>;
}

type View = "upcoming" | "done" | "all" | "sales";
const VIEWS: [View, string][] = [["upcoming", "Pendientes"], ["done", "Hechos y cancelados"], ["all", "Todos"], ["sales", "Ventas pendientes"]];
type Pending = { kind: "delete" | "done"; reminder: Reminder } | null;
const STATUS = (reminder: Reminder) => reminder.status === "done" ? "done" : reminder.status === "cancelled" ? "cancelled" : reminder.notifiedAt ? "notified" : "scheduled";
const STATUS_LABELS = { done: "Hecho", cancelled: "Cancelado", notified: "Avisado", scheduled: "Programado" } as const;

export function ReminderCard({ reminder, actions, onChanged }: { reminder: Reminder; actions?: ReactNode; onChanged: () => void }) {
  const status = STATUS(reminder);
  const sent = reminder.sendMode === "template" && reminder.notifiedAt;
  return <article className={`delivery-card reminder-card status-${status}`}>
    <div className="delivery-card-time"><b>{reminderTime(reminder.remindAt)}</b></div>
    <div className="delivery-card-body">
      <header><strong>{reminder.contactName}</strong><span className={`delivery-status reminder-status ${status}`}>{STATUS_LABELS[status]}</span></header>
      <small>☎ {phoneLabel(reminder.phone)}</small>
      {reminder.products?.length > 0 && <small>📦 {linesSummary(reminder.products)}</small>}
      {reminder.agreedDate && <small>📅 Fecha acordada: {agreedDateLabel(reminder.agreedDate)}</small>}
      {reminder.notes && <small className="delivery-card-notes">📝 {reminder.notes}</small>}
      <small className="reminder-mode-line">{reminder.sendMode === "template" ? `🤖 Automático · plantilla «${reminder.templateName || "sin plantilla"}»` : "✋ Manual · te llega el enlace al chat interno"}
        {sent && !reminder.sendError && reminder.sentMessageStatus && <b> · {MESSAGE_STATUS_LABELS[reminder.sentMessageStatus] || reminder.sentMessageStatus}</b>}
      </small>
      {reminder.sendError && <small className="reminder-send-error">⚠️ No se envió: {reminder.sendError}</small>}
      {reminder.saleId && reminder.saleStatus && <div className={`reminder-sale sale-${reminder.saleStatus}`}>
        <span>💰 Venta: <b>{SALE_STATUS_LABELS[reminder.saleStatus]}</b>{reminder.saleStatus === "paid" && reminder.saleAmount ? ` · ${money(reminder.saleAmount)} · Control #${reminder.saleControlId}` : ""}</span>
        {reminder.saleStatus === "open" && <span className="reminder-sale-actions"><SaleActions sale={{ id: reminder.saleId, contactName: reminder.contactName, phone: reminder.phone, conversationId: reminder.conversationId, items: reminder.products }} onChanged={onChanged} /></span>}
      </div>}
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
  const [salesKey, setSalesKey] = useState(0);
  const inventory = useInventoryProducts();
  // Color y talla actuales de cada producto, aunque el recordatorio se haya guardado sin ellos.
  const shown = useMemo(() => reminders.map(reminder => ({ ...reminder, products: withProductDetails(reminder.products, inventory) })), [reminders, inventory]);
  const repaired = useRef(new Set<string>());
  useEffect(() => {
    // Los pendientes de avisar se guardan con color y talla para que la plantilla automática también los lleve.
    for (const reminder of reminders) {
      if (reminder.status !== "scheduled" || reminder.notifiedAt || repaired.current.has(reminder.id)) continue;
      const products = withProductDetails(reminder.products, inventory);
      if (!productsChanged(reminder.products, products)) continue;
      repaired.current.add(reminder.id);
      void request(`/reminders/${reminder.id}/products`, { method: "PATCH", body: JSON.stringify({ products }) }).catch(() => { /* Se reintenta la próxima vez que abras la sección. */ });
    }
  }, [reminders, inventory]);
  const load = useCallback(async () => {
    if (view === "sales") { setSalesKey(value => value + 1); return; }
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
      <div><p>WHATSAPP</p><h1>Recordatorios</h1><span>Guarda a quién debes escribirle, qué quiere comprar y cuándo. Elige si te llega el enlace al chat interno «Recordatorios» o si se le envía una plantilla de WhatsApp automáticamente. Cada recordatorio crea una venta pendiente de pago.</span></div>
      <button type="button" className="primary-action" onClick={() => setCreating(true)}>＋ Nuevo recordatorio</button>
    </header>
    <div className="deliveries-toolbar">
      <div className="deliveries-filters" role="tablist" aria-label="Recordatorios">{VIEWS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? "selected" : ""} onClick={() => setView(value)}>{label}</button>)}</div>
      {view === "upcoming" && due > 0 && <span className="deliveries-stats">{due} ya {due === 1 ? "avisado" : "avisados"}, sin marcar como {due === 1 ? "hecho" : "hechos"}</span>}
    </div>
    {view === "sales" ? <PendingSalesList key={salesKey} /> : <>
      {error && <p className="delivery-error" role="alert">{error} <button type="button" className="delivery-link" onClick={() => void load()}>Reintentar</button></p>}
      {loading && !reminders.length ? <p className="deliveries-empty">Cargando recordatorios…</p>
        : reminders.length === 0 ? <div className="deliveries-empty"><b>{view === "done" ? "Aún no hay recordatorios hechos o cancelados." : "No hay recordatorios pendientes."}</b><span>Crea uno con «Nuevo recordatorio».</span></div>
          : groupRemindersByDay(shown).map(group => <section key={group.key} className="delivery-day"><h3>{group.label}</h3>
            {group.items.map(reminder => <ReminderCard key={reminder.id} reminder={reminder} onChanged={() => void load()} actions={<>
              {reminder.status === "scheduled" && <ReminderLinks contactName={reminder.contactName} phone={reminder.phone} products={reminder.products} />}
              {reminder.conversationId && <a className="delivery-action" href={conversationHref(reminder.conversationId)} onClick={event => { event.preventDefault(); openConversation(reminder.conversationId as string); }}>💬 Abrir chat</a>}
              {reminder.status === "scheduled" ? <button type="button" className="delivery-action" onClick={() => setPending({ kind: "done", reminder })}>✓ Hecho</button>
                : reminder.saleStatus !== "paid" && reminder.saleStatus !== "cancelled" && <button type="button" className="delivery-action" onClick={() => void reopen(reminder)}>Reabrir</button>}
              {reminder.status !== "cancelled" && <button type="button" className="delivery-action" onClick={() => setEditing(reminder)}>Editar</button>}
              <button type="button" className="delivery-action danger" onClick={() => setPending({ kind: "delete", reminder })}>Eliminar</button>
            </>} />)}
          </section>)}
    </>}
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
      {pending && <p>{pending.reminder.contactName} · {new Date(pending.reminder.remindAt).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{pending.kind === "delete" ? `. Se borra por completo${pending.reminder.saleStatus === "open" ? " junto con su venta pendiente" : ""}; los avisos que ya llegaron al chat se conservan.` : ". Su venta pendiente sigue abierta hasta que la cobres o la cierres."}</p>}
    </ConfirmDialog>
  </section>;
}
