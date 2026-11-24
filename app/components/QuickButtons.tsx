"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../lib/api";
import type { CtaUrlTemplate, EntrepreneurPackage } from "../lib/types";

export type QuickButtonsConfig = { invitation: { label: string; text?: string; ctaUrlTemplateId?: string } | null; imageButtons: { label: string; packageId: string }[] };
const EMPTY: QuickButtonsConfig = { invitation: null, imageButtons: [] };
export const QUICK_IMAGE_SLOTS = 5;

let cached: Promise<QuickButtonsConfig> | null = null;
const load = (fresh = false) => {
  if (!cached || fresh) cached = request<QuickButtonsConfig>("/settings/chat-quick-buttons").catch(error => { cached = null; throw error; });
  return cached;
};

export function useQuickButtons() {
  const [config, setConfig] = useState<QuickButtonsConfig>(EMPTY);
  const [error, setError] = useState("");
  const reload = useCallback(async (fresh = false) => {
    try { setConfig(await load(fresh)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los botones rápidos."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);
  const replace = (next: QuickButtonsConfig) => { cached = Promise.resolve(next); setConfig(next); };
  return { config, error, reload, replace };
}
type Store = ReturnType<typeof useQuickButtons>;

/** Fila debajo del cuadro de texto: un clic envía (sin confirmación); el botón se bloquea mientras sale para no duplicar. */
export function QuickButtonsRow({ chatId, store, imageSets, onSendSet, onNotice, onConfigure }: { chatId: string; store: Store; imageSets: EntrepreneurPackage[]; onSendSet: (packageId: string) => Promise<void>; onNotice: (text: string) => void; onConfigure?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { invitation, imageButtons } = store.config;
  const buttons = imageButtons.map((button, index) => ({ ...button, key: `set-${index}`, set: imageSets.find(item => item.id === button.packageId) })).filter(button => button.set && button.set.images.length > 0);
  // Sin configurar: el botón se ve igual y lleva a «⚡ Botones rápidos» para darlo de alta.
  if (!invitation && !buttons.length) return onConfigure ? <button type="button" className="quick-button invitation unconfigured" title="Configura el enlace de tu grupo en Botones rápidos" onClick={onConfigure}>👥 Invitar al grupo <small>configurar</small></button> : null;
  const run = async (key: string, action: () => Promise<unknown>, sent: string) => {
    if (busy) return;
    setBusy(key);
    try { await action(); setDone(key); onNotice(sent); window.setTimeout(() => setDone(current => current === key ? null : current), 2500); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : "No se pudo enviar."); }
    finally { setBusy(null); }
  };
  const label = (key: string, text: string) => busy === key ? "Enviando…" : done === key ? "✓ Enviado" : text;
  return <>
    {!invitation && onConfigure && <button type="button" className="quick-button invitation unconfigured" title="Configura el enlace de tu grupo en Botones rápidos" onClick={onConfigure}>👥 Invitar al grupo <small>configurar</small></button>}
    {invitation && <button type="button" className="quick-button invitation" disabled={Boolean(busy)} title={invitation.text || "Invitación con botón"} onClick={() => void run("invitation", () => request(`/conversations/${chatId}/messages/invitation`, { method: "POST" }), `Invitación «${invitation.label}» enviada.`)}>{label("invitation", `👥 ${invitation.label}`)}</button>}
    {buttons.map(button => <button key={button.key} type="button" className="quick-button" disabled={Boolean(busy)} title={`Envía las ${button.set!.images.length} fotos de «${button.set!.name}»`} onClick={() => void run(button.key, () => onSendSet(button.packageId), `Se enviaron las fotos de «${button.set!.name}».`)}>{label(button.key, `▦ ${button.label}`)} {busy !== button.key && done !== button.key && <small>{button.set!.images.length}</small>}</button>)}
  </>;
}

/** Herramientas → Botones rápidos: invitación con enlace y 5 botones de conjuntos de imágenes. */
export function QuickButtonsSettings({ store, imageSets }: { store: Store; imageSets: EntrepreneurPackage[] }) {
  const [draft, setDraft] = useState<QuickButtonsConfig | null>(null);
  // «Invitaciones con botón» ya guardadas (sección Invitaciones con botón).
  const [ctaTemplates, setCtaTemplates] = useState<CtaUrlTemplate[]>([]);
  useEffect(() => { let active = true; request<CtaUrlTemplate[]>("/settings/cta-url-templates").then(items => { if (active) setCtaTemplates(items); }).catch(() => {}); return () => { active = false; }; }, []);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const value = draft || store.config;
  const slots = Array.from({ length: QUICK_IMAGE_SLOTS }, (_, index) => value.imageButtons[index] || { label: "", packageId: "" });
  const sets = imageSets.filter(item => item.controlBundleId == null && item.images.length > 0);
  const update = (next: QuickButtonsConfig) => { setDraft(next); setNotice(""); };
  const setSlot = (index: number, patch: Partial<{ label: string; packageId: string }>) => {
    const next = slots.map((slot, position) => position === index ? { ...slot, ...patch } : slot);
    update({ ...value, imageButtons: next });
  };
  const chooseSet = (index: number, packageId: string) => {
    const set = sets.find(item => item.id === packageId);
    setSlot(index, { packageId, ...(set && !slots[index].label ? { label: set.name.slice(0, 24) } : {}) });
  };
  const save = async () => {
    const config: QuickButtonsConfig = {
      invitation: value.invitation && (value.invitation.label.trim() || value.invitation.text?.trim() || value.invitation.ctaUrlTemplateId)
        ? value.invitation.ctaUrlTemplateId
          ? { label: (value.invitation.label.trim() || ctaTemplates.find(item => item.id === value.invitation?.ctaUrlTemplateId)?.name || "Invitación").slice(0, 24), ctaUrlTemplateId: value.invitation.ctaUrlTemplateId }
          : { label: value.invitation.label.trim(), text: (value.invitation.text || "").trim() }
        : null,
      imageButtons: slots.filter(slot => slot.packageId).map(slot => ({ label: (slot.label.trim() || sets.find(item => item.id === slot.packageId)?.name || "Fotos").slice(0, 24), packageId: slot.packageId })),
    };
    setSaving(true); setNotice("");
    try { store.replace(await request<QuickButtonsConfig>("/settings/chat-quick-buttons", { method: "PUT", body: JSON.stringify(config) })); setDraft(null); setNotice("Botones rápidos guardados."); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudieron guardar."); }
    finally { setSaving(false); }
  };
  return <div className="quick-buttons-settings">
    {store.error && <p className="tool-notice">{store.error}</p>}
    <fieldset>
      <legend>👥 Invitación con enlace</legend>
      <small>Elige una de tus «Invitaciones con botón» o escribe un mensaje con el enlace (el cliente ve la tarjeta del grupo con «Unirse»).</small>
      <select aria-label="Invitación guardada" value={value.invitation?.ctaUrlTemplateId || ""} onChange={event => { const template = ctaTemplates.find(item => item.id === event.target.value); update({ ...value, invitation: event.target.value ? { label: value.invitation?.label || template?.name.slice(0, 24) || "", ctaUrlTemplateId: event.target.value } : { label: value.invitation?.label || "", text: value.invitation?.text || "" } }); }}>
        <option value="">✏️ Escribir mensaje con enlace</option>
        {ctaTemplates.map(template => <option key={template.id} value={template.id}>↗ {template.name} · botón «{template.buttonText}»</option>)}
      </select>
      <input value={value.invitation?.label || ""} maxLength={24} placeholder="Nombre del botón, p. ej. Grupo VIP" onChange={event => update({ ...value, invitation: { ...(value.invitation || {}), label: event.target.value } })} />
      {value.invitation?.ctaUrlTemplateId
        ? (() => { const template = ctaTemplates.find(item => item.id === value.invitation?.ctaUrlTemplateId); return template ? <div className="quick-reply-cta-preview"><b>{template.buttonText}</b><span>{template.body}</span></div> : <small>Cargando invitación…</small>; })()
        : <textarea rows={3} maxLength={4096} value={value.invitation?.text || ""} placeholder={"Mensaje con el enlace, p. ej.\n¡Únete a nuestro grupo de ofertas! https://chat.whatsapp.com/…"} onChange={event => update({ ...value, invitation: { label: value.invitation?.label || "", text: event.target.value } })} />}
      {value.invitation && <button type="button" className="plain-button" onClick={() => update({ ...value, invitation: null })}>Quitar invitación</button>}
    </fieldset>
    <fieldset>
      <legend>▦ Botones de imágenes (hasta {QUICK_IMAGE_SLOTS})</legend>
      <small>Cada botón envía todas las fotos de un conjunto con un solo clic.</small>
      {slots.map((slot, index) => <div key={index} className="quick-button-slot">
        <span>{index + 1}</span>
        <select aria-label={`Conjunto del botón ${index + 1}`} value={slot.packageId} onChange={event => chooseSet(index, event.target.value)}>
          <option value="">Sin asignar</option>
          {sets.map(set => <option key={set.id} value={set.id}>{set.name} · {set.images.length} foto{set.images.length === 1 ? "" : "s"}</option>)}
        </select>
        <input aria-label={`Nombre del botón ${index + 1}`} value={slot.label} maxLength={24} placeholder="Nombre corto" disabled={!slot.packageId} onChange={event => setSlot(index, { label: event.target.value })} />
      </div>)}
    </fieldset>
    <button type="button" className="tool-primary-button" disabled={saving || !draft} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar botones"}</button>
    {notice && <p className="tool-notice" role="status">{notice}</p>}
  </div>;
}
