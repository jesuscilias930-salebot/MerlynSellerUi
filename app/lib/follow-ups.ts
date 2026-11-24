/** Seguimientos automáticos por columna (hasta 3 pasos). */
export type FollowUpStep = { waitMinutes: number; text?: string; imageIds?: string[]; videoId?: string | null; templateId?: string | null };
export type FollowUpSequence = { id: string; columnId: string; isActive: boolean; activatedAt: string | null; steps: FollowUpStep[]; finalColumnId: string | null; activeCount?: number };
export type FollowUpStatus = { enabled: false } | { enabled: true; columnName: string; totalSteps: number; stepIndex: number; status: "active" | "completed" | "stopped"; stoppedReason: string | null; nextAt: string | null; waitingForCustomer: boolean };

export const MAX_FOLLOW_UP_STEPS = 3;
export type WaitUnit = "minutes" | "hours" | "days";
const FACTOR: Record<WaitUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** 1440 → { value: 1, unit: "days" }; 90 → { value: 90, unit: "minutes" }. */
export function splitWait(minutes: number): { value: number; unit: WaitUnit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}
export const toMinutes = (value: number, unit: WaitUnit) => Math.round(value * FACTOR[unit]);

export function waitLabel(minutes: number): string {
  const { value, unit } = splitWait(minutes);
  if (unit === "days") return `${value} día${value === 1 ? "" : "s"}`;
  if (unit === "hours") return `${value} h`;
  return `${value} min`;
}

/** «1 h → 1 día → 3 días · luego a Frío». */
export function sequenceSummary(sequence: Pick<FollowUpSequence, "steps" | "finalColumnId">, columnName?: (id: string) => string | undefined): string {
  const steps = sequence.steps.map(step => waitLabel(step.waitMinutes)).join(" → ");
  const final = sequence.finalColumnId ? columnName?.(sequence.finalColumnId) : undefined;
  return `${steps}${final ? ` · luego a ${final}` : ""}`;
}

/** Problemas a corregir antes de guardar (los mismos que valida el servidor). */
export function stepIssues(steps: FollowUpStep[]): string[] {
  const issues: string[] = [];
  if (!steps.length) issues.push("Agrega al menos un paso.");
  if (steps.length > MAX_FOLLOW_UP_STEPS) issues.push(`Hasta ${MAX_FOLLOW_UP_STEPS} pasos.`);
  steps.forEach((step, index) => {
    if (!Number.isFinite(step.waitMinutes) || step.waitMinutes < 30) issues.push(`Paso ${index + 1}: la espera mínima es de 30 minutos.`);
    else if (step.waitMinutes > 43200) issues.push(`Paso ${index + 1}: la espera máxima es de 30 días.`);
    if (!step.text?.trim() && !step.imageIds?.length && !step.videoId && !step.templateId) issues.push(`Paso ${index + 1}: escribe un mensaje o elige fotos, video o plantilla.`);
    if ((step.imageIds?.length || 0) > 10) issues.push(`Paso ${index + 1}: hasta 10 fotos.`);
  });
  return issues;
}

/** Texto del estado del seguimiento de un chat. */
export function followUpStatusLabel(status: FollowUpStatus, now = Date.now()): string | null {
  if (!status.enabled) return null;
  if (status.status === "stopped") return `Seguimiento detenido${status.stoppedReason ? `: ${status.stoppedReason}` : ""}`;
  if (status.status === "completed") return `Seguimiento terminado (${status.totalSteps} de ${status.totalSteps})`;
  if (status.waitingForCustomer) return `Seguimiento en pausa: el cliente escribió (paso ${Math.min(status.stepIndex + 1, status.totalSteps)} de ${status.totalSteps})`;
  if (!status.nextAt) return `Seguimiento activo · paso ${status.stepIndex + 1} de ${status.totalSteps}`;
  const minutes = Math.round((new Date(status.nextAt).getTime() - now) / 60000);
  const when = minutes <= 0 ? "en breve" : minutes < 60 ? `en ${minutes} min` : minutes < 1440 ? `en ${Math.round(minutes / 60)} h` : `en ${Math.round(minutes / 1440)} día${Math.round(minutes / 1440) === 1 ? "" : "s"}`;
  return `Seguimiento: paso ${status.stepIndex + 1} de ${status.totalSteps} ${when}`;
}
