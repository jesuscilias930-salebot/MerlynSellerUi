/** Qué envió el cliente cuando WhatsApp no comparte el contenido con apps de empresa, y qué hacer. */
const KINDS: Record<string, string> = {
  poll_creation: "📊 El cliente creó una encuesta",
  poll_update: "📊 El cliente votó en una encuesta",
  edit: "✏️ El cliente editó un mensaje anterior",
  album: "🖼️ El cliente envió un álbum de fotos",
  pin: "📌 El cliente fijó un mensaje",
  keep_in_chat: "⏳ El cliente conservó un mensaje temporal",
  group_invite: "👥 El cliente envió una invitación a un grupo",
  gif: "🎞️ El cliente envió un GIF",
  link_preview: "🔗 El cliente envió un enlace con vista previa",
  media_placeholder: "📎 El cliente envió un archivo que aún no está disponible",
  location: "📍 El cliente compartió una ubicación (posiblemente en tiempo real)",
  reaction: "😊 El cliente reaccionó a un mensaje",
  order: "🛒 El cliente envió un pedido",
  product: "🛍️ El cliente compartió un producto",
};

export function unsupportedMessageInfo(meta?: { type?: string; code?: number } | null): { title: string; hint: string } {
  if (meta?.code === 131060) return {
    title: "⌛ Mensaje aún no disponible",
    hint: "Suele pasar con el primer mensaje desde un anuncio. Revisa el chat en el celular o espera su siguiente mensaje.",
  };
  const kind = meta?.type ? KINDS[meta.type] : undefined;
  return {
    title: kind || "⚠️ WhatsApp no comparte este mensaje con MerlynSeller",
    hint: kind
      ? "WhatsApp no envía su contenido a apps de empresa. Revísalo en el celular o pídele que lo mande como mensaje normal."
      : "Puede ser una foto o video de «ver una vez», una encuesta, un mensaje editado o un evento. Revísalo en el celular o pídele al cliente que lo reenvíe como mensaje normal.",
  };
}
