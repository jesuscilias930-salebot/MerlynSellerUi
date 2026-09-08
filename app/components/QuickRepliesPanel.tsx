"use client";

import { FormEvent, useState } from "react";
import type { CtaUrlTemplate, QuickReply } from "../lib/types";

type Draft = Omit<QuickReply, "id" | "created_at" | "updated_at">;
const empty = (): Draft => ({ shortcut: "/", name: "", body: "", kind: "text", ctaUrlTemplateId: null });

export function QuickRepliesPanel({ replies, ctaTemplates, onSave, onDelete }: { replies: QuickReply[]; ctaTemplates: CtaUrlTemplate[]; onSave: (value: Draft, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedCta = ctaTemplates.find((template) => template.id === draft.ctaUrlTemplateId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    try { await onSave(draft, editingId || undefined); setDraft(empty()); setEditingId(null); setNotice("Respuesta rápida guardada."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar la respuesta rápida."); }
    finally { setSaving(false); }
  };
  const edit = (reply: QuickReply) => { setEditingId(reply.id); setDraft({ shortcut: reply.shortcut, name: reply.name, body: reply.body, kind: reply.kind || "text", ctaUrlTemplateId: reply.ctaUrlTemplateId || null }); setNotice(""); };
  const setKind = (kind: Draft["kind"]) => setDraft(current => ({ ...current, kind, ctaUrlTemplateId: kind === "text" ? null : current.ctaUrlTemplateId, body: kind === "text" ? current.body : selectedCta?.body || current.body }));
  const chooseCtaTemplate = (ctaUrlTemplateId: string) => {
    const template = ctaTemplates.find((item) => item.id === ctaUrlTemplateId);
    setDraft(current => ({ ...current, ctaUrlTemplateId: ctaUrlTemplateId || null, body: template?.body || current.body }));
  };
  return <section className="quick-replies-panel">
    <header><div><p>RESPUESTAS RÁPIDAS</p><h2>Atajos del chat</h2><span>Escribe <b>/</b> en una conversación para buscar un texto o enviar una invitación con botón.</span></div>{editingId && <button className="plain-button" type="button" onClick={() => { setEditingId(null); setDraft(empty()); }}>Cancelar edición</button>}</header>
    {notice && <div className="control-notice">{notice}</div>}
    <form onSubmit={submit}>
      <input value={draft.shortcut} onChange={(event) => setDraft({ ...draft, shortcut: event.target.value.toLowerCase().replace(/[^a-z0-9_/]/g, "") })} placeholder="/grupo" required pattern="/[a-z0-9_]+" title="Usa / seguido de letras, números o guion bajo" />
      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre, ej. Invitación grupo VIP" required maxLength={80} />
      <label className="quick-reply-kind">Tipo de respuesta<select value={draft.kind} onChange={(event) => setKind(event.target.value as Draft["kind"])}><option value="text">Mensaje de texto</option><option value="cta_url">Invitación con botón</option></select></label>
      {draft.kind === "text" ? <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Mensaje que se insertará en el chat" required maxLength={4096} /> : <><label className="quick-reply-kind">Invitación guardada<select value={draft.ctaUrlTemplateId || ""} onChange={(event) => chooseCtaTemplate(event.target.value)} required><option value="">Selecciona una invitación</option>{ctaTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>{selectedCta ? <div className="quick-reply-cta-preview"><b>{selectedCta.buttonText}</b><span>{selectedCta.body}</span></div> : <p className="quick-reply-cta-empty">Primero crea una invitación en “Invitaciones con botón”.</p>}</>}
      <button disabled={saving || (draft.kind === "cta_url" && !draft.ctaUrlTemplateId)}>{saving ? "Guardando…" : editingId ? "Actualizar atajo" : "Guardar atajo"}</button>
    </form>
    <div className="quick-replies-table"><header><b>Atajo</b><b>Nombre</b><b>Contenido</b><span /></header>{replies.length === 0 && <p>Aún no tienes respuestas rápidas.</p>}{replies.map((reply) => <article key={reply.id}><code>{reply.shortcut}</code><strong>{reply.name}</strong><span>{reply.kind === "cta_url" ? "↗ Invitación con botón" : reply.body}</span><div><button className="plain-button" type="button" onClick={() => edit(reply)}>Editar</button><button className="danger-link" type="button" onClick={() => void onDelete(reply.id)}>Eliminar</button></div></article>)}</div>
  </section>;
}
