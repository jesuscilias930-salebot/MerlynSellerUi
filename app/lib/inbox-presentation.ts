type InboxContact = { name: string | null; phone_number: string; username?: string | null; channel?: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const dateOf = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const zone = "America/Mexico_City";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const fullDateFormatter = new Intl.DateTimeFormat("es-MX", { timeZone: zone, day: "numeric", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("es-MX", { timeZone: zone, day: "2-digit", month: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("es-MX", { timeZone: zone, hour: "2-digit", minute: "2-digit" });

export function filterInboxContacts<T extends InboxContact>(chats: T[], search: string): T[] {
  const query = normalize(search);
  const digits = query.replace(/[^0-9]/g, "");
  if (!query) return chats;
  return chats.filter(chat => normalize(`${chat.name || ""} ${chat.phone_number} ${chat.username || ""} ${chat.channel || ""}`).includes(query)
    || (/^[+\d\s()-]+$/.test(query) && digits.length > 0 && chat.phone_number.replace(/\D/g, "").includes(digits)));
}

export function messageDayKey(value: string): string {
  const date = dateOf(value);
  if (!date) return "unknown";
  return dayFormatter.format(date);
}

export function messageDayLabel(value: string, now = new Date()): string {
  const date = dateOf(value);
  if (!date) return "Sin fecha";
  const today = messageDayKey(now.toISOString());
  const yesterday = messageDayKey(new Date(now.getTime() - 86400000).toISOString());
  const day = messageDayKey(value);
  if (day === today) return "Hoy";
  if (day === yesterday) return "Ayer";
  return fullDateFormatter.format(date);
}

export function inboxTimestamp(value: string, now = new Date()): string {
  const date = dateOf(value);
  if (!date) return "";
  if (messageDayKey(value) === messageDayKey(now.toISOString()))
    return timeFormatter.format(date);
  if (messageDayLabel(value, now) === "Ayer") return "Ayer";
  return shortDateFormatter.format(date);
}

export function messageTime(value: string): string {
  const date = dateOf(value);
  return date ? timeFormatter.format(date) : "";
}

export function deliveryLabel(status: string): string {
  return ({ read: "Leído", delivered: "Entregado", sent: "Enviado", failed: "No se pudo enviar" } as Record<string, string>)[status] || "En proceso de envío";
}
