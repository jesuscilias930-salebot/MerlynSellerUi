// Recordatorios para escribirle a un cliente y el chat interno «Recordatorios» del inbox.
export type ReminderLine = { kind: "product" | "bundle" | "custom"; id?: number; name: string; quantity: number };
export type ReminderStatus = "scheduled" | "done" | "cancelled";
export type SendMode = "manual" | "template";
export type MappingSource = "reminder.name" | "reminder.products" | "reminder.agreed_date" | "fixed";
export type ReminderMapping = { component: "body" | "header"; position: number; source: MappingSource; value?: string };
export type SaleStatus = "open" | "paid" | "cancelled";
export type Reminder = {
  id: string; contactName: string; phone: string; products: ReminderLine[]; notes: string | null; remindAt: string;
  status: ReminderStatus; notifiedAt: string | null; agreedDate: string | null; sendMode: SendMode; templateId: string | null;
  templateMappings: ReminderMapping[]; conversationId: string | null; sendError: string | null; sentMessageStatus: string | null;
  templateName: string | null; saleId: string | null; saleStatus: SaleStatus | null; saleAmount: string | null; saleControlId: number | null;
  createdAt: string; updatedAt: string;
};
export type ReminderDraft = {
  contactName: string; phone: string; date: string; time: string; products: ReminderLine[]; notes: string;
  agreedDate: string; sendMode: SendMode; templateId: string; templateMappings: ReminderMapping[];
};
export type ReminderPayload = {
  contactName: string; phone: string; products: ReminderLine[]; notes: string | null; remindAt: string;
  agreedDate?: string | null; conversationId?: string | null; mode?: SendMode; delivery?: "sent" | "failed"; error?: string;
};
export type PendingSale = {
  id: string; conversationId: string | null; contactName: string; phone: string; items: ReminderLine[]; status: SaleStatus;
  amount: string | null; paymentMethod: string | null; paidItems: ReminderLine[] | null; controlSaleId: number | null;
  closedAt: string | null; createdAt: string; updatedAt: string;
  reminderId: string | null; reminderAt: string | null; reminderStatus: ReminderStatus | null; reminderNotifiedAt: string | null; reminderMode: SendMode | null;
};
/** Plantilla oficial (lo que usa el formulario). */
export type ReminderTemplate = { id: string; name: string; language: string; status: string; components: { type: string; text?: string }[]; variables: { component: "body" | "header"; position: number }[] };
export type InternalMessage = {
  id: string; kind: "reminder" | "note"; body: string; payload: ReminderPayload | null; createdAt: string; readAt: string | null;
  reminderId: string | null; reminderStatus: ReminderStatus | null; authorName: string | null; authorEmail: string | null;
};

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalInputs = (date: Date) => ({ date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` });

/** Propuesta: mañana a las 10:00. */
export function emptyReminderDraft(now = new Date(), prefill: Partial<ReminderDraft> = {}): ReminderDraft {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
  const inputs = toLocalInputs(tomorrow);
  return { contactName: "", phone: "", ...inputs, products: [], notes: "", agreedDate: inputs.date, sendMode: "manual", templateId: "", templateMappings: [], ...prefill };
}
export const draftFromReminder = (reminder: Reminder): ReminderDraft => ({
  contactName: reminder.contactName, phone: reminder.phone, ...toLocalInputs(new Date(reminder.remindAt)),
  products: reminder.products || [], notes: reminder.notes || "", agreedDate: reminder.agreedDate || "",
  sendMode: reminder.sendMode || "manual", templateId: reminder.templateId || "", templateMappings: reminder.templateMappings || [],
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
  if (draft.agreedDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.agreedDate)) issues.push("La fecha acordada no es válida.");
  if (draft.sendMode === "template" && !draft.templateId) issues.push("Elige la plantilla de WhatsApp para el envío automático.");
  return issues;
}
export const reminderPayload = (draft: ReminderDraft) => ({
  contactName: draft.contactName.trim(), phone: whatsappDigits(draft.phone),
  remindAt: new Date(`${draft.date}T${draft.time}`).toISOString(),
  products: draft.products.map(line => ({ ...line, name: line.name.trim(), quantity: Math.max(1, Math.floor(line.quantity)) })),
  notes: draft.notes.trim() || null,
  agreedDate: draft.agreedDate || null,
  sendMode: draft.sendMode,
  templateId: draft.sendMode === "template" ? draft.templateId || null : null,
  templateMappings: draft.sendMode === "template" ? draft.templateMappings.map(mapping => ({ ...mapping, ...(mapping.source === "fixed" ? { value: (mapping.value || "").trim() } : { value: undefined }) })) : [],
});

// --- Plantilla del recordatorio automático ---
export const SOURCE_LABELS: Record<MappingSource, string> = {
  "reminder.name": "Nombre de la persona", "reminder.products": "Lista de productos", "reminder.agreed_date": "Fecha acordada", fixed: "Texto fijo",
};
/** «sábado, 31 de octubre». */
export const agreedDateLabel = (isoDate?: string | null) =>
  isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";
/** Productos en una sola línea (WhatsApp no admite saltos de línea en variables). */
export const productsInline = (lines: ReminderLine[] | null | undefined) => (lines || []).map(line => `${line.quantity} × ${line.name}`).join(", ");
const orderedVariables = (template: ReminderTemplate) =>
  [...(template.variables || [])].sort((a, b) => (a.component === b.component ? a.position - b.position : a.component === "header" ? -1 : 1));
/** Propuesta: {{1}} nombre, {{2}} productos, {{3}} fecha acordada; las demás, texto fijo. */
export function defaultMappings(template: ReminderTemplate, current: ReminderMapping[] = []): ReminderMapping[] {
  const sources: MappingSource[] = ["reminder.name", "reminder.products", "reminder.agreed_date"];
  return orderedVariables(template).map((variable, index) => {
    const existing = current.find(item => item.component === variable.component && item.position === variable.position);
    return existing || { component: variable.component, position: variable.position, source: sources[index] || "fixed", ...(sources[index] ? {} : { value: "" }) };
  });
}
const valueOf = (mapping: ReminderMapping, draft: Pick<ReminderDraft, "contactName" | "products" | "agreedDate">) =>
  mapping.source === "fixed" ? (mapping.value || "").trim()
    : mapping.source === "reminder.name" ? draft.contactName.trim()
      : mapping.source === "reminder.products" ? productsInline(draft.products)
        : agreedDateLabel(draft.agreedDate);
export function templateIssues(template: ReminderTemplate | undefined, draft: ReminderDraft): string[] {
  if (draft.sendMode !== "template") return [];
  if (!template) return draft.templateId ? ["La plantilla elegida ya no está disponible."] : [];
  if (template.status !== "APPROVED") return [`La plantilla «${template.name}» no está aprobada por WhatsApp.`];
  return orderedVariables(template).flatMap(variable => {
    const mapping = draft.templateMappings.find(item => item.component === variable.component && item.position === variable.position);
    if (!mapping) return [`Elige qué va en {{${variable.position}}}.`];
    if (valueOf(mapping, draft)) return [];
    return [mapping.source === "reminder.products" ? `{{${variable.position}}} usa la lista de productos: agrega al menos uno.`
      : mapping.source === "reminder.agreed_date" ? `{{${variable.position}}} usa la fecha acordada: indícala.`
        : mapping.source === "reminder.name" ? "Escribe el nombre de la persona."
          : `Escribe el texto fijo de {{${variable.position}}}.`];
  });
}
/** Texto de la plantilla con los valores del recordatorio. */
export function templatePreview(template: ReminderTemplate, draft: ReminderDraft) {
  return template.components
    .filter(component => ["HEADER", "BODY", "FOOTER"].includes(String(component.type).toUpperCase()) && component.text)
    .map(component => {
      const type = String(component.type).toLowerCase();
      return String(component.text).replace(/{{(\d+)}}/g, (match, position) => {
        const mapping = draft.templateMappings.find(item => item.component === type && item.position === Number(position));
        return (mapping && valueOf(mapping, draft)) || `[${mapping ? SOURCE_LABELS[mapping.source] : match}]`;
      });
    }).join("\n\n");
}

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

/** Abre la conversación en el inbox de MerlynSeller (lo atiende page.tsx). */
export const OPEN_CHAT_EVENT = "merlyn:open-chat";
export const openConversation = (conversationId: string) => window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: conversationId }));
export const conversationHref = (conversationId: string) => `?chat=${encodeURIComponent(conversationId)}`;
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = { open: "Pendiente de pago", paid: "Pagada", cancelled: "Cerrada sin venta" };
export const MESSAGE_STATUS_LABELS: Record<string, string> = { pending: "En cola de envío", sent: "Enviado", delivered: "Entregado", read: "Leído", failed: "Falló el envío" };
