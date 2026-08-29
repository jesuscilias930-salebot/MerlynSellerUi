"use client";

import { ChangeEvent, FormEvent } from "react";
import { api } from "../lib/api";
import { initials } from "../lib/format";
import type { Chat, Message } from "../lib/types";
import { AudioRecorder } from "./AudioRecorder";

type Props = {
  chat: Chat | null;
  messages: Message[];
  draft: string;
  uploadingAudio: boolean;
  onDraftChange: (value: string) => void;
  onSendText: (event: FormEvent) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onClose?: () => void;
};

export function ConversationPanel({ chat, messages, draft, uploadingAudio, onDraftChange, onSendText, onUploadAudio, onRecordAudio, onClose }: Props) {
  const mediaUrl = (message: Message) => `${api}/conversations/${chat?.id}/messages/${message.id}/media`;
  return <section className="panel">
    <header><b className="avatar">{chat ? initials(chat.name || chat.phone_number) : "M"}</b><div><h2>{chat ? chat.name || chat.phone_number : "Tu bandeja está lista"}</h2><small>{chat?.phone_number || "Selecciona un chat para comenzar"}</small></div>{onClose && <button className="close-conversation" type="button" onClick={onClose} aria-label="Cerrar conversación">×</button>}</header>
    <div className="thread">
      {!chat && <div className="empty"><b className="mark">M</b><h2>Atiende desde un solo lugar</h2><p>Crea una conversación o espera un mensaje entrante.</p></div>}
      {messages.map((message) => <article className={message.direction} key={message.id}>{message.type === "audio" && message.media_id ? <audio controls preload="metadata" crossOrigin="use-credentials" src={mediaUrl(message)}>Tu navegador no puede reproducir este audio.</audio> : message.type === "sticker" && message.media_id ? <img className="sticker" crossOrigin="use-credentials" src={mediaUrl(message)} alt="Sticker recibido" /> : <p>{message.body || `[${message.type}]`}</p>}<small>{new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {message.status}</small></article>)}
    </div>
    <form className="composer" onSubmit={onSendText}>
      <label className={uploadingAudio ? "audio-upload loading" : "audio-upload"} aria-label="Seleccionar audio">{uploadingAudio ? "…" : "♫"}<input type="file" accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,audio/opus" onChange={onUploadAudio} disabled={!chat || uploadingAudio} /></label>
      <textarea disabled={!chat} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder={chat ? "Escribe un mensaje…" : "Selecciona una conversación"} />
      <button disabled={!chat || !draft.trim()} className="send">↑</button>
    </form>
    <AudioRecorder disabled={!chat || uploadingAudio} onSend={onRecordAudio} />
  </section>;
}
