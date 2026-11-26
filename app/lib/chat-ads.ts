// chatAd: según el primer mensaje del cliente, su chat muestra botones con imágenes elegidas y un texto.
export type ChatAdButton = { label: string; text?: string; imageIds: string[] };
export type ChatAd = { id: string; name: string; isActive: boolean; triggerExamples: string[]; buttons: ChatAdButton[]; position: number; updatedAt?: string };
/** Lo que recibe un chat: solo botones con imágenes que aún existen. */
export type ChatAdForChat = { id: string; name: string; buttons: ChatAdButton[] };

export const CHAT_AD_MAX_BUTTONS = 8;
export const CHAT_AD_MAX_IMAGES = 10;
export const CHAT_AD_LABEL_MAX = 24;

export type ChatAdButtonDraft = { label: string; text: string; imageIds: string[] };
export type ChatAdDraft = { id?: string; name: string; isActive: boolean; triggers: string; buttons: ChatAdButtonDraft[] };

export const emptyChatAdButton = (): ChatAdButtonDraft => ({ label: "", text: "", imageIds: [] });
export const chatAdDraft = (ad?: ChatAd | null): ChatAdDraft => ad
  ? { id: ad.id, name: ad.name, isActive: ad.isActive, triggers: ad.triggerExamples.join("\n"), buttons: ad.buttons.map(button => ({ label: button.label, text: button.text || "", imageIds: [...button.imageIds] })) }
  : { name: "", isActive: true, triggers: "", buttons: [emptyChatAdButton()] };

/** Una frase por línea, sin vacías ni repetidas. */
export const triggerLines = (text: string) => [...new Set(text.split("\n").map(line => line.trim()).filter(line => line.length >= 2))];

export type ChatAdPayload = { name: string; isActive: boolean; triggerExamples: string[]; buttons: ChatAdButton[] };
/** Valida el borrador con los mismos límites del backend y arma lo que se guarda. */
export function chatAdPayload(draft: ChatAdDraft): { payload: ChatAdPayload } | { error: string } {
  const name = draft.name.trim();
  if (!name) return { error: "Ponle nombre al chatAd." };
  const triggerExamples = triggerLines(draft.triggers);
  if (!triggerExamples.length) return { error: "Agrega al menos una frase que lo inicie (una por línea)." };
  if (triggerExamples.length > 30) return { error: "Puedes tener hasta 30 frases." };
  const used = draft.buttons.filter(button => button.label.trim() || button.text.trim() || button.imageIds.length);
  if (!used.length) return { error: "Agrega al menos un botón." };
  if (used.length > CHAT_AD_MAX_BUTTONS) return { error: `Puedes tener hasta ${CHAT_AD_MAX_BUTTONS} botones.` };
  const buttons: ChatAdButton[] = [];
  for (const [index, button] of used.entries()) {
    const label = button.label.trim();
    if (!label) return { error: `Ponle nombre al botón ${index + 1}.` };
    if (label.length > CHAT_AD_LABEL_MAX) return { error: `El nombre del botón ${index + 1} puede tener hasta ${CHAT_AD_LABEL_MAX} caracteres.` };
    const imageIds = [...new Set(button.imageIds)];
    if (!imageIds.length) return { error: `Elige al menos una imagen para «${label}».` };
    if (imageIds.length > CHAT_AD_MAX_IMAGES) return { error: `«${label}» puede llevar hasta ${CHAT_AD_MAX_IMAGES} imágenes.` };
    const text = button.text.trim();
    buttons.push({ label, ...(text ? { text } : {}), imageIds });
  }
  return { payload: { name, isActive: draft.isActive, triggerExamples, buttons } };
}
