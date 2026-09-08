"use client";

import { useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";
import type { WhatsAppTemplate } from "../lib/types";
import { ToolAccordion } from "./ToolAccordion";

export function WhatsAppTemplateCard({ conversationId, disabled }: { conversationId?: string; disabled: boolean }) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { request<WhatsAppTemplate[]>("/whatsapp-templates").then(setTemplates).catch(() => undefined); }, []);
  const selected = useMemo(() => templates.find(template => template.id === templateId), [templates, templateId]);
  const manualMappings = selected?.mappings.filter(mapping => mapping.source === "manual") || [];
  const choose = (id: string) => { setTemplateId(id); setValues({}); setNotice(""); };
  const send = async () => { if (!conversationId || !selected) return; setSending(true); setNotice(""); try { await request(`/conversations/${conversationId}/messages/template`, { method: "POST", body: JSON.stringify({ templateId: selected.id, manualValues: values }) }); setNotice("Plantilla puesta en cola para enviarse."); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar la plantilla."); } finally { setSending(false); } };
  return <ToolAccordion icon="✦" title="Plantilla oficial" description="Envía una plantilla aprobada de WhatsApp, incluso fuera de la ventana de 24 horas."><label>Plantilla aprobada<select value={templateId} onChange={event => choose(event.target.value)}><option value="">Selecciona una plantilla</option>{templates.filter(template => template.status === "APPROVED").map(template => <option key={template.id} value={template.id}>{template.name} · {template.language}</option>)}</select></label>{selected && <div className="template-chat-preview">{selected.components.filter(component => component.text).map((component, index) => <p key={index}>{component.text}</p>)}</div>}{manualMappings.map(mapping => { const key = `${mapping.component}:${mapping.position}`; return <label key={key}>{mapping.label || `Valor para {{${mapping.position}}}`}<input value={values[key] || ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} required /></label>; })}{notice && <p className="cta-url-notice">{notice}</p>}<button className="tool-primary-button" type="button" disabled={disabled || !selected || sending || manualMappings.some(mapping => !values[`${mapping.component}:${mapping.position}`]?.trim())} onClick={() => void send()}>{sending ? "Enviando…" : "Enviar plantilla"}</button></ToolAccordion>;
}
