import { ChangeEvent, FormEvent } from "react";
import type { AutomationIntent, Chat, CtaUrlMessage, DocumentOption, EntrepreneurPackage, LeadColumn, Message, QuickReply, SavedSticker } from "../lib/types";
import { ConversationPanel } from "./ConversationPanel";

type Props = {
  chat: Chat | null; messages: Message[]; draft: string; uploadingAudio: boolean; uploadingMedia: boolean;
  documentOptions: DocumentOption[]; selectedDocumentId: string; documentCaption: string;
  entrepreneurPackages: EntrepreneurPackage[]; quickReplies: QuickReply[]; stickers: SavedSticker[];
  replyToMessage: Message | null; columns: LeadColumn[];
  onDraftChange: (value: string) => void; onSendQuickReplyCta: (templateId: string) => Promise<void>; onSendText: (event: FormEvent) => void;
  onReplyToChange: (message: Message | null) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void; onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentChange: (mediaId: string) => void; onDocumentCaptionChange: (caption: string) => void; onSendDocument: () => void;
  onSendCtaUrl: (data: CtaUrlMessage) => Promise<void>; onSendEntrepreneurPackages: (selection: { packageIds?: string[]; imageIds?: string[] }) => Promise<void>;
  onSendSticker: (stickerId: string) => Promise<void>; onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onAutoReplyChange: (enabled: boolean) => void; onScenarioChange: (enabled: boolean) => void;
  automationIntents: AutomationIntent[]; onLearnIntent: (messageId: string, intentId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>; onMoveLead: (columnId: string) => Promise<void>;
  onOpenShipping: () => void;
  onDeleteConversation: () => void; onClose: () => void;
};

export function ConversationModal(props: Props) {
  const { chat, onClose, ...panelProps } = props;
  if (!chat) return null;
  return <div className="conversation-modal" role="dialog" aria-modal="true" aria-label={`Conversación con ${chat.name || chat.phone_number}`}>
    <div className="modal-backdrop" onClick={onClose} />
    <div className="modal-content"><ConversationPanel chat={chat} {...panelProps} onClose={onClose} /></div>
  </div>;
}
