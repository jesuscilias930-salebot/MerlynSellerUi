import type { Chat } from "./types";

export type DateRange = { from?: string; to?: string };

/** Fecha local (AAAA-MM-DD) del chat: su último mensaje, o su última actualización si no tiene mensajes. */
export function chatDay(chat: Pick<Chat, "lastMessageAt" | "updated_at">): string | null {
  const value = chat.lastMessageAt || chat.updated_at;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Leads de la columna que entran en el rango (inclusive). Sin fechas, todos. */
export function leadsInRange<T extends Pick<Chat, "lastMessageAt" | "updated_at">>(leads: T[], range: DateRange): T[] {
  if (!range.from && !range.to) return leads;
  return leads.filter(lead => {
    const day = chatDay(lead);
    return Boolean(day) && (!range.from || day! >= range.from) && (!range.to || day! <= range.to);
  });
}

const label = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
export function rangeLabel(range: DateRange): string {
  if (range.from && range.to) return range.from === range.to ? `del ${label(range.from)}` : `del ${label(range.from)} al ${label(range.to)}`;
  if (range.from) return `desde el ${label(range.from)}`;
  if (range.to) return `hasta el ${label(range.to)}`;
  return "";
}

/** Día local desplazado n días desde hoy (para los atajos). */
export function dayOffset(days: number, now = new Date()): string {
  const date = new Date(now); date.setDate(date.getDate() + days);
  return chatDay({ lastMessageAt: date.toISOString(), updated_at: date.toISOString() })!;
}
