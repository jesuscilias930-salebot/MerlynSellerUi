"use client";

import { ChangeEvent, FormEvent } from "react";
import { api } from "../lib/api";
import { initials } from "../lib/format";
import type { Chat, DocumentOption, Message } from "../lib/types";
import { AudioRecorder } from "./AudioRecorder";

type Props = {
  chat: Chat | null;
  messages: Message[];
  draft: string;
  uploadingAudio: boolean;
  uploadingMedia: boolean;
  documentOptions: DocumentOption[];
  selectedDocumentId: string;
  onDraftChange: (value: string) => void;
  onSendText: (event: FormEvent) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentChange: (mediaId: string) => void;
  onSendDocument: () => void;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onClose?: () => void;
};

export function ConversationPanel({ chat, messages, draft, uploadingAudio, uploadingMedia, documentOptions, selectedDocumentId, onDraftChange, onSendText, onUploadAudio, onUploadImage, onUploadVideo, onUploadDocument, onDocumentChange, onSendDocument, onRecordAudio, onClose }: Props) {
  const mediaUrl = (message: Message) => `${api}/conversations/${chat?.id}/messages/${message.id}/media`;
  return <section className="panel">
    <header><b className="avatar">{chat ? initials(chat.name || chat.phone_number) : "M"}</b><div><h2>{chat ? chat.name || chat.phone_number : "Tu bandeja está lista"}</h2><small>{chat?.phone_number || "Selecciona un chat para comenzar"}</small></div>{onClose && <button className="close-conversation" type="button" onClick={onClose} aria-label="Cerrar conversación">×</button>}</header>
    <div className="thread">
      {!chat && <div className="empty"><b className="mark">M</b><h2>Atiende desde un solo lugar</h2><p>Crea una conversación o espera un mensaje entrante.</p></div>}
      {messages.map((message) => <article className={message.direction} key={message.id}>{message.type === "audio" && message.media_id ? <audio controls preload="metadata" crossOrigin="use-credentials" src={mediaUrl(message)}>Tu navegador no puede reproducir este audio.</audio> : message.type === "sticker" && message.media_id ? <img className="sticker" crossOrigin="use-credentials" src={mediaUrl(message)} alt="Sticker recibido" /> : message.type === "image" && message.media_id ? <img className="chat-image" crossOrigin="use-credentials" src={mediaUrl(message)} alt="Imagen enviada o recibida" /> : message.type === "video" && message.media_id ? <video className="chat-video" controls preload="metadata" crossOrigin="use-credentials" src={mediaUrl(message)}>Tu navegador no puede reproducir este video.</video> : <p>{message.body || `[${message.type}]`}</p>}<small>{new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {message.status}</small></article>)}
    </div>
    <div className="chat-attachments"><div className="catalog-picker"><select value={selectedDocumentId} onChange={(event) => onDocumentChange(event.target.value)} disabled={!chat || documentOptions.length === 0}>{documentOptions.length === 0 ? <option>No hay catálogo disponible</option> : documentOptions.map((document) => <option key={document.mediaId} value={document.mediaId}>{document.filename}</option>)}</select><button type="button" onClick={onSendDocument} disabled={!chat || !selectedDocumentId || uploadingMedia}>Enviar catálogo</button></div><label className="media-button">▤ PDF<input type="file" accept="application/pdf,.pdf" onChange={onUploadDocument} disabled={!chat || uploadingMedia} /></label><label className="media-button">▧ Imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadImage} disabled={!chat || uploadingMedia} /></label><label className="media-button">▸ Video<input type="file" accept="video/mp4,video/3gpp,video/quicktime,.mov" onChange={onUploadVideo} disabled={!chat || uploadingMedia} /></label>{uploadingMedia && <span>Subiendo…</span>}</div>
    <form className="composer" onSubmit={onSendText}>
      <label className={uploadingAudio ? "audio-upload loading" : "audio-upload"} aria-label="Seleccionar audio">{uploadingAudio ? "…" : "♫"}<input type="file" accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,audio/opus" onChange={onUploadAudio} disabled={!chat || uploadingAudio} /></label>
      <textarea disabled={!chat} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder={chat ? "Escribe un mensaje…" : "Selecciona una conversación"} />
      <button disabled={!chat || !draft.trim()} className="send">↑</button>
    </form>
    <AudioRecorder disabled={!chat || uploadingAudio} onSend={onRecordAudio} />
  </section>;
}
