/** Canales del inbox: WhatsApp, Messenger e Instagram Direct. */
export type Channel = "whatsapp" | "messenger" | "instagram";
type ContactLike = { name?: string | null; phone_number?: string | null; channel?: Channel | null; username?: string | null };

export const CHANNEL_LABELS: Record<Channel, string> = { whatsapp: "WhatsApp", messenger: "Messenger", instagram: "Instagram" };
export const channelOf = (contact: ContactLike): Channel => contact.channel || "whatsapp";
export const isWhatsApp = (contact: ContactLike | null | undefined) => !contact || channelOf(contact) === "whatsapp";

/** Nombre a mostrar: Messenger e Instagram no tienen teléfono, solo un identificador interno. */
export function contactName(contact: ContactLike): string {
  const channel = channelOf(contact);
  if (contact.name?.trim()) return contact.name.trim();
  if (channel === "instagram" && contact.username) return `@${contact.username}`;
  return channel === "whatsapp" ? contact.phone_number || "Contacto" : `Contacto de ${CHANNEL_LABELS[channel]}`;
}

/** Segunda línea: el teléfono en WhatsApp, o el canal (y @usuario) en Messenger/Instagram. */
export function contactDetail(contact: ContactLike): string {
  const channel = channelOf(contact);
  if (channel === "whatsapp") return contact.phone_number || "";
  return [CHANNEL_LABELS[channel], channel === "instagram" && contact.username ? `@${contact.username}` : ""].filter(Boolean).join(" · ");
}

/** Teléfono real (vacío en Messenger/Instagram) para envíos, entregas o enlaces de WhatsApp. */
export const contactPhone = (contact: ContactLike) => (isWhatsApp(contact) ? contact.phone_number || "" : "");
