/** Horario del remarketing automático: pausa y reanuda (hora del negocio). */
export type RemarketingSchedule = { isActive: boolean; pauseAt: string; resumeAt: string; deferCampaigns: boolean; configured?: boolean };

/** «21:00» → «9:00 p. m.» */
export function timeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const suffix = hours < 12 ? "a. m." : "p. m.";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export const scheduleSummary = (schedule: RemarketingSchedule) => schedule.isActive
  ? `Pausa de ${timeLabel(schedule.pauseAt)} a ${timeLabel(schedule.resumeAt)}`
  : "Sin pausa: el remarketing automático sale a cualquier hora";

/** Hora local de un envío programado: «9:00 a. m.» (y el día si no es hoy). */
export function scheduledLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = timeLabel(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  return sameDay ? time : date.toDateString() === tomorrow.toDateString() ? `mañana ${time}` : `${date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} ${time}`;
}
