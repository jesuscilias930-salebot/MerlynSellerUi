import { ChangeEvent, FormEvent } from "react";
import type { Chat, DocumentOption, Message } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = { chat: Chat | null; messages: Message[]; draft: string; uploadingAudio: boolean; uploadingMedia: boolean; documentOptions: DocumentOption[]; selectedDocumentId: string; onDraftChange: (value: string) => void; onSendText: (event: FormEvent) => void; onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void; onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void; onDocumentChange: (mediaId: string) => void; onSendDocument: () => void; onRecordAudio: (audio: Blob, filename: string) => Promise<void>; onClose: () => void };

export function ConversationModal({ chat, messages, draft, uploadingAudio, uploadingMedia, documentOptions, selectedDocumentId, onDraftChange, onSendText, onUploadAudio, onUploadImage, onUploadVideo, onDocumentChange, onSendDocument, onRecordAudio, onClose }: Props) {
  if (!chat) return null;
  return <div className="conversation-modal" role="dialog" aria-modal="true" aria-label={`Conversación con ${chat.name || chat.phone_number}`}><div className="modal-backdrop" onClick={onClose} /><div className="modal-content"><ConversationPanel chat={chat} messages={messages} draft={draft} uploadingAudio={uploadingAudio} uploadingMedia={uploadingMedia} documentOptions={documentOptions} selectedDocumentId={selectedDocumentId} onDraftChange={onDraftChange} onSendText={onSendText} onUploadAudio={onUploadAudio} onUploadImage={onUploadImage} onUploadVideo={onUploadVideo} onDocumentChange={onDocumentChange} onSendDocument={onSendDocument} onRecordAudio={onRecordAudio} onClose={onClose} /></div></div>;
}
