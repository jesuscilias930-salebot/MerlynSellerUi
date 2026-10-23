// Recordatorios para escribirle a un cliente y el chat interno «Recordatorios» del inbox.
export type ReminderLine = { kind: "product" | "bundle" | "custom"; id?: number; name: string; quantity: number };
export type ReminderStatus = "scheduled" | "done";
export type Reminder = {
  id: string; contactName: string; phone: string; products: ReminderLine[]; notes: string | null; remindAt: string;
  status: ReminderStatus; notifiedAt: string | null; createdAt: string; updatedAt: string;
};
export type ReminderDraft = { contactName: string; phone: string; date: string; time: string; products: ReminderLine[]; notes: string };
export type ReminderPayload = { contactName: string; phone: string; products: ReminderLine[]; notes: string | null; remindAt: string };
export type InternalMessage = {
  id: string; kind: "reminder" | "note"; body: string; payload: ReminderPayload | null; createdAt: string; readAt: string | null;
  reminderId: string | null; reminderStatus: ReminderStatus | null; authorName: string | null; authorEmail: string | null;
};

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalInputs = (date: Date) => ({ date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` });

/** Propuesta: mañana a las 10:00. */
export function emptyReminderDraft(now = new Date(), prefill: Partial<ReminderDraft> = {}): ReminderDraft {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
  return { contactName: "", phone: "", ...toLocalInputs(tomorrow), products: [], notes: "", ...prefill };
}
export const draftFromReminder = (reminder: Reminder): ReminderDraft => ({
  contactName: reminder.contactName, phone: reminder.phone, ...toLocalInputs(new Date(reminder.remindAt)),
  products: reminder.products || [], notes: reminder.notes || "",
});

/** Solo dígitos con lada de país; 10 dígitos se toman como celular de México (52). */
export function whatsappDigits(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}
/** «+52 272 123 4567» para mostrar. */
export function phoneLabel(phone: string) {
  const digits = whatsappDigits(phone);
  const local = digits.slice(-10);
  if (digits.length < 11) return phone;
  return `+${digits.slice(0, -10)} ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function reminderIssues(draft: ReminderDraft): string[] {
  const issues: string[] = [];
  if (!draft.contactName.trim()) issues.push("Escribe el nombre de la persona.");
  if (!/^\d{8,15}$/.test(whatsappDigits(draft.phone))) issues.push("Escribe un celular válido (10 dígitos o con lada de país).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time) || Number.isNaN(new Date(`${draft.date}T${draft.time}`).getTime())) issues.push("Indica la fecha y la hora del recordatorio.");
  if (draft.products.some(line => !line.name.trim() || !(line.quantity >= 1))) issues.push("Revisa nombre y cantidad de cada producto.");
  return issues;
}
export const reminderPayload = (draft: ReminderDraft) => ({
  contactName: draft.contactName.trim(), phone: whatsappDigits(draft.phone),
  remindAt: new Date(`${draft.date}T${draft.time}`).toISOString(),
  products: draft.products.map(line => ({ ...line, name: line.name.trim(), quantity: Math.max(1, Math.floor(line.quantity)) })),
  notes: draft.notes.trim() || null,
});

/** Enlace a WhatsApp con el número de la persona (y un texto opcional). */
export const whatsappLink = (phone: string, text?: string) =>
  `https://wa.me/${whatsappDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Saludo cordial con su nombre y su pedido, para confirmar. */
export function orderMessage(reminder: { contactName: string; products?: ReminderLine[] | null }) {
  const name = reminder.contactName.trim();
  const lines = (reminder.products || []).map(line => `• ${line.quantity} × ${line.name}`);
  return [
    `¡Hola, ${name}! 😊 Espero que estés muy bien.`,
    "",
    ...(lines.length
      ? ["Te escribo para confirmar tu pedido:", ...lines, "", "¿Me confirmas si lo apartamos para ti?"]
      : ["Te escribo para dar seguimiento a tu pedido. ¿Me confirmas qué te gustaría llevar?"]),
  ].join("\n");
}

export const linesSummary = (lines: ReminderLine[] | null | undefined) => (lines || []).map(line => `${line.quantity} × ${line.name}`).join(", ");
export const reminderTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
export function reminderDay(iso: string, now = new Date()) {
  const date = new Date(iso);
  const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
  const named = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : diff === -1 ? "Ayer" : "";
  return named ? `${named} · ${weekday}` : weekday.replace(/^./, letter => letter.toUpperCase());
}
/** Agrupa por día local, en el orden recibido. */
export function groupRemindersByDay(reminders: Reminder[], now = new Date()) {
  const groups: { key: string; label: string; items: Reminder[] }[] = [];
  for (const reminder of reminders) {
    const key = toLocalInputs(new Date(reminder.remindAt)).date;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(reminder);
    else groups.push({ key, label: reminderDay(reminder.remindAt, now), items: [reminder] });
  }
  return groups;
}
