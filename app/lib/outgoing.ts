import { createContext } from "react";
import type { Message } from "./types";

/** Mensaje que salió del composer y aún no confirma el servidor (como el reloj de WhatsApp). */
export type OutgoingItem = {
  id: string;
  chatId: string;
  kind: "image" | "text" | "video";
  createdAt: string;
  status: "sending" | "failed";
  file?: File;
  previewUrl?: string;
  body?: string;
  replyToMessageId?: string;
  error?: string;
  /** Videos: avance de la subida (checking → uploading % → processing). */
  progress?: { phase: "checking" | "uploading" | "processing"; fraction: number };
};

export type OutgoingActions = { retry: (id: string) => void; discard: (id: string) => void };
export const OutgoingContext = createContext<OutgoingActions | null>(null);

export const LOCAL_PREFIX = "local-";
export const isLocalMessage = (message: Pick<Message, "id">) => message.id.startsWith(LOCAL_PREFIX);

/** Convierte lo que está en envío en burbujas del chat, al final y en el orden en que se enviaron. */
export function outgoingMessages(items: OutgoingItem[], chatId: string | undefined | null): Message[] {
  if (!chatId) return [];
  return items.filter(item => item.chatId === chatId).map(item => ({
    id: `${LOCAL_PREFIX}${item.id}`,
    direction: "outbound",
    type: item.kind,
    body: item.body || null,
    media_id: null,
    status: item.status === "failed" ? "failed" : "pending",
    error_code: item.error || null,
    created_at: item.createdAt,
    localPreviewUrl: item.previewUrl,
    ...(item.progress ? { localProgress: item.progress } : {}),
  }));
}

export const withOutgoing = (messages: Message[], items: OutgoingItem[], chatId: string | undefined | null) => {
  const local = outgoingMessages(items, chatId);
  return local.length ? [...messages, ...local] : messages;
};

/** Un envío del composer: una burbuja por foto (el texto va como pie de la primera) o solo el texto. */
export function outgoingFromComposer(input: { chatId: string; text: string; images: { file: File; previewUrl: string }[]; replyToMessageId?: string; now?: Date; makeId?: () => string }): OutgoingItem[] {
  const now = (input.now || new Date()).toISOString();
  const makeId = input.makeId || (() => crypto.randomUUID());
  const text = input.text.trim();
  if (input.images.length) return input.images.map((image, index) => ({
    id: makeId(), chatId: input.chatId, kind: "image", createdAt: now, status: "sending", file: image.file, previewUrl: image.previewUrl,
    ...(index === 0 && text ? { body: text } : {}),
  }));
  return text ? [{ id: makeId(), chatId: input.chatId, kind: "text", createdAt: now, status: "sending", body: input.text, ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}) }] : [];
}
