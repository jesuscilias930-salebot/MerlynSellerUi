"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, request } from "../lib/api";
import { CHAT_AD_LABEL_MAX, CHAT_AD_MAX_BUTTONS, CHAT_AD_MAX_IMAGES, chatAdDraft, chatAdPayload, emptyChatAdButton, type ChatAd, type ChatAdButtonDraft, type ChatAdDraft } from "../lib/chat-ads";
import type { EntrepreneurPackage } from "../lib/types";
import styles from "./ChatAdsPanel.module.css";

const imageUrl = (id: string) => `${api}/settings/entrepreneur-packages/images/${id}/media`;

/** Sección chatAd: frases del primer mensaje (como en escenarios) → botones de imágenes en el chat. */
export function ChatAdsPanel({ imageSets }: { imageSets: EntrepreneurPackage[] }) {
  const [ads, setAds] = useState<ChatAd[] | null>(null);
  const [draft, setDraft] = useState<ChatAdDraft | null>(null);
  const [pickFor, setPickFor] = useState<{ button: number; setId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [probe, setProbe] = useState("");
  const [probeResult, setProbeResult] = useState("");

  const load = useCallback(async () => {
    try { setAds(await request<ChatAd[]>("/chat-ads")); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los chatAd."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const sets = useMemo(() => imageSets.filter(set => set.images.length > 0), [imageSets]);
  const images = useMemo(() => new Map(imageSets.flatMap(set => set.images.map(image => [image.id, { ...image, setName: set.name }] as const))), [imageSets]);

  const open = (ad?: ChatAd) => { setDraft(chatAdDraft(ad)); setPickFor(null); setError(""); setNotice(""); };
  const updateButton = (index: number, patch: Partial<ChatAdButtonDraft>) =>
    setDraft(current => current && { ...current, buttons: current.buttons.map((button, position) => position === index ? { ...button, ...patch } : button) });
  const toggleImage = (index: number, imageId: string) => {
    if (!draft) return;
    const button = draft.buttons[index];
    const selected = button.imageIds.includes(imageId);
    if (!selected && button.imageIds.length >= CHAT_AD_MAX_IMAGES) { setError(`Cada botón puede llevar hasta ${CHAT_AD_MAX_IMAGES} imágenes.`); return; }
    setError("");
    const imageIds = selected ? button.imageIds.filter(id => id !== imageId) : [...button.imageIds, imageId];
    // Al elegir fotos de un conjunto, el botón toma su nombre si aún no tiene.
    const label = !selected && !button.label.trim() && pickFor ? (sets.find(set => set.id === pickFor.setId)?.name || "").slice(0, CHAT_AD_LABEL_MAX) : button.label;
    updateButton(index, { imageIds, label });
  };

  const save = async () => {
    if (!draft) return;
    // Las fotos que ya no existen en Imágenes guardadas se omiten (si los conjuntos ya cargaron).
    const result = chatAdPayload(images.size ? { ...draft, buttons: draft.buttons.map(button => ({ ...button, imageIds: button.imageIds.filter(id => images.has(id)) })) } : draft);
    if ("error" in result) { setError(result.error); return; }
    setSaving(true); setError("");
    try {
      await request<ChatAd>(draft.id ? `/chat-ads/${draft.id}` : "/chat-ads", { method: draft.id ? "PUT" : "POST", body: JSON.stringify(result.payload) });
      await load(); setDraft(null); setNotice(`chatAd «${result.payload.name}» guardado.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  };
  const remove = async (ad: ChatAd) => {
    if (!window.confirm(`¿Eliminar el chatAd «${ad.name}»? Sus botones dejarán de aparecer en los chats.`)) return;
    try { await request(`/chat-ads/${ad.id}`, { method: "DELETE" }); await load(); if (draft?.id === ad.id) setDraft(null); setNotice(`chatAd «${ad.name}» eliminado.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar."); }
  };
  const toggleActive = async (ad: ChatAd) => {
    try { await request(`/chat-ads/${ad.id}`, { method: "PUT", body: JSON.stringify({ name: ad.name, isActive: !ad.isActive, triggerExamples: ad.triggerExamples, buttons: ad.buttons }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar."); }
  };
  const test = async () => {
    if (!probe.trim()) return;
    try {
      const { chatAd } = await request<{ chatAd: { name: string } | null }>("/chat-ads/test", { method: "POST", body: JSON.stringify({ text: probe }) });
      setProbeResult(chatAd ? `✓ Mostraría los botones de «${chatAd.name}».` : "Ningún chatAd activo coincide con ese mensaje.");
    } catch (reason) { setProbeResult(reason instanceof Error ? reason.message : "No se pudo probar."); }
  };

  return <section className={`quick-replies-panel ${styles.panel}`}>
    <header><div><p>CHATAD</p><h2>Botones según el primer mensaje</h2><span>Cuando el primer mensaje del cliente coincide con las frases de un chatAd (p. ej. el texto prellenado de tu anuncio), su chat muestra estos botones debajo del cuadro de texto. Un clic envía las imágenes elegidas con su texto.</span></div>
      {!draft && <button type="button" className="primary-action" onClick={() => open()}>＋ Nuevo chatAd</button>}</header>
    {notice && <div className="control-notice" role="status">{notice}</div>}

    {draft && <div className={styles.editor}>
      <div className={styles.row}>
        <label className={styles.grow}>Nombre<input value={draft.name} maxLength={80} placeholder="p. ej. Anuncio Paquete Emprendedor" onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })} /> Activo</label>
      </div>
      <label>Frases que lo inician <small>una por línea · igual que en escenarios: no importan acentos ni mayúsculas</small>
        <textarea rows={4} value={draft.triggers} placeholder={"¡Hola! Quiero más información del Paquete Emprendedor\nHola, vi su anuncio de calcetines"} onChange={event => setDraft({ ...draft, triggers: event.target.value })} />
      </label>
      {draft.buttons.map((button, index) => {
        const chosen = button.imageIds.map(id => images.get(id)).filter(Boolean) as { id: string; filename: string | null; setName: string }[];
        const missing = button.imageIds.length - chosen.length;
        return <fieldset key={index} className={styles.button}>
          <legend>Botón {index + 1}</legend>
          <input value={button.label} maxLength={CHAT_AD_LABEL_MAX} placeholder="Nombre del botón, p. ej. Modelos" onChange={event => updateButton(index, { label: event.target.value })} />
          <textarea rows={2} maxLength={1024} value={button.text} placeholder="Texto opcional (va como pie de la primera imagen)" onChange={event => updateButton(index, { text: event.target.value })} />
          <select value={pickFor?.button === index ? pickFor.setId : ""} aria-label={`Agregar fotos al botón ${index + 1}`} onChange={event => setPickFor(event.target.value ? { button: index, setId: event.target.value } : null)}>
            <option value="">📷 Elegir fotos de un conjunto ({button.imageIds.length}/{CHAT_AD_MAX_IMAGES})…</option>
            {sets.map(set => <option key={set.id} value={set.id}>{set.name} · {set.images.length}</option>)}
          </select>
          {chosen.length > 0 && <div className="quick-reply-image-grid">{chosen.map(image => <button key={image.id} type="button" className="selected" title="Quitar" onClick={() => toggleImage(index, image.id)}><img src={imageUrl(image.id)} alt={image.filename || image.setName} loading="lazy" /><span>×</span></button>)}</div>}
          {missing > 0 && <small className={styles.warn}>{missing} imagen{missing === 1 ? " ya no existe" : "es ya no existen"} en Imágenes guardadas; se omitirá{missing === 1 ? "" : "n"} al guardar.</small>}
          {pickFor?.button === index && <div className="quick-reply-image-grid">{sets.find(set => set.id === pickFor.setId)?.images.map(image => { const selected = button.imageIds.includes(image.id); return <button key={image.id} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleImage(index, image.id)}><img src={imageUrl(image.id)} alt={image.filename || "Imagen"} loading="lazy" /><span>✓</span></button>; })}</div>}
          {draft.buttons.length > 1 && <button type="button" className="plain-button" onClick={() => { setDraft({ ...draft, buttons: draft.buttons.filter((_, position) => position !== index) }); setPickFor(null); }}>Quitar botón</button>}
        </fieldset>;
      })}
      {draft.buttons.length < CHAT_AD_MAX_BUTTONS && <button type="button" className="plain-button" onClick={() => setDraft({ ...draft, buttons: [...draft.buttons, emptyChatAdButton()] })}>＋ Agregar botón</button>}
      {error && <p className="scenario-save-error" role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="plain-button" disabled={saving} onClick={() => { setDraft(null); setError(""); }}>Cancelar</button>
        <button type="button" className="primary-action" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar chatAd"}</button>
      </div>
    </div>}

    {!draft && error && <p className="scenario-save-error" role="alert">{error}</p>}
    {ads === null && !error && <p>Cargando…</p>}
    {ads?.length === 0 && !draft && <p className={styles.empty}>Aún no tienes chatAd. Crea uno con las frases con las que llegan los clientes de tu anuncio.</p>}
    {ads && ads.length > 0 && <div className={styles.list}>{ads.map(ad => <article key={ad.id} className={ad.isActive ? "" : styles.paused}>
      <div><b>{ad.name}</b>{!ad.isActive && <small> · en pausa</small>}
        <small className={styles.phrases}>«{ad.triggerExamples[0]}»{ad.triggerExamples.length > 1 ? ` y ${ad.triggerExamples.length - 1} frase${ad.triggerExamples.length === 2 ? "" : "s"} más` : ""}</small>
        <span className={styles.chips}>{ad.buttons.map((button, index) => <span key={index}>📣 {button.label} · {button.imageIds.length} foto{button.imageIds.length === 1 ? "" : "s"}</span>)}</span>
      </div>
      <div className={styles.cardActions}>
        <button type="button" className="plain-button" onClick={() => void toggleActive(ad)}>{ad.isActive ? "Pausar" : "Activar"}</button>
        <button type="button" className="plain-button" onClick={() => open(ad)}>Editar</button>
        <button type="button" className="danger-link" onClick={() => void remove(ad)}>Eliminar</button>
      </div>
    </article>)}</div>}

    <div className={styles.probe}>
      <label>Probar un primer mensaje<input value={probe} maxLength={1000} placeholder="Pega el mensaje con el que llegó un cliente" onChange={event => { setProbe(event.target.value); setProbeResult(""); }} onKeyDown={event => { if (event.key === "Enter") void test(); }} /></label>
      <button type="button" className="plain-button" disabled={!probe.trim()} onClick={() => void test()}>Probar</button>
      {probeResult && <small role="status">{probeResult}</small>}
    </div>
  </section>;
}
