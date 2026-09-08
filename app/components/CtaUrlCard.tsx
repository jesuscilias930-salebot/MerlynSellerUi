"use client";

import { useState } from "react";
import type { CtaUrlMessage, EntrepreneurPackage } from "../lib/types";
import { ToolAccordion } from "./ToolAccordion";

const GROUP_URL = "https://chat.whatsapp.com/FfHJ6u4q06MEEmnlprWgY4?mode=gi_t";

export function CtaUrlCard({ disabled, packages: _packages, onSend }: { disabled: boolean; packages: EntrepreneurPackage[]; onSend: (data: CtaUrlMessage) => Promise<void> }) {
  const [header, setHeader] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [body, setBody] = useState("Únete a nuestro grupo de WhatsApp para recibir novedades, promociones y contenido exclusivo.");
  const [footer, setFooter] = useState("Te esperamos en el grupo");
  const [buttonText, setButtonText] = useState("Unirme al grupo");
  const [url, setUrl] = useState(GROUP_URL);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async () => {
    setSending(true);
    setNotice("");
    try {
      await onSend({ header: headerImageUrl ? undefined : header || undefined, headerImageUrl: headerImageUrl || undefined, body, footer: footer || undefined, buttonText, url });
      setNotice("Invitación enviada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible enviar la invitación.");
    } finally {
      setSending(false);
    }
  };

  return <ToolAccordion icon="↗" title="Invitación con botón" description="Crea un CTA URL interactivo para tu grupo de WhatsApp."><label>URL pública de imagen (opcional)<input value={headerImageUrl} onChange={event => setHeaderImageUrl(event.target.value)} type="url" placeholder="https://tu-dominio.com/invitacion.jpg" /></label><small className="cta-url-help">Meta requiere una URL HTTPS pública para la imagen. Las imágenes guardadas de WhatsApp no pueden usarse como encabezado del CTA.</small><label>Encabezado de texto (opcional)<input value={header} onChange={event => setHeader(event.target.value)} maxLength={60} placeholder="Ej. Comunidad Merlyn" disabled={Boolean(headerImageUrl)} /></label><label>Texto del mensaje<textarea value={body} onChange={event => setBody(event.target.value)} maxLength={1024} /></label><label>Pie de mensaje (opcional)<input value={footer} onChange={event => setFooter(event.target.value)} maxLength={60} /></label><label>Texto del botón<input value={buttonText} onChange={event => setButtonText(event.target.value)} maxLength={20} /></label><label>URL del botón<input value={url} onChange={event => setUrl(event.target.value)} type="url" required /></label>{notice && <p className="cta-url-notice">{notice}</p>}<button className="tool-primary-button" type="button" disabled={disabled || sending || !body.trim() || !buttonText.trim() || !url.trim()} onClick={() => void submit()}>{sending ? "Enviando…" : "Enviar invitación"}</button></ToolAccordion>;
}
