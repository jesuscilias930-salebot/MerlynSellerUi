"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { templateCampaignIssues, templateCampaignPreview } from "../lib/template-campaign";
import type { LeadColumn, RemarketingPreset, WhatsAppTemplate } from "../lib/types";
import type { MoveRule } from "./RemarketingMovesPanel";

type Choice = { kind: "template" | "preset"; id: string } | { kind: "temporary" };
type Audience = { total: number; eligible: number };
type Data = { templates: WhatsAppTemplate[]; presets: RemarketingPreset[]; rules: MoveRule[] };

/** Botón 📣 de cada columna del tablero: envía el remarketing asignado a esa columna,
 *  otro mensaje guardado/plantilla, o un mensaje temporal escrito desde cero. */
export function ColumnRemarketing({ column, onSent }: { column: Pick<LeadColumn, "id" | "name" | "leads">; onSent?: (notice: string) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [otherKey, setOtherKey] = useState("");
  const [text, setText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<{ key: string; value?: Audience; error?: string } | null>(null);
  const [enableScenarios, setEnableScenarios] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([request<WhatsAppTemplate[]>("/whatsapp-templates"), request<RemarketingPreset[]>("/remarketing/presets"), request<MoveRule[]>("/remarketing/move-rules")])
      .then(([templates, presets, rules]) => {
        if (!active) return;
        const approved = templates.filter(row => row.status === "APPROVED");
        setData({ templates: approved, presets, rules });
        // Por defecto, el primer mensaje asignado a esta columna.
        const own = rules.find(rule => rule.homeColumnId === column.id && (rule.templateId ? approved.some(row => row.id === rule.templateId) : presets.some(row => row.id === rule.presetId)));
        setChoice(own ? (own.templateId ? { kind: "template", id: own.templateId } : { kind: "preset", id: own.presetId || "" }) : null);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los mensajes."); });
    return () => { active = false; };
  }, [open, column.id]);
  const template = choice?.kind === "template" ? data?.templates.find(row => row.id === choice.id) : undefined;
  const preset = choice?.kind === "preset" ? data?.presets.find(row => row.id === choice.id) : undefined;
  const audienceKey = choice ? (choice.kind === "template" ? "template" : "free") : "";
  useEffect(() => {
    if (!open || !audienceKey) return;
    let active = true;
    const path = audienceKey === "template" ? `/remarketing/template-campaigns/preview?columnId=${column.id}` : `/remarketing/campaigns/preview?columnId=${column.id}`;
    request<Audience>(path)
      .then(value => { if (active) setAudience({ key: audienceKey, value }); })
      .catch(reason => { if (active) setAudience({ key: audienceKey, error: reason instanceof Error ? reason.message : "No se pudo calcular." }); });
    return () => { active = false; };
  }, [open, audienceKey, column.id]);
  if (!open) return <button type="button" className="column-remarketing-trigger" title="Enviar remarketing a esta columna" aria-label={`Remarketing a ${column.name}`} onClick={() => { setOpen(true); setError(""); setText(""); setValues({}); setOtherKey(""); setEnableScenarios(false); }}>📣</button>;

  const own = (data?.rules || []).filter(rule => rule.homeColumnId === column.id);
  const ownKeys = new Set(own.map(rule => rule.templateId ? `template:${rule.templateId}` : `preset:${rule.presetId}`));
  const label = (kind: "template" | "preset", id: string) => kind === "template" ? data?.templates.find(row => row.id === id)?.name : data?.presets.find(row => row.id === id)?.name;
  const others = [
    ...(data?.templates || []).map(row => ({ key: `template:${row.id}`, name: `📋 ${row.name}` })),
    ...(data?.presets || []).map(row => ({ key: `preset:${row.id}`, name: `💬 ${row.name}` })),
  ].filter(item => !ownKeys.has(item.key));
  const choose = (key: string) => { const [kind, id] = key.split(":"); setChoice(kind === "template" || kind === "preset" ? { kind, id } : null); setValues({}); };
  const isOther = Boolean(choice && choice.kind !== "temporary" && !ownKeys.has(`${choice.kind}:${choice.id}`));
  const isSelected = (kind: string, id?: string) => choice?.kind === kind && (!id || ("id" in choice && choice.id === id));
  const issues = choice?.kind === "template" ? templateCampaignIssues(template, values) : choice?.kind === "temporary" ? (text.trim() ? [] : ["Escribe el mensaje."]) : choice ? [] : ["Elige un mensaje."];
  const manual = template?.mappings.filter(mapping => mapping.source === "manual") || [];
  const currentAudience = audience?.key === audienceKey ? audience : null;
  const eligible = currentAudience?.value?.eligible ?? 0;
  const send = async () => {
    if (!choice || issues.length || !eligible) return;
    if (!window.confirm(`¿Enviar a ${eligible} ${eligible === 1 ? "lead" : "leads"} de «${column.name}»?`)) return;
    setSending(true); setError("");
    try {
      if (choice.kind === "template") {
        const result = await request<{ queued: number }>("/remarketing/template-campaigns", { method: "POST", body: JSON.stringify({ columnId: column.id, templateId: choice.id, manualValues: values, enableScenarios }) });
        onSent?.(`Plantilla en cola para ${result.queued} ${result.queued === 1 ? "lead" : "leads"} de «${column.name}».`);
      } else {
        const body = choice.kind === "temporary" ? text.trim() : preset?.body || undefined;
        const result = await request<{ queued: number }>("/remarketing/campaigns", { method: "POST", body: JSON.stringify({
          columnId: column.id, enableScenarios, body,
          ...(choice.kind === "preset" ? { presetId: choice.id, mediaId: preset?.mediaId || undefined, filename: preset?.mediaId ? preset?.filename || undefined : undefined } : {}),
        }) });
        onSent?.(`Mensaje en cola para ${result.queued} ${result.queued === 1 ? "lead" : "leads"} de «${column.name}».`);
      }
      setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar."); }
    finally { setSending(false); }
  };
  return <div className="confirm-dialog column-remarketing" role="dialog" aria-modal="true" aria-labelledby={`crm-${column.id}`}>
    <button type="button" className="confirm-dialog-backdrop" aria-label="Cerrar" onClick={() => !sending && setOpen(false)} />
    <section className="confirm-dialog-card column-remarketing-card">
      <h2 id={`crm-${column.id}`}>Remarketing · {column.name}</h2>
      {!data && !error && <p>Cargando mensajes…</p>}
      {data && <div className="column-remarketing-choices" role="radiogroup" aria-label="Mensaje">
        {own.length > 0 && <small>Mensajes de esta columna</small>}
        {own.map(rule => { const kind = rule.templateId ? "template" : "preset"; const id = (rule.templateId || rule.presetId) as string; const name = label(kind, id); return name ? <label key={`${kind}:${id}`} className={isSelected(kind, id) ? "selected" : ""}><input type="radio" name={`m-${column.id}`} checked={isSelected(kind, id)} onChange={() => choose(`${kind}:${id}`)} /><span><b>{name}</b><em>{kind === "template" ? "Plantilla oficial · llega a toda la columna" : "Mensaje guardado · solo chats de las últimas 24 h"}</em></span></label> : null; })}
        {own.length === 0 && <p className="column-remarketing-empty">Esta columna aún no tiene mensajes asignados. Asígnalos en Remarketing → Configuración, o elige otro aquí.</p>}
        <label className={isOther ? "selected" : ""}>
          <input type="radio" name={`m-${column.id}`} checked={isOther} onChange={() => otherKey && choose(otherKey)} />
          <span><b>Otro mensaje</b><select value={otherKey} onChange={event => { setOtherKey(event.target.value); if (event.target.value) choose(event.target.value); }}><option value="">Elige una plantilla o mensaje guardado</option>{others.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></span>
        </label>
        <label className={isSelected("temporary") ? "selected" : ""}>
          <input type="radio" name={`m-${column.id}`} checked={isSelected("temporary")} onChange={() => setChoice({ kind: "temporary" })} />
          <span><b>Escribir un mensaje temporal</b><em>No se guarda. Solo llega a chats que escribieron en las últimas 24 h.</em></span>
        </label>
      </div>}
      {choice?.kind === "temporary" && <textarea className="column-remarketing-text" autoFocus rows={4} maxLength={4096} value={text} placeholder="Hola, tenemos novedades para ti…" onChange={event => setText(event.target.value)} />}
      {preset && <div className="template-campaign-preview"><small>Así se verá{preset.mediaId ? " · con imagen" : ""}</small><p>{preset.body || "(solo imagen)"}</p><button type="button" className="plain-button" onClick={() => { setText(preset.body || ""); setChoice({ kind: "temporary" }); }}>Editar este texto solo para este envío</button></div>}
      {template && <>
        {manual.map(mapping => { const key = `${mapping.component}:${mapping.position}`; return <label key={key} className="column-remarketing-var">{mapping.label || `Variable {{${mapping.position}}}`}<input value={values[key] || ""} maxLength={1024} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>; })}
        <div className="template-campaign-preview"><small>Así se verá</small><p>{templateCampaignPreview(template, values)}</p></div>
      </>}
      {choice && <p className="column-remarketing-audience">{!currentAudience ? "Calculando destinatarios…" : currentAudience.error || <><b>{eligible} de {currentAudience.value?.total}</b> {eligible === 1 ? "lead lo recibirá" : "leads lo recibirán"}{choice.kind === "template" ? "" : " (los demás no han escrito en 24 h: usa una plantilla oficial)"}.</>}</p>}
      {choice && <label className="column-remarketing-check"><input type="checkbox" checked={enableScenarios} onChange={event => setEnableScenarios(event.target.checked)} /> Encender escenarios para todos</label>}
      {choice && issues.length > 0 && (choice.kind !== "temporary" || text) && <p className="template-campaign-error">{issues[0]}</p>}
      {error && <p className="template-campaign-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="plain-button" disabled={sending} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="primary-action" disabled={sending || !choice || issues.length > 0 || !eligible} onClick={() => void send()}>{sending ? "Enviando…" : `Enviar a ${eligible}`}</button>
      </footer>
    </section>
  </div>;
}
