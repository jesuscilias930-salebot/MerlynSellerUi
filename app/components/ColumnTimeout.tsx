"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { timeoutDraft, timeoutMinutes, timeoutSummary, type ColumnTimeout as Timeout, type WaitUnit } from "../lib/follow-ups";
import type { LeadBoardSummary, LeadColumn } from "../lib/types";

// Lista compartida por todas las columnas del tablero.
let cached: Promise<Timeout[]> | null = null;
const listeners = new Set<(items: Timeout[]) => void>();
const load = (fresh = false) => {
  if (!cached || fresh) cached = request<Timeout[]>("/column-timeouts").catch(error => { cached = null; throw error; });
  return cached;
};
const publish = (items: Timeout[]) => { cached = Promise.resolve(items); listeners.forEach(listener => listener(items)); };

function useColumnTimeouts() {
  const [items, setItems] = useState<Timeout[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    void load().then(setItems).catch(() => {});
    return () => { listeners.delete(setItems); };
  }, []);
  return items;
}

/** Botón ⏳ de cada columna: si el cliente no responde a nuestro último mensaje, mover a otra columna (sin enviar nada). */
export function ColumnTimeout({ column, columns, boards = [], onSaved }: { column: Pick<LeadColumn, "id" | "name">; columns: Pick<LeadColumn, "id" | "name">[]; boards?: LeadBoardSummary[]; onSaved?: (notice: string) => void }) {
  const timeouts = useColumnTimeouts();
  const current = timeouts.find(item => item.columnId === column.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(timeoutDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Destinos: columnas de todos los dashboards (agrupadas) o, si no hay lista, las del tablero abierto.
  const groups = boards.length
    ? boards.map(board => ({ label: board.name, columns: board.columns.filter(item => item.id !== column.id).map(item => ({ id: item.id, name: item.name })) })).filter(group => group.columns.length)
    : [{ label: "", columns: columns.filter(item => item.id !== column.id) }];
  const allColumns = groups.flatMap(group => group.columns.map(item => ({ ...item, label: boards.length > 1 ? `${item.name} · ${group.label}` : item.name })));
  const columnName = (id: string) => allColumns.find(item => item.id === id)?.label;

  const start = () => { setDraft(timeoutDraft(current)); setError(""); setOpen(true); };
  const save = async () => {
    const wait = timeoutMinutes(draft.waitValue, draft.waitUnit);
    if ("error" in wait) { setError(wait.error); return; }
    if (!draft.targetColumnId) { setError("Elige la columna a la que se moverá."); return; }
    setSaving(true); setError("");
    try {
      const saved = await request<Timeout>(`/column-timeouts/columns/${column.id}`, { method: "PUT", body: JSON.stringify({ isActive: draft.isActive, waitMinutes: wait.minutes, targetColumnId: draft.targetColumnId }) });
      const items = await load(true).catch(() => [] as Timeout[]);
      publish(items.some(item => item.id === saved.id) ? items : [...items, saved]);
      setOpen(false);
      onSaved?.(draft.isActive ? `⏳ Activo en «${column.name}»: ${timeoutSummary(saved, columnName)}. Para los chats que ya están ahí, la espera cuenta desde ahora.` : `⏳ de «${column.name}» guardado en pausa.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm(`¿Quitar el movimiento automático de «${column.name}»?`)) return;
    setSaving(true);
    try { await request(`/column-timeouts/columns/${column.id}`, { method: "DELETE" }); publish((await load(true).catch(() => [])).filter(item => item.columnId !== column.id)); setOpen(false); onSaved?.(`⏳ de «${column.name}» eliminado.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar."); }
    finally { setSaving(false); }
  };

  if (!open) return <button type="button" className={`column-remarketing-trigger column-timeout-trigger${current?.isActive ? " active" : ""}`} title={current ? `⏳ ${current.isActive ? "Activo" : "En pausa"}: ${timeoutSummary(current, columnName)}` : "Mover a otra columna si no responde"} aria-label={`Movimiento por falta de respuesta de ${column.name}`} onClick={start}>⏳</button>;

  return <div className="confirm-dialog column-remarketing" role="dialog" aria-modal="true" aria-labelledby={`ct-${column.id}`}>
    <button type="button" className="confirm-dialog-backdrop" aria-label="Cerrar" onClick={() => !saving && setOpen(false)} />
    <section className="confirm-dialog-card column-remarketing-card follow-up-card">
      <header><h2 id={`ct-${column.id}`}>⏳ Sin respuesta · {column.name}</h2><p>Si el último mensaje del chat es tuyo y el cliente no responde en este tiempo, el lead se mueve solo a otra columna. <b>No se envía ningún mensaje.</b> Si el cliente contesta, la cuenta vuelve a empezar desde tu siguiente mensaje.</p></header>
      <label className="column-remarketing-check"><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })} /> Activo</label>
      <div className="follow-up-wait">
        <span>Si no responde en</span>
        <input type="number" min={1} value={draft.waitValue} aria-label="Espera" onChange={event => setDraft({ ...draft, waitValue: event.target.value })} />
        <select value={draft.waitUnit} aria-label="Unidad" onChange={event => setDraft({ ...draft, waitUnit: event.target.value as WaitUnit })}><option value="minutes">minutos</option><option value="hours">horas</option><option value="days">días</option></select>
        <small>desde tu último mensaje</small>
      </div>
      <label className="column-remarketing-var">Mover a
        <select value={draft.targetColumnId} onChange={event => setDraft({ ...draft, targetColumnId: event.target.value })}>
          <option value="">Elige una columna…</option>
          {groups.map(group => group.label && boards.length > 1
            ? <optgroup key={group.label} label={group.label}>{group.columns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            : group.columns.map(item => <option key={item.id} value={item.id}>{item.name}</option>))}
        </select>
      </label>
      <p className="column-remarketing-empty">La espera empieza cuando el lead llega a esta columna o cuando tú le escribes (lo que sea más reciente). Si la columna también tiene seguimiento ⏱, pon aquí una espera mayor que la de sus pasos para no moverlo antes de que terminen.</p>
      {error && <p className="scenario-save-error" role="alert">{error}</p>}
      <footer>
        {current && <button type="button" className="danger-link" disabled={saving} onClick={() => void remove()}>Eliminar</button>}
        <button type="button" className="plain-button" disabled={saving} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="primary-action" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : draft.isActive ? "Guardar y activar" : "Guardar en pausa"}</button>
      </footer>
    </section>
  </div>;
}
