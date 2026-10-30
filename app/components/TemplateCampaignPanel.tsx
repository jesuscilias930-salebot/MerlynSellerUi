"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { templateCampaignIssues, templateCampaignPreview } from "../lib/template-campaign";
import type { LeadColumn, WhatsAppTemplate } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

type Preview = { total: number; scenariosPaused?: number; eligible: number; otherChannel: number; recent: number; overLimit: number; max: number };
type Result = { queued: number; scenariosEnabled?: number; skipped: { otherChannel: number; recent: number; overLimit: number; missingData: number }; warning?: string };

/** Casilla «Encender escenarios para todos» junto a la columna; el backend solo enciende los que estén pausados. */
export function ScenariosCheckbox({ checked, paused, onChange }: { checked: boolean; paused?: number; onChange: (value: boolean) => void }) {
  return <label className="scenarios-checkbox">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span>Encender escenarios para todos{paused ? <small>{paused} {paused === 1 ? "chat los tiene pausados" : "chats los tienen pausados"}</small> : null}</span>
  </label>;
}

/** Remarketing masivo con una plantilla aprobada por Meta: llega aunque pasen las 24 h. */
export function TemplateCampaignPanel({ columns }: { columns: Pick<LeadColumn, "id" | "name">[] }) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ columnId: string; data?: Preview; error?: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [reload, setReload] = useState(0);
  const [enableScenarios, setEnableScenarios] = useState(false);
  useEffect(() => {
    let active = true;
    request<WhatsAppTemplate[]>("/whatsapp-templates").then(rows => { if (active) setTemplates(rows.filter(row => row.status === "APPROVED")); }).catch(reason => { if (active) { setTemplates([]); setError(reason instanceof Error ? reason.message : "No se pudieron cargar las plantillas."); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!columnId) return;
    let active = true;
    request<Preview>(`/remarketing/template-campaigns/preview?columnId=${columnId}`)
      .then(data => { if (active) setPreview({ columnId, data }); })
      .catch(reason => { if (active) setPreview({ columnId, error: reason instanceof Error ? reason.message : "No se pudo calcular el envío." }); });
    return () => { active = false; };
  }, [columnId, reload]);
  const template = templates?.find(item => item.id === templateId);
  const manual = template?.mappings.filter(mapping => mapping.source === "manual") || [];
  const issues = templateCampaignIssues(template, values);
  const text = template ? templateCampaignPreview(template, values) : "";
  const buttons = (template?.components || []).flatMap(component => String(component.type).toUpperCase() === "BUTTONS" ? ((component as { buttons?: { text?: string }[] }).buttons || []).map(button => button.text || "").filter(Boolean) : []);
  const current = preview?.columnId === columnId ? preview : null;
  const column = columns.find(item => item.id === columnId);
  const send = async () => {
    setConfirm(false); setSending(true); setError(""); setResult(null);
    try { setResult(await request<Result>("/remarketing/template-campaigns", { method: "POST", body: JSON.stringify({ columnId, templateId, manualValues: values, enableScenarios }) })); setReload(value => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar."); }
    finally { setSending(false); }
  };
  return <div className="template-campaign">
    <div className="template-campaign-form">
      <label>Plantilla aprobada<select value={templateId} onChange={event => { setTemplateId(event.target.value); setValues({}); setResult(null); }}>
        <option value="">{templates === null ? "Cargando…" : templates.length ? "Elige una plantilla" : "No hay plantillas aprobadas: sincronízalas en Plantillas oficiales"}</option>
        {(templates || []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.language}{item.category ? ` · ${item.category}` : ""}</option>)}
      </select></label>
      <div className="remarketing-column-row">
        <label>Enviar a los leads de la columna<select value={columnId} onChange={event => { setColumnId(event.target.value); setResult(null); }}>
          <option value="">Elige una columna</option>{columns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <ScenariosCheckbox checked={enableScenarios} paused={current?.data?.scenariosPaused} onChange={setEnableScenarios} />
      </div>
      {manual.map(mapping => { const key = `${mapping.component}:${mapping.position}`; return <label key={key}>{mapping.label || `Variable {{${mapping.position}}}`} <small>(igual para todos)</small><input value={values[key] || ""} maxLength={1024} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>; })}
      {template && <div className="template-campaign-preview"><small>Así se verá</small><p>{text}</p>{buttons.length > 0 && <div className="template-campaign-buttons">{buttons.map(label => <span key={label}>↩ {label}</span>)}</div>}</div>}
      {columnId && <div className="template-campaign-audience" aria-live="polite">
        {!current ? "Calculando destinatarios…" : current.error ? current.error : <>
          <b>{current.data!.eligible} {current.data!.eligible === 1 ? "lead recibirá" : "leads recibirán"} la plantilla</b> de {current.data!.total} en «{column?.name}».
          {current.data!.recent > 0 && <span>{current.data!.recent} ya recibieron una plantilla de remarketing en las últimas 24 h y se omiten.</span>}
          {current.data!.otherChannel > 0 && <span>{current.data!.otherChannel} son de Messenger o Instagram (las plantillas son solo para WhatsApp).</span>}
          {current.data!.overLimit > 0 && <span>Máximo {current.data!.max} por envío: {current.data!.overLimit} quedan para el siguiente.</span>}
        </>}
      </div>}
      {issues.length > 0 && templateId && <p className="template-campaign-error">{issues[0]}</p>}
      {error && <p className="template-campaign-error" role="alert">{error}</p>}
      {result && <p className="template-campaign-result" role="status">✓ {result.queued} {result.queued === 1 ? "mensaje en cola" : "mensajes en cola"}. Se envían en los próximos minutos; las respuestas llegan al inbox.{result.scenariosEnabled ? ` Se encendieron los escenarios en ${result.scenariosEnabled} ${result.scenariosEnabled === 1 ? "chat" : "chats"}.` : ""}{result.skipped.missingData > 0 ? ` ${result.skipped.missingData} se omitieron por falta de datos (${result.warning}).` : ""}</p>}
      <button type="button" className="primary-action" disabled={sending || !columnId || !current?.data?.eligible || issues.length > 0} onClick={() => setConfirm(true)}>{sending ? "Enviando…" : "Enviar plantilla"}</button>
      <small className="template-campaign-hint">Meta cobra cada plantilla de marketing enviada y limita cuántas puedes mandar por día según la calidad de tu número. Envía solo a quien te dio permiso de contactarlo.</small>
    </div>
    <ConfirmDialog open={confirm} title={`¿Enviar «${template?.name}» a ${current?.data?.eligible ?? 0} leads?`} confirmLabel="Enviar plantilla" busy={sending} onCancel={() => setConfirm(false)} onConfirm={() => void send()}>
      <p>Se enviará a los leads de WhatsApp de «{column?.name}». No se puede cancelar una vez en cola.</p>
    </ConfirmDialog>
  </div>;
}

type PendingReplies = { hours: number; pending: number; ready: number; botPaused: number; scenariosPaused: number; bothPaused?: number };
type ReprocessResult = { processed: number; answered: number; unanswered: number; scenariosEnabled?: number; botEnabled?: number; skipped?: number };

/** Respuestas a plantillas (p. ej. «Sí, quiero ver el catálogo») que el bot no atendió: permite atenderlas de nuevo,
 *  encendiendo antes escenarios y/o bot solo en esos chats si se elige. */
export function TemplateRepliesPanel() {
  const [hours, setHours] = useState(72);
  const [data, setData] = useState<PendingReplies | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReprocessResult | null>(null);
  const [reload, setReload] = useState(0);
  const [enableScenarios, setEnableScenarios] = useState(true);
  const [enableBot, setEnableBot] = useState(false);
  useEffect(() => {
    let active = true;
    request<PendingReplies>(`/remarketing/template-replies/pending?hours=${hours}`)
      .then(value => { if (active) { setData(value); setError(""); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron revisar las respuestas."); });
    return () => { active = false; };
  }, [reload, hours]);
  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try { setResult(await request<ReprocessResult>("/remarketing/template-replies/reprocess", { method: "POST", body: JSON.stringify({ hours, enableScenarios, enableBot }) })); setReload(value => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron atender las respuestas."); }
    finally { setBusy(false); }
  };
  if (!data && !error) return null;
  // Cuántos se atenderán con las casillas actuales: los listos + los que se desbloquean.
  const both = data?.bothPaused || 0;
  const scenariosCount = data ? data.scenariosPaused + both : 0;
  const botCount = data ? data.botPaused + both : 0;
  const willProcess = data ? data.ready + (enableScenarios ? data.scenariosPaused : 0) + (enableBot ? data.botPaused : 0) + (enableScenarios && enableBot ? both : 0) : 0;
  return <div className="template-replies" aria-live="polite">
    <div>
      <b>Respuestas a plantillas sin atender
        <select aria-label="Periodo" value={hours} onChange={event => { setHours(Number(event.target.value)); setResult(null); }}><option value={72}>últimos 3 días</option><option value={168}>últimos 7 días</option></select>
      </b>
      {data && <span>{data.pending ? `${data.pending} ${data.pending === 1 ? "lead tocó" : "leads tocaron"} un botón de tu plantilla y no ${data.pending === 1 ? "recibió" : "recibieron"} respuesta.` : "No hay respuestas pendientes en este periodo."}</span>}
      {scenariosCount > 0 && <label className="template-replies-check"><input type="checkbox" checked={enableScenarios} onChange={event => setEnableScenarios(event.target.checked)} /> Encender escenarios en {scenariosCount === 1 ? "el chat que los tiene" : `los ${scenariosCount} chats que los tienen`} pausados</label>}
      {botCount > 0 && <label className="template-replies-check"><input type="checkbox" checked={enableBot} onChange={event => setEnableBot(event.target.checked)} /> Encender el bot en {botCount === 1 ? "el chat que lo tiene" : `los ${botCount} chats que lo tienen`} pausado <small>(después contestará sus mensajes)</small></label>}
      {result && <span className="template-replies-result">✓ {result.answered} {result.answered === 1 ? "atendida" : "atendidas"}{result.scenariosEnabled ? ` · escenarios encendidos en ${result.scenariosEnabled}` : ""}{result.botEnabled ? ` · bot encendido en ${result.botEnabled}` : ""}{result.unanswered > 0 ? ` · ${result.unanswered} sin respuesta (revisa que el botón coincida con las frases de un escenario)` : ""}{result.skipped ? ` · ${result.skipped} omitidas por tener el bot o los escenarios pausados` : ""}.</span>}
      {error && <span className="template-campaign-error" role="alert">{error}</span>}
    </div>
    {data && data.pending > 0 && <button type="button" className="primary-action" disabled={busy || willProcess === 0} onClick={() => void run()}>{busy ? "Atendiendo…" : `Enviar respuesta a ${willProcess}`}</button>}
  </div>;
}

/** Remarketing: plantilla oficial (masivo) o mensaje libre a conversaciones abiertas. */
export function RemarketingTabs({ columns, children }: { columns: Pick<LeadColumn, "id" | "name">[]; children: React.ReactNode }) {
  const [tab, setTab] = useState<"template" | "free">("template");
  return <div className="remarketing-tabs">
    <nav role="tablist" aria-label="Tipo de remarketing">
      <button type="button" role="tab" aria-selected={tab === "template"} className={tab === "template" ? "selected" : ""} onClick={() => setTab("template")}>Plantilla oficial <small>a toda la columna</small></button>
      <button type="button" role="tab" aria-selected={tab === "free"} className={tab === "free" ? "selected" : ""} onClick={() => setTab("free")}>Mensaje libre <small>solo chats de las últimas 24 h</small></button>
    </nav>
    {tab === "template" ? <section className="remarketing"><header className="remarketing-header"><div><p>CAMPAÑAS</p><h1>Remarketing con plantilla oficial</h1><span>Envía una plantilla aprobada por Meta a todos los leads de WhatsApp de una columna, aunque no te hayan escrito en las últimas 24 horas. Sus respuestas (incluidos los botones) pasan por tus escenarios y reglas.</span></div></header><TemplateRepliesPanel /><TemplateCampaignPanel columns={columns} /></section> : children}
  </div>;
}
