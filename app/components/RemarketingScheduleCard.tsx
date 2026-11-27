"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { scheduleSummary, timeLabel, type RemarketingSchedule } from "../lib/remarketing-schedule";

/** Horario del remarketing automático: a qué hora se pausa y a qué hora se reanuda (y se envía lo pendiente). */
export function RemarketingScheduleCard() {
  const [saved, setSaved] = useState<RemarketingSchedule | null>(null);
  const [draft, setDraft] = useState<RemarketingSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<RemarketingSchedule>("/remarketing/schedule").then(value => { if (active) setSaved(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el horario."); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (!draft) return;
    if (draft.pauseAt === draft.resumeAt) { setError("La hora de pausa y la de reanudar deben ser distintas."); return; }
    setSaving(true); setError("");
    try {
      const value = await request<RemarketingSchedule>("/remarketing/schedule", { method: "PUT", body: JSON.stringify({ isActive: draft.isActive, pauseAt: draft.pauseAt, resumeAt: draft.resumeAt, deferCampaigns: draft.deferCampaigns }) });
      setSaved(value); setDraft(null); setNotice("Horario guardado.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  };
  if (!saved) return error ? <p className="scenario-save-error" role="alert">{error}</p> : null;
  const value = draft || saved;
  const set = (patch: Partial<RemarketingSchedule>) => { setDraft({ ...value, ...patch }); setNotice(""); };
  return <section className="remarketing-schedule-card" aria-label="Horario del remarketing automático">
    <div className="remarketing-schedule-head">
      <div><b>🌙 Horario del remarketing automático</b><small>{scheduleSummary(saved)}{saved.isActive && saved.deferCampaigns ? " · los 📣 lanzados en la pausa se programan" : ""}</small></div>
      {!draft && <button type="button" className="plain-button" onClick={() => setDraft(saved)}>Configurar</button>}
    </div>
    {draft && <div className="remarketing-schedule-form">
      <label className="column-remarketing-check"><input type="checkbox" checked={value.isActive} onChange={event => set({ isActive: event.target.checked })} /> Pausar el remarketing automático en un horario</label>
      <div className="remarketing-schedule-times">
        <label>Pausar a las<input type="time" value={value.pauseAt} disabled={!value.isActive} onChange={event => set({ pauseAt: event.target.value })} /></label>
        <label>Reanudar a las<input type="time" value={value.resumeAt} disabled={!value.isActive} onChange={event => set({ resumeAt: event.target.value })} /></label>
      </div>
      <label className="column-remarketing-check"><input type="checkbox" checked={value.deferCampaigns} disabled={!value.isActive} onChange={event => set({ deferCampaigns: event.target.checked })} /> Aplazar también los envíos 📣 que lance en ese horario</label>
      <small>
        Durante la pausa no salen los seguimientos ⏱{value.deferCampaigns ? " y los 📣 quedan «programados»" : ""}. A las {timeLabel(value.resumeAt)} se envía todo lo pendiente,
        excepto a quien te escribió mientras tanto. Los mensajes que escribes tú en el chat salen siempre. La hora es la de tu negocio (Horario de atención).
      </small>
      {error && <p className="scenario-save-error" role="alert">{error}</p>}
      <div className="remarketing-schedule-actions">
        <button type="button" className="plain-button" disabled={saving} onClick={() => { setDraft(null); setError(""); }}>Cancelar</button>
        <button type="button" className="primary-action" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar horario"}</button>
      </div>
    </div>}
    {notice && <small className="remarketing-schedule-notice" role="status">{notice}</small>}
  </section>;
}
