/** Texto de una cita (respuesta a un mensaje), como en WhatsApp: tipo con icono y, si hay, su texto. */
export function quotedLabel(type: string | null | undefined, body: string | null | undefined, filename?: string | null): string {
  const text = body?.trim() || "";
  switch (type) {
    case "image": return text ? `📷 ${text}` : "📷 Foto";
    case "video": return text ? `🎥 ${text}` : "🎥 Video";
    case "audio": case "voice": return "🎤 Audio";
    case "sticker": return "Sticker";
    case "document": return `📄 ${filename || text || "Documento"}`;
    case "location": return `📍 ${text.split("\n")[0].replace(/^📍\s*/, "") || "Ubicación"}`;
    case "template": return "📋 Plantilla";
    case "interactive": return text.startsWith("{") ? "Mensaje con opciones" : text || "Mensaje con opciones";
    default: return text || "Mensaje";
  }
}

/** Tipos cuya miniatura se muestra en la cita. */
export const quotedThumbnailKind = (type: string | null | undefined, hasMedia: boolean | undefined): "image" | "video" | null =>
  !hasMedia ? null : type === "image" || type === "sticker" ? "image" : type === "video" ? "video" : null;
