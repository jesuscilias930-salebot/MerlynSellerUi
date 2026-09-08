"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import type { CtaUrlMessage, CtaUrlTemplate, EntrepreneurPackage } from "../lib/types";
import { ToolAccordion } from "./ToolAccordion";

const GROUP_URL = "https://chat.whatsapp.com/FfHJ6u4q06MEEmnlprWgY4?mode=gi_t";

export function CtaUrlCard({ disabled, packages: _packages, onSend }: { disabled: boolean; packages: EntrepreneurPackage[]; onSend: (data: CtaUrlMessage) => Promise<void> }) {
  const [templates, setTemplates] = useState<CtaUrlTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [header, setHeader] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [body, setBody] = useState("Únete a nuestro grupo de WhatsApp para recibir novedades, promociones y contenido exclusivo.");
  const [footer, setFooter] = useState("Te esperamos en el grupo");
  const [buttonText, setButtonText] = useState("Unirme al grupo");
  const [url, setUrl] = useState(GROUP_URL);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const loadTemplates = () => request<CtaUrlTemplate[]>("/settings/cta-url-templates").then(setTemplates).catch(() => undefined);
  useEffect(() => { void loadTemplates(); const refresh = () => void loadTemplates(); window.addEventListener("cta-url-templates-updated", refresh); return () => window.removeEventListener("cta-url-templates-updated", refresh); }, []);
  const applyTemplate = (id: string) => { setTemplateId(id); const template = templates.find(item => item.id === id); if (!template) return; setHeader(template.header || ""); setHeaderImageUrl(template.headerImageUrl || ""); setBody(template.body); setFooter(template.footer || ""); setButtonText(template.buttonText); setUrl(template.url); };
  const submit = async () => { setSending(true); setNotice(""); try { await onSend({ header: headerImageUrl ? undefined : header || undefined, headerImageUrl: headerImageUrl || undefined, body, footer: footer || undefined, buttonText, url }); setNotice("Invitación enviada."); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar la invitación."); } finally { setSending(false); } };

  return <ToolAccordion icon="↗" title="Invitación con botón" description="Elige una invitación guardada o prepara una nueva."><label>Invitación guardada<select value={templateId} onChange={event => applyTemplate(event.target.value)}><option value="">Crear configuración manual</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><small className="cta-url-help">Guarda y administra estas invitaciones desde el menú lateral, en “Invitaciones con botón”.</small><label>URL pública de imagen (opcional)<input value={headerImageUrl} onChange={event => { setTemplateId(""); setHeaderImageUrl(event.target.value); }} type="url" placeholder="https://tu-dominio.com/invitacion.jpg" /></label><small className="cta-url-help">Meta requiere una URL HTTPS pública para la imagen. Las imágenes guardadas de WhatsApp no pueden usarse como encabezado del CTA.</small><label>Encabezado de texto (opcional)<input value={header} onChange={event => { setTemplateId(""); setHeader(event.target.value); }} maxLength={60} placeholder="Ej. Comunidad Merlyn" disabled={Boolean(headerImageUrl)} /></label><label>Texto del mensaje<textarea value={body} onChange={event => { setTemplateId(""); setBody(event.target.value); }} maxLength={1024} /></label><label>Pie de mensaje (opcional)<input value={footer} onChange={event => { setTemplateId(""); setFooter(event.target.value); }} maxLength={60} /></label><label>Texto del botón<input value={buttonText} onChange={event => { setTemplateId(""); setButtonText(event.target.value); }} maxLength={20} /></label><label>URL del botón<input value={url} onChange={event => { setTemplateId(""); setUrl(event.target.value); }} type="url" required /></label>{notice && <p className="cta-url-notice">{notice}</p>}<button className="tool-primary-button" type="button" disabled={disabled || sending || !body.trim() || !buttonText.trim() || !url.trim()} onClick={() => void submit()}>{sending ? "Enviando…" : "Enviar invitación"}</button></ToolAccordion>;
}
