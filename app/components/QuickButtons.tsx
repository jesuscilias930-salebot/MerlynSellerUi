"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../lib/api";
import type { EntrepreneurPackage } from "../lib/types";

export type QuickButtonsConfig = { invitation: { label: string; text: string } | null; imageButtons: { label: string; packageId: string }[] };
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
export function QuickButtonsRow({ chatId, store, imageSets, onSendSet, onNotice }: { chatId: string; store: Store; imageSets: EntrepreneurPackage[]; onSendSet: (packageId: string) => Promise<void>; onNotice: (text: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { invitation, imageButtons } = store.config;
  const buttons = imageButtons.map((button, index) => ({ ...button, key: `set-${index}`, set: imageSets.find(item => item.id === button.packageId) })).filter(button => button.set && button.set.images.length > 0);
  if (!invitation && !buttons.length) return null;
  const run = async (key: string, action: () => Promise<unknown>, sent: string) => {
    if (busy) return;
    setBusy(key);
    try { await action(); setDone(key); onNotice(sent); window.setTimeout(() => setDone(current => current === key ? null : current), 2500); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : "No se pudo enviar."); }
    finally { setBusy(null); }
  };
  const label = (key: string, text: string) => busy === key ? "Enviando…" : done === key ? "✓ Enviado" : text;
  return <>
    {invitation && <button type="button" className="quick-button invitation" disabled={Boolean(busy)} title={invitation.text} onClick={() => void run("invitation", () => request(`/conversations/${chatId}/messages/invitation`, { method: "POST" }), `Invitación «${invitation.label}» enviada.`)}>{label("invitation", `👥 ${invitation.label}`)}</button>}
    {buttons.map(button => <button key={button.key} type="button" className="quick-button" disabled={Boolean(busy)} title={`Envía las ${button.set!.images.length} fotos de «${button.set!.name}»`} onClick={() => void run(button.key, () => onSendSet(button.packageId), `Se enviaron las fotos de «${button.set!.name}».`)}>{label(button.key, `▦ ${button.label}`)} {busy !== button.key && done !== button.key && <small>{button.set!.images.length}</small>}</button>)}
  </>;
}

/** Herramientas → Botones rápidos: invitación con enlace y 5 botones de conjuntos de imágenes. */
export function QuickButtonsSettings({ store, imageSets }: { store: Store; imageSets: EntrepreneurPackage[] }) {
  const [draft, setDraft] = useState<QuickButtonsConfig | null>(null);
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
      invitation: value.invitation && (value.invitation.label.trim() || value.invitation.text.trim()) ? { label: value.invitation.label.trim(), text: value.invitation.text.trim() } : null,
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
      <small>Por ejemplo, la invitación a tu grupo de WhatsApp: el cliente ve la tarjeta del grupo con «Unirse».</small>
      <input value={value.invitation?.label || ""} maxLength={24} placeholder="Nombre del botón, p. ej. Grupo VIP" onChange={event => update({ ...value, invitation: { label: event.target.value, text: value.invitation?.text || "" } })} />
      <textarea rows={3} maxLength={4096} value={value.invitation?.text || ""} placeholder={"Mensaje con el enlace, p. ej.\n¡Únete a nuestro grupo de ofertas! https://chat.whatsapp.com/…"} onChange={event => update({ ...value, invitation: { label: value.invitation?.label || "", text: event.target.value } })} />
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
