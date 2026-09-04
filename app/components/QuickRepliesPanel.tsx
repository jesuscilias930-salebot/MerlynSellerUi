"use client";

import { FormEvent, useState } from "react";
import type { QuickReply } from "../lib/types";

type Draft = Omit<QuickReply, "id" | "created_at" | "updated_at">;
const empty = (): Draft => ({ shortcut: "/", name: "", body: "" });

export function QuickRepliesPanel({ replies, onSave, onDelete }: { replies: QuickReply[]; onSave: (value: Draft, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    try { await onSave(draft, editingId || undefined); setDraft(empty()); setEditingId(null); setNotice("Respuesta rápida guardada."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar la respuesta rápida."); }
    finally { setSaving(false); }
  };
  const edit = (reply: QuickReply) => { setEditingId(reply.id); setDraft({ shortcut: reply.shortcut, name: reply.name, body: reply.body }); setNotice(""); };
  return <section className="quick-replies-panel">
    <header><div><p>RESPUESTAS RÁPIDAS</p><h2>Atajos del chat</h2><span>Escribe <b>/</b> en una conversación para buscar y usar una respuesta guardada.</span></div>{editingId && <button className="plain-button" type="button" onClick={() => { setEditingId(null); setDraft(empty()); }}>Cancelar edición</button>}</header>
    {notice && <div className="control-notice">{notice}</div>}
    <form onSubmit={submit}>
      <input value={draft.shortcut} onChange={(event) => setDraft({ ...draft, shortcut: event.target.value.toLowerCase().replace(/[^a-z0-9_/]/g, "") })} placeholder="/pago" required pattern="/[a-z0-9_]+" title="Usa / seguido de letras, números o guion bajo" />
      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre, ej. Datos de pago" required maxLength={80} />
      <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Mensaje que se insertará en el chat" required maxLength={4096} />
      <button disabled={saving}>{saving ? "Guardando…" : editingId ? "Actualizar atajo" : "Guardar atajo"}</button>
    </form>
    <div className="quick-replies-table"><header><b>Atajo</b><b>Nombre</b><b>Mensaje</b><span /></header>{replies.length === 0 && <p>Aún no tienes respuestas rápidas.</p>}{replies.map((reply) => <article key={reply.id}><code>{reply.shortcut}</code><strong>{reply.name}</strong><span>{reply.body}</span><div><button className="plain-button" type="button" onClick={() => edit(reply)}>Editar</button><button className="danger-link" type="button" onClick={() => void onDelete(reply.id)}>Eliminar</button></div></article>)}</div>
  </section>;
}
