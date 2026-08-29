import { ChangeEvent, FormEvent } from "react";
import { initials } from "../lib/format";
import type { Chat, ConversationFilter, DocumentOption, LeadColumn, Message } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = {
  chats: Chat[];
  columns: LeadColumn[];
  filter: ConversationFilter;
  chat: Chat | null;
  messages: Message[];
  number: string;
  draft: string;
  uploadingAudio: boolean; uploadingMedia: boolean; documentOptions: DocumentOption[]; selectedDocumentId: string;
  onNumberChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onCreate: (event: FormEvent) => void;
  onOpen: (chat: Chat) => void;
  onFilterChange: (filter: ConversationFilter) => void;
  onSendText: (event: FormEvent) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void; onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void; onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void; onDocumentChange: (mediaId: string) => void; onSendDocument: () => void;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
};

export function Inbox({ chats, columns, filter, chat, messages, number, draft, uploadingAudio, uploadingMedia, documentOptions, selectedDocumentId, onNumberChange, onDraftChange, onCreate, onOpen, onFilterChange, onSendText, onUploadAudio, onUploadImage, onUploadVideo, onUploadDocument, onDocumentChange, onSendDocument, onRecordAudio }: Props) {
  return <><section className="list"><header><div><p>BANDEJA</p><h2>Conversaciones</h2></div><b>＋</b></header><div className="inbox-filter"><select value={filter} onChange={(event) => onFilterChange(event.target.value as ConversationFilter)} aria-label="Filtrar conversaciones"><option value="all">Todos</option><option value="unread">No leídos</option><option value="needs-response">Pendientes de respuesta</option>{columns.map((column) => <option key={column.id} value={`column:${column.id}`}>Columna: {column.name}</option>)}</select></div><form onSubmit={onCreate}><input value={number} onChange={(event) => onNumberChange(event.target.value)} placeholder="Número con código de país" /><button>Nuevo</button></form><div className="rows">{chats.length === 0 && <em>No hay conversaciones para este filtro.</em>}{chats.map((item) => <button onClick={() => onOpen(item)} className={`${item.id === chat?.id ? "row active" : "row"}${item.unreadCount > 0 ? " has-unread" : ""}`} key={item.id}><b>{initials(item.name || item.phone_number)}</b><span><strong>{item.name || item.phone_number}</strong><small>{item.phone_number} · {item.last_message || "Sin mensajes aún"}</small></span>{item.unreadCount > 0 && <b className="unread-badge" aria-label={`${item.unreadCount} mensajes pendientes`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</b>}</button>)}</div></section><ConversationPanel chat={chat} messages={messages} draft={draft} uploadingAudio={uploadingAudio} uploadingMedia={uploadingMedia} documentOptions={documentOptions} selectedDocumentId={selectedDocumentId} onDraftChange={onDraftChange} onSendText={onSendText} onUploadAudio={onUploadAudio} onUploadImage={onUploadImage} onUploadVideo={onUploadVideo} onUploadDocument={onUploadDocument} onDocumentChange={onDocumentChange} onSendDocument={onSendDocument} onRecordAudio={onRecordAudio} /></>;
}
