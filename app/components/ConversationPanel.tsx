"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { initials } from "../lib/format";
import type { AutomationIntent, Chat, DocumentOption, Message } from "../lib/types";
import { AudioRecorder } from "./AudioRecorder";

type Props = {
  chat: Chat | null;
  messages: Message[];
  draft: string;
  uploadingAudio: boolean;
  uploadingMedia: boolean;
  documentOptions: DocumentOption[];
  selectedDocumentId: string;
  documentCaption: string;
  onDraftChange: (value: string) => void;
  onSendText: (event: FormEvent) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentChange: (mediaId: string) => void;
  onDocumentCaptionChange: (caption: string) => void;
  onSendDocument: () => void;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onAutoReplyChange: (enabled: boolean) => void;
  automationIntents: AutomationIntent[];
  onLearnIntent: (messageId: string, intentId: string) => Promise<void>;
  onClose?: () => void;
};

function IntentLearner({ message, intents, onLearn }: { message: Message; intents: AutomationIntent[]; onLearn: (messageId: string, intentId: string) => Promise<void> }) {
  const [intentId, setIntentId] = useState("");
  const [saving, setSaving] = useState(false);
  if (message.direction !== "inbound" || message.type !== "text" || !message.body) return null;
  return <div className="intent-learner"><select value={intentId} onChange={(event) => setIntentId(event.target.value)}><option value="">Este mensaje corresponde a…</option>{intents.map((intent) => <option key={intent.id} value={intent.id}>{intent.name}</option>)}</select><button type="button" disabled={!intentId || saving} onClick={async () => { setSaving(true); try { await onLearn(message.id, intentId); setIntentId(""); } finally { setSaving(false); } }}>{saving ? "Guardando…" : "Aprender"}</button></div>;
}

export function ConversationPanel({ chat, messages, draft, uploadingAudio, uploadingMedia, documentOptions, selectedDocumentId, documentCaption, onDraftChange, onSendText, onUploadAudio, onUploadImage, onUploadVideo, onUploadDocument, onDocumentChange, onDocumentCaptionChange, onSendDocument, onRecordAudio, onAutoReplyChange, automationIntents, onLearnIntent, onClose }: Props) {
  const threadRef = useRef<HTMLDivElement>(null);
  const scrolledConversationId = useRef<string | null>(null);
  useEffect(() => {
    if (!chat?.id || messages.length === 0 || scrolledConversationId.current === chat.id) return;
    const frame = requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "auto" });
      scrolledConversationId.current = chat.id;
    });
    return () => cancelAnimationFrame(frame);
  }, [chat?.id, messages]);
  const mediaUrl = (message: Message) => `${api}/conversations/${chat?.id}/messages/${message.id}/media`;
  const messageContent = (message: Message) => {
    if (message.type === "audio" && message.media_id) return <audio controls preload="metadata" crossOrigin="use-credentials" src={mediaUrl(message)}>Tu navegador no puede reproducir este audio.</audio>;
    if (message.type === "sticker" && message.media_id) return <img className="sticker" crossOrigin="use-credentials" src={mediaUrl(message)} alt="Sticker recibido" />;
    if (message.type === "image" && message.media_id) return <img className="chat-image" crossOrigin="use-credentials" src={mediaUrl(message)} alt="Imagen enviada o recibida" />;
    if (message.type === "video" && message.media_id) return <video className="chat-video" controls preload="metadata" crossOrigin="use-credentials" src={mediaUrl(message)}>Tu navegador no puede reproducir este video.</video>;
    if (message.type === "document" && message.media_id) {
      const caption = message.body && message.body !== "[document]" ? message.body : null;
      return <a className="document-card" href={mediaUrl(message)} target="_blank" rel="noreferrer"><b className="document-icon">PDF</b><span><strong>{message.filename || "Documento adjunto"}</strong>{caption && <em>{caption}</em>}<small>Abrir documento</small></span></a>;
    }
    return <p>{message.body || `[${message.type}]`}</p>;
  };
  return <section className="panel">
    <header><b className="avatar">{chat ? initials(chat.name || chat.phone_number) : "M"}</b><div><h2>{chat ? chat.name || chat.phone_number : "Tu bandeja está lista"}</h2><small>{chat?.phone_number || "Selecciona un chat para comenzar"}</small></div>{chat && <button className={`bot-toggle ${chat.autoReplyEnabled !== false ? "on" : ""}`} type="button" onClick={() => onAutoReplyChange(chat.autoReplyEnabled === false)}>{chat.autoReplyEnabled === false ? "Bot apagado" : "Bot activo"}</button>}{onClose && <button className="close-conversation" type="button" onClick={onClose} aria-label="Cerrar conversación">×</button>}</header>
    <div className="thread" ref={threadRef}>
      {!chat && <div className="empty"><b className="mark">M</b><h2>Atiende desde un solo lugar</h2><p>Crea una conversación o espera un mensaje entrante.</p></div>}
      {messages.map((message) => <article className={message.direction} key={message.id}>{messageContent(message)}<small>{new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {message.status}{message.status === "failed" && message.error_code ? ` · ${message.error_code}` : ""}</small><IntentLearner message={message} intents={automationIntents} onLearn={onLearnIntent} /></article>)}
    </div>
    <div className="chat-attachments"><div className="catalog-picker"><select value={selectedDocumentId} onChange={(event) => onDocumentChange(event.target.value)} disabled={!chat || documentOptions.length === 0}>{documentOptions.length === 0 ? <option>No hay catálogo disponible</option> : documentOptions.map((document) => <option key={document.mediaId} value={document.mediaId}>{document.filename}</option>)}</select><input value={documentCaption} onChange={(event) => onDocumentCaptionChange(event.target.value)} maxLength={1024} placeholder="Mensaje que acompaña el catálogo (opcional)" disabled={!chat || !selectedDocumentId || uploadingMedia} aria-label="Mensaje que acompaña el catálogo" /><button type="button" onClick={onSendDocument} disabled={!chat || !selectedDocumentId || uploadingMedia}>Enviar catálogo</button></div><label className="media-button">▤ PDF<input type="file" accept="application/pdf,.pdf" onChange={onUploadDocument} disabled={!chat || uploadingMedia} /></label><label className="media-button">▧ Imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadImage} disabled={!chat || uploadingMedia} /></label><label className="media-button">▸ Video<input type="file" accept="video/mp4,video/3gpp" onChange={onUploadVideo} disabled={!chat || uploadingMedia} /></label>{uploadingMedia && <span>Subiendo…</span>}</div>
    <form className="composer" onSubmit={onSendText}>
      <label className={uploadingAudio ? "audio-upload loading" : "audio-upload"} aria-label="Seleccionar audio">{uploadingAudio ? "…" : "♫"}<input type="file" accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,audio/opus" onChange={onUploadAudio} disabled={!chat || uploadingAudio} /></label>
      <textarea disabled={!chat} value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && draft.trim()) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={chat ? "Escribe un mensaje…" : "Selecciona una conversación"} />
      <button disabled={!chat || !draft.trim()} className="send">↑</button>
    </form>
    <AudioRecorder disabled={!chat || uploadingAudio} onSend={onRecordAudio} />
  </section>;
}
