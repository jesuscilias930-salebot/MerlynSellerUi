import { ChangeEvent, FormEvent } from "react";
import type { Chat, Message } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = { chat: Chat | null; messages: Message[]; draft: string; uploadingAudio: boolean; onDraftChange: (value: string) => void; onSendText: (event: FormEvent) => void; onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onRecordAudio: (audio: Blob, filename: string) => Promise<void>; onClose: () => void };

export function ConversationModal({ chat, messages, draft, uploadingAudio, onDraftChange, onSendText, onUploadAudio, onRecordAudio, onClose }: Props) {
  if (!chat) return null;
  return <div className="conversation-modal" role="dialog" aria-modal="true" aria-label={`Conversación con ${chat.name || chat.phone_number}`}><div className="modal-backdrop" onClick={onClose} /><div className="modal-content"><ConversationPanel chat={chat} messages={messages} draft={draft} uploadingAudio={uploadingAudio} onDraftChange={onDraftChange} onSendText={onSendText} onUploadAudio={onUploadAudio} onRecordAudio={onRecordAudio} onClose={onClose} /></div></div>;
}
