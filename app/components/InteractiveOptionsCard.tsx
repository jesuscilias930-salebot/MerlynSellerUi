"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { emptyOptionsMessage, toOptionsPayload, validateOptionsMessage } from "../lib/interactive-options";
import type { InteractiveOptionsMessage, InteractiveOptionsTemplate } from "../lib/types";
import { InteractiveOptionsEditor, InteractiveOptionsErrors, InteractiveOptionsPreview } from "./InteractiveOptionsEditor";
import { ToolAccordion } from "./ToolAccordion";

export const OPTION_TEMPLATES_UPDATED = "option-templates-updated";

export function InteractiveOptionsCard({ conversationId, disabled }: { conversationId?: string; disabled: boolean }) {
  const [templates, setTemplates] = useState<InteractiveOptionsTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState<InteractiveOptionsMessage>(emptyOptionsMessage);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const errors = validateOptionsMessage(message);

  useEffect(() => {
    const load = () => request<InteractiveOptionsTemplate[]>("/settings/option-templates").then(setTemplates).catch(() => undefined);
    void load();
    window.addEventListener(OPTION_TEMPLATES_UPDATED, load);
    return () => window.removeEventListener(OPTION_TEMPLATES_UPDATED, load);
  }, []);

  const choose = (id: string) => {
    setTemplateId(id); setNotice("");
    const template = templates.find(item => item.id === id);
    if (!template) { setMessage(emptyOptionsMessage()); setEditing(true); return; }
    setMessage({ format: template.format, header: template.header || "", body: template.body, footer: template.footer || "", buttonText: template.buttonText || "", sectionTitle: template.sectionTitle || "", options: template.options.map(option => ({ ...option })) });
    setEditing(false);
  };
  const send = async () => {
    if (!conversationId || errors.length) return;
    setSending(true); setNotice("");
    try {
      await request(`/conversations/${conversationId}/messages/options`, { method: "POST", body: JSON.stringify(toOptionsPayload(message)) });
      setNotice("Mensaje con opciones puesto en cola para enviarse.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el mensaje."); }
    finally { setSending(false); }
  };
  const showEditor = editing || !templateId;
  const started = Boolean(message.body.trim() || message.options.some(option => option.title.trim()));

  return <ToolAccordion icon="☰" title="Mensaje con opciones" description="Botones o lista para que el cliente elija con un toque.">
    <label>Mensaje guardado<select value={templateId} onChange={event => choose(event.target.value)}><option value="">Crear mensaje manual</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    <small className="cta-url-help">Guarda y administra estos mensajes desde el menú lateral, en WhatsApp → “Mensajes con opciones”.</small>
    {templateId && !editing && <button className="plain-button" type="button" onClick={() => setEditing(true)}>Editar solo para este envío</button>}
    {showEditor && <InteractiveOptionsEditor value={message} onChange={setMessage} disabled={sending} compact />}
    <InteractiveOptionsPreview value={message} />
    {showEditor && started && <InteractiveOptionsErrors errors={errors} />}
    <small className="cta-url-help">Como cualquier mensaje libre, solo se entrega si el cliente escribió en las últimas 24 horas.</small>
    {notice && <p className="cta-url-notice">{notice}</p>}
    <button className="tool-primary-button" type="button" disabled={disabled || !conversationId || sending || errors.length > 0} onClick={() => void send()}>{sending ? "Enviando…" : "Enviar opciones"}</button>
  </ToolAccordion>;
}
