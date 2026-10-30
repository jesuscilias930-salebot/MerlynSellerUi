"use client";

import { FormEvent, useState } from "react";
import { request } from "../lib/api";
import { boardSubtitle } from "../lib/lead-boards";
import type { LeadBoardSummary } from "../lib/types";

type Draft = { name: string; product: string; zone: string };
type Props = { boards: LeadBoardSummary[]; activeBoardId: string; canEdit: boolean; onSelect: (id: string) => void; onChanged: (selectId?: string) => Promise<void> };

/** Tabs del multi dashboard: un dashboard por producto y zona. */
export function BoardTabs({ boards, activeBoardId, canEdit, onSelect, onChanged }: Props) {
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = boards.find(board => board.id === activeBoardId);
  const set = (patch: Partial<Draft>) => setEditing(current => current && { ...current, draft: { ...current.draft, ...patch } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !editing.draft.name.trim()) return;
    setBusy(true); setError("");
    try {
      const body = JSON.stringify({ name: editing.draft.name, product: editing.draft.product, zone: editing.draft.zone });
      const saved = await request<LeadBoardSummary>(editing.id ? `/leads/boards/${editing.id}` : "/leads/boards", { method: editing.id ? "PUT" : "POST", body });
      setEditing(null);
      await onChanged(saved.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el dashboard."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!active || active.isDefault) return;
    if (!window.confirm(`¿Eliminar el dashboard «${active.name}»? Sus ${active.leadCount} leads, reglas y escenarios pasan al dashboard principal, a la columna con el mismo nombre.`)) return;
    setBusy(true); setError("");
    try { await request(`/leads/boards/${active.id}`, { method: "DELETE" }); setEditing(null); await onChanged(boards.find(board => board.isDefault)?.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar el dashboard."); }
    finally { setBusy(false); }
  };
  return <div className="board-tabs">
    <nav role="tablist" aria-label="Dashboards">
      {boards.map(board => <button key={board.id} type="button" role="tab" aria-selected={board.id === activeBoardId} className={board.id === activeBoardId ? "selected" : ""} onClick={() => onSelect(board.id)}>
        <span><b>{board.name}</b>{boardSubtitle(board) && <small>{boardSubtitle(board)}</small>}</span>
        <em>{board.leadCount}</em>
        {board.unreadLeads > 0 && <i aria-label={`${board.unreadLeads} con mensajes sin leer`}>{board.unreadLeads > 99 ? "99+" : board.unreadLeads}</i>}
      </button>)}
      {canEdit && <button type="button" className="board-tab-add" onClick={() => { setError(""); setEditing({ draft: { name: "", product: "", zone: "" } }); }}>＋ Dashboard</button>}
      {canEdit && active && <button type="button" className="board-tab-edit" aria-label={`Editar ${active.name}`} title="Editar dashboard" onClick={() => { setError(""); setEditing({ id: active.id, draft: { name: active.name, product: active.product || "", zone: active.zone || "" } }); }}>✎</button>}
    </nav>
    {editing && <form className="board-form" onSubmit={save}>
      <label>Nombre<input autoFocus value={editing.draft.name} maxLength={60} placeholder="Ej. Calcetas Orizaba" onChange={event => set({ name: event.target.value })} /></label>
      <label>Producto<input value={editing.draft.product} maxLength={80} placeholder="Ej. Calcetas mayoreo" onChange={event => set({ product: event.target.value })} /></label>
      <label>Zona<input value={editing.draft.zone} maxLength={80} placeholder="Ej. Orizaba / Veracruz" onChange={event => set({ zone: event.target.value })} /></label>
      <div className="board-form-actions">
        {editing.id && active && !active.isDefault && <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>Eliminar</button>}
        <button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
        <button type="submit" className="primary-action" disabled={busy || !editing.draft.name.trim()}>{busy ? "Guardando…" : editing.id ? "Guardar" : "Crear dashboard"}</button>
      </div>
      {!editing.id && <small>Se crea solo con la columna «Primer contacto»; agrega las demás con «Agregar columna». Para que los chats lleguen solos, crea reglas en WhatsApp → Mover a columna por mensaje y lada.</small>}
      {error && <p role="alert">{error}</p>}
    </form>}
    {!editing && error && <p className="board-error" role="alert">{error}</p>}
  </div>;
}
