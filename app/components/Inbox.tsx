import { ChangeEvent, FormEvent } from "react";
import { initials } from "../lib/format";
import type { Chat, Message } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = {
  chats: Chat[];
  chat: Chat | null;
  messages: Message[];
  number: string;
  draft: string;
  uploadingAudio: boolean;
  onNumberChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onCreate: (event: FormEvent) => void;
  onOpen: (chat: Chat) => void;
  onSendText: (event: FormEvent) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
};

export function Inbox({ chats, chat, messages, number, draft, uploadingAudio, onNumberChange, onDraftChange, onCreate, onOpen, onSendText, onUploadAudio, onRecordAudio }: Props) {
  return <><section className="list"><header><div><p>BANDEJA</p><h2>Conversaciones</h2></div><b>＋</b></header><form onSubmit={onCreate}><input value={number} onChange={(event) => onNumberChange(event.target.value)} placeholder="Número con código de país" /><button>Nuevo</button></form><div className="rows">{chats.length === 0 && <em>Aún no hay conversaciones.</em>}{chats.map((item) => <button onClick={() => onOpen(item)} className={item.id === chat?.id ? "row active" : "row"} key={item.id}><b>{initials(item.name || item.phone_number)}</b><span><strong>{item.name || item.phone_number}</strong><small>{item.phone_number} · {item.last_message || "Sin mensajes aún"}</small></span></button>)}</div></section><ConversationPanel chat={chat} messages={messages} draft={draft} uploadingAudio={uploadingAudio} onDraftChange={onDraftChange} onSendText={onSendText} onUploadAudio={onUploadAudio} onRecordAudio={onRecordAudio} /></>;
}
