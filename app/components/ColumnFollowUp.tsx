"use client";

import { useCallback, useEffect, useState } from "react";
import { api, request } from "../lib/api";
import { MAX_FOLLOW_UP_STEPS, sequenceSummary, splitWait, stepIssues, toMinutes, type FollowUpSequence, type FollowUpStep, type WaitUnit } from "../lib/follow-ups";
import type { EntrepreneurPackage, LeadColumn, WhatsAppTemplate } from "../lib/types";
import { useSavedVideos } from "./SavedVideos";

// Lista compartida por todas las columnas del tablero.
let cached: Promise<FollowUpSequence[]> | null = null;
const listeners = new Set<(items: FollowUpSequence[]) => void>();
const load = (fresh = false) => {
  if (!cached || fresh) cached = request<FollowUpSequence[]>("/follow-ups").catch(error => { cached = null; throw error; });
  return cached;
};
const publish = (items: FollowUpSequence[]) => { cached = Promise.resolve(items); listeners.forEach(listener => listener(items)); };

/** Seguimientos de todas las columnas (lista compartida). */
export function useFollowUps() {
  const [items, setItems] = useState<FollowUpSequence[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    void load().then(setItems).catch(() => {});
    return () => { listeners.delete(setItems); };
  }, []);
  return items;
}

type DraftStep = { waitValue: string; waitUnit: WaitUnit; text: string; imageIds: string[]; videoId: string; templateId: string };
const emptyStep = (waitValue = "1", waitUnit: WaitUnit = "days"): DraftStep => ({ waitValue, waitUnit, text: "", imageIds: [], videoId: "", templateId: "" });
const toDraft = (step: FollowUpStep): DraftStep => { const { value, unit } = splitWait(step.waitMinutes); return { waitValue: String(value), waitUnit: unit, text: step.text || "", imageIds: step.imageIds || [], videoId: step.videoId || "", templateId: step.templateId || "" }; };
const toStep = (step: DraftStep): FollowUpStep => ({ waitMinutes: toMinutes(Number(step.waitValue), step.waitUnit), ...(step.text.trim() ? { text: step.text.trim() } : {}), imageIds: step.imageIds, videoId: step.videoId || null, templateId: step.templateId || null });
const automaticTemplate = (template: WhatsAppTemplate) => template.status === "APPROVED" && !(template.mappings || []).some(mapping => mapping.source === "manual");

/** Botón ⏱ de cada columna: seguimientos automáticos si el cliente deja de responder. */
export function ColumnFollowUp({ column, columns, onSaved }: { column: Pick<LeadColumn, "id" | "name">; columns: Pick<LeadColumn, "id" | "name">[]; onSaved?: (notice: string) => void }) {
  const sequences = useFollowUps();
  const current = sequences.find(item => item.columnId === column.id);
  const [open, setOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [finalColumnId, setFinalColumnId] = useState("");
  const [sets, setSets] = useState<EntrepreneurPackage[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [pickFor, setPickFor] = useState<{ step: number; setId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const videos = useSavedVideos();

  const start = () => {
    setIsActive(current?.isActive ?? true);
    setSteps(current?.steps.length ? current.steps.map(toDraft) : [emptyStep("2", "hours")]);
    setFinalColumnId(current?.finalColumnId || "");
    setError(""); setPickFor(null); setOpen(true);
  };
  const loadResources = useCallback(async () => {
    const [nextSets, nextTemplates] = await Promise.all([
      request<EntrepreneurPackage[]>("/settings/entrepreneur-packages").catch(() => [] as EntrepreneurPackage[]),
      request<WhatsAppTemplate[]>("/whatsapp-templates").catch(() => [] as WhatsAppTemplate[]),
    ]);
    setSets(nextSets.filter(set => set.controlBundleId == null && set.images.length > 0));
    setTemplates(nextTemplates);
  }, []);
  useEffect(() => { if (open) void Promise.resolve().then(loadResources); }, [open, loadResources]);

  const update = (index: number, patch: Partial<DraftStep>) => setSteps(current => current.map((step, position) => position === index ? { ...step, ...patch } : step));
  const toggleImage = (index: number, imageId: string) => update(index, { imageIds: steps[index].imageIds.includes(imageId) ? steps[index].imageIds.filter(id => id !== imageId) : steps[index].imageIds.length >= 10 ? steps[index].imageIds : [...steps[index].imageIds, imageId] });
  const payload = steps.map(toStep);
  const issues = stepIssues(payload);
  const save = async (active: boolean) => {
    if (issues.length) { setError(issues[0]); return; }
    setSaving(true); setError("");
    try {
      const saved = await request<FollowUpSequence>(`/follow-ups/columns/${column.id}`, { method: "PUT", body: JSON.stringify({ isActive: active, steps: payload, finalColumnId: finalColumnId || null }) });
      const items = await load(true).catch(() => [] as FollowUpSequence[]);
      publish(items.some(item => item.id === saved.id) ? items : [...items, saved]);
      setOpen(false);
      onSaved?.(active ? `Seguimiento activo en «${column.name}». Empieza con los chats que tengan actividad desde ahora.` : `Seguimiento de «${column.name}» guardado en pausa.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el seguimiento."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm(`¿Eliminar el seguimiento de «${column.name}»?`)) return;
    setSaving(true);
    try { await request(`/follow-ups/columns/${column.id}`, { method: "DELETE" }); publish((await load(true).catch(() => [])).filter(item => item.columnId !== column.id)); setOpen(false); onSaved?.(`Seguimiento de «${column.name}» eliminado.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar."); }
    finally { setSaving(false); }
  };
  const columnName = (id: string) => columns.find(item => item.id === id)?.name;
  const images = sets.flatMap(set => set.images.map(image => ({ ...image, setName: set.name })));

  if (!open) return <button type="button" className={`column-remarketing-trigger column-follow-up-trigger${current?.isActive ? " active" : ""}`} title={current ? `Seguimiento ${current.isActive ? "activo" : "en pausa"}: ${sequenceSummary(current, columnName)}${current.activeCount ? ` · ${current.activeCount} chat${current.activeCount === 1 ? "" : "s"} en curso` : ""}` : "Seguimiento automático si el cliente deja de responder"} aria-label={`Seguimiento automático de ${column.name}`} onClick={start}>⏱</button>;

  return <div className="confirm-dialog column-remarketing" role="dialog" aria-modal="true" aria-labelledby={`fu-${column.id}`}>
    <button type="button" className="confirm-dialog-backdrop" aria-label="Cerrar" onClick={() => !saving && setOpen(false)} />
    <section className="confirm-dialog-card column-remarketing-card follow-up-card">
      <header><h2 id={`fu-${column.id}`}>⏱ Seguimiento · {column.name}</h2><p>Si el cliente deja de responder (el último mensaje es tuyo), se le escribe después de cada espera. Se detiene en cuanto contesta.</p></header>
      <label className="column-remarketing-check"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} /> Activo</label>
      {steps.map((step, index) => {
        const chosen = step.imageIds.map(id => images.find(image => image.id === id)).filter(Boolean) as typeof images;
        return <fieldset key={index} className="follow-up-step">
          <legend>Paso {index + 1}</legend>
          <div className="follow-up-wait">
            <span>Si no responde en</span>
            <input type="number" min={1} value={step.waitValue} aria-label={`Espera del paso ${index + 1}`} onChange={event => update(index, { waitValue: event.target.value })} />
            <select value={step.waitUnit} aria-label="Unidad" onChange={event => update(index, { waitUnit: event.target.value as WaitUnit })}><option value="minutes">minutos</option><option value="hours">horas</option><option value="days">días</option></select>
            <small>{index === 0 ? "desde tu último mensaje" : "desde el paso anterior"}</small>
          </div>
          <textarea className="column-remarketing-text" rows={3} maxLength={4096} value={step.text} placeholder="Mensaje, p. ej. ¡Hola! ¿Pudiste revisar la Caja Emprendedora? Te ayudo con tu pedido 😊" onChange={event => update(index, { text: event.target.value })} />
          <div className="follow-up-media">
            <select value={pickFor?.step === index ? pickFor.setId : ""} aria-label="Agregar fotos de un conjunto" onChange={event => setPickFor(event.target.value ? { step: index, setId: event.target.value } : null)}><option value="">📷 Agregar fotos ({step.imageIds.length}/10)…</option>{sets.map(set => <option key={set.id} value={set.id}>{set.name} · {set.images.length}</option>)}</select>
            <select value={step.videoId} aria-label="Video guardado" onChange={event => update(index, { videoId: event.target.value })}><option value="">🎬 Sin video</option>{videos.videos.map(video => <option key={video.id} value={video.id}>{video.name}</option>)}</select>
          </div>
          {chosen.length > 0 && <div className="quick-reply-image-grid">{chosen.map(image => <button key={image.id} type="button" className="selected" title="Quitar" onClick={() => toggleImage(index, image.id)}><img src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={image.filename || image.setName} loading="lazy" /><span>×</span></button>)}</div>}
          {pickFor?.step === index && <div className="quick-reply-image-grid">{sets.find(set => set.id === pickFor.setId)?.images.map(image => { const selected = step.imageIds.includes(image.id); return <button key={image.id} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleImage(index, image.id)}><img src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={image.filename || "Imagen"} loading="lazy" /><span>✓</span></button>; })}</div>}
          <label className="column-remarketing-var">Si ya pasaron 24 h desde su último mensaje (WhatsApp solo permite plantillas)
            <select value={step.templateId} onChange={event => update(index, { templateId: event.target.value })}>
              <option value="">No enviar (se detiene el seguimiento)</option>
              {templates.filter(automaticTemplate).map(template => <option key={template.id} value={template.id}>📋 {template.name}</option>)}
            </select>
          </label>
          {steps.length > 1 && <button type="button" className="plain-button" onClick={() => setSteps(current => current.filter((_, position) => position !== index))}>Quitar paso</button>}
        </fieldset>;
      })}
      {steps.length < MAX_FOLLOW_UP_STEPS && <button type="button" className="plain-button" onClick={() => setSteps(current => [...current, emptyStep(current.length === 1 ? "1" : "3", "days")])}>＋ Agregar paso</button>}
      <label className="column-remarketing-var">Al terminar los pasos sin respuesta, mover a
        <select value={finalColumnId} onChange={event => setFinalColumnId(event.target.value)}><option value="">No mover</option>{columns.filter(item => item.id !== column.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <p className="column-remarketing-empty">No se envía de 9:00 p. m. a 9:00 a. m. (hora de tu negocio). Pasadas 24 h desde el último mensaje del cliente se usa la plantilla (si llegó por un anuncio, las plantillas son gratis durante 72 h). Solo aplica a chats con actividad después de activarlo.</p>
      {error && <p className="scenario-save-error" role="alert">{error}</p>}
      <footer>
        {current && <button type="button" className="danger-link" disabled={saving} onClick={() => void remove()}>Eliminar</button>}
        <button type="button" className="plain-button" disabled={saving} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="primary-action" disabled={saving} onClick={() => void save(isActive)}>{saving ? "Guardando…" : isActive ? "Guardar y activar" : "Guardar en pausa"}</button>
      </footer>
    </section>
  </div>;
}
