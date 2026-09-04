import { ChangeEvent, FormEvent } from "react";
import { initials } from "../lib/format";
import type { AutomationIntent, Chat, ConversationFilter, DocumentOption, EntrepreneurPackage, LeadColumn, Message, QuickReply, SavedSticker } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = {
  chats: Chat[];
  columns: LeadColumn[];
  filter: ConversationFilter;
  chat: Chat | null;
  messages: Message[];
  number: string;
  draft: string;
  uploadingAudio: boolean; uploadingMedia: boolean; documentOptions: DocumentOption[]; selectedDocumentId: string; documentCaption: string; entrepreneurPackages: EntrepreneurPackage[]; quickReplies: QuickReply[]; stickers: SavedSticker[];
  onNumberChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onCreate: (event: FormEvent) => void;
  onOpen: (chat: Chat) => void;
  onFilterChange: (filter: ConversationFilter) => void;
  onSendText: (event: FormEvent) => void; replyToMessage: Message | null; onReplyToChange: (message: Message | null) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void; onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void; onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void; onDocumentChange: (mediaId: string) => void; onDocumentCaptionChange: (caption: string) => void; onSendDocument: () => void; onSendEntrepreneurPackages: (packageIds: string[]) => Promise<void>;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onSendSticker: (stickerId: string) => Promise<void>;
  onAutoReplyChange: (enabled: boolean) => void;
  automationIntents: AutomationIntent[];
  onLearnIntent: (messageId: string, intentId: string) => Promise<void>;
  onDeleteConversation: () => void;
};

export function Inbox({ chats, columns, filter, chat, messages, number, draft, uploadingAudio, uploadingMedia, documentOptions, selectedDocumentId, documentCaption, entrepreneurPackages, quickReplies, stickers, onNumberChange, onDraftChange, onCreate, onOpen, onFilterChange, onSendText, replyToMessage, onReplyToChange, onUploadAudio, onUploadImage, onUploadVideo, onUploadDocument, onDocumentChange, onDocumentCaptionChange, onSendDocument, onSendEntrepreneurPackages, onRecordAudio, onSendSticker, onAutoReplyChange, automationIntents, onLearnIntent, onDeleteConversation }: Props) {
  return <><section className="list"><header><div><p>BANDEJA</p><h2>Conversaciones</h2></div><b>＋</b></header><div className="inbox-filter"><select value={filter} onChange={(event) => onFilterChange(event.target.value as ConversationFilter)} aria-label="Filtrar conversaciones"><option value="all">Todos</option><option value="unread">No leídos</option><option value="needs-response">Pendientes de respuesta</option>{columns.map((column) => <option key={column.id} value={`column:${column.id}`}>Columna: {column.name}</option>)}</select></div><form onSubmit={onCreate}><input value={number} onChange={(event) => onNumberChange(event.target.value)} placeholder="Número con código de país" /><button>Nuevo</button></form><div className="rows">{chats.length === 0 && <em>No hay conversaciones para este filtro.</em>}{chats.map((item) => <button onClick={() => onOpen(item)} className={`${item.id === chat?.id ? "row active" : "row"}${item.unreadCount > 0 ? " has-unread" : ""}`} key={item.id}><b>{initials(item.name || item.phone_number)}</b><span><strong>{item.name || item.phone_number}</strong><small>{item.phone_number} · {item.last_message || "Sin mensajes aún"}</small></span>{item.unreadCount > 0 && <b className="unread-badge" aria-label={`${item.unreadCount} mensajes pendientes`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</b>}</button>)}</div></section><ConversationPanel chat={chat} messages={messages} draft={draft} uploadingAudio={uploadingAudio} uploadingMedia={uploadingMedia} documentOptions={documentOptions} selectedDocumentId={selectedDocumentId} documentCaption={documentCaption} entrepreneurPackages={entrepreneurPackages} quickReplies={quickReplies} stickers={stickers} onDraftChange={onDraftChange} onSendText={onSendText} replyToMessage={replyToMessage} onReplyToChange={onReplyToChange} onUploadAudio={onUploadAudio} onUploadImage={onUploadImage} onUploadVideo={onUploadVideo} onUploadDocument={onUploadDocument} onDocumentChange={onDocumentChange} onDocumentCaptionChange={onDocumentCaptionChange} onSendDocument={onSendDocument} onSendEntrepreneurPackages={onSendEntrepreneurPackages} onRecordAudio={onRecordAudio} onSendSticker={onSendSticker} onAutoReplyChange={onAutoReplyChange} automationIntents={automationIntents} onLearnIntent={onLearnIntent} onDeleteConversation={onDeleteConversation} /></>;
}
