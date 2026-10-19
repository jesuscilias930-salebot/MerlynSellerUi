export type HoursInterval = { start: string; end: string };
export type HoursDay = { day: number; open: boolean; intervals: HoursInterval[] };
export type AfterHoursRule = { id: string; name: string; examples: string[]; body: string };
export type BusinessHoursConfig = {
  enabled: boolean;
  timezone: string;
  schedule: HoursDay[];
  closedDates: string[];
  defaultMessage: string;
  rules: AfterHoursRule[];
  moveToAttention: boolean;
  continueAutomations: boolean;
};
export type BusinessHoursStatus = { open: boolean; nextOpening: string | null; nextOpeningText: string | null; schedule: string };
export type BusinessHoursPreview = BusinessHoursStatus & { rule: { id: string; name: string } | null; message: string | null };

export const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Lunes primero, como se lee un horario comercial. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const PLACEHOLDERS = [
  { token: "{{proxima_apertura}}", label: "Próxima apertura", example: "mañana a las 8:00" },
  { token: "{{horario}}", label: "Horario", example: "lunes a sábado de 8:00 a 18:00" },
];
export const TIMEZONES = [
  ["America/Mexico_City", "Centro de México (CDMX, Veracruz, Guadalajara)"],
  ["America/Monterrey", "Monterrey"],
  ["America/Cancun", "Quintana Roo"],
  ["America/Chihuahua", "Chihuahua"],
  ["America/Mazatlan", "Pacífico (Sinaloa, Nayarit, BCS)"],
  ["America/Hermosillo", "Sonora"],
  ["America/Tijuana", "Baja California"],
] as const;

const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** Revisión rápida en pantalla; el servidor valida de nuevo al guardar. */
export function scheduleIssues(config: BusinessHoursConfig): string[] {
  const issues: string[] = [];
  for (const day of config.schedule) {
    if (!day.open) continue;
    const name = DAY_LABELS[day.day].toLowerCase();
    if (!day.intervals.length) issues.push(`Agrega un horario al ${name} o márcalo como cerrado.`);
    const sorted = [...day.intervals].sort((a, b) => minutes(a.start) - minutes(b.start));
    sorted.forEach((interval, index) => {
      if (!interval.start || !interval.end) issues.push(`Completa las horas del ${name}.`);
      else if (minutes(interval.end) <= minutes(interval.start)) issues.push(`El ${name}: la hora de cierre debe ser después de la de apertura.`);
      else if (index && minutes(interval.start) < minutes(sorted[index - 1].end)) issues.push(`El ${name} tiene horarios que se enciman.`);
    });
  }
  if (config.enabled && !config.defaultMessage.trim()) issues.push("Escribe el mensaje general fuera de horario.");
  config.rules.forEach((rule, index) => {
    if (!rule.name.trim() || !rule.body.trim() || !rule.examples.some(example => example.trim())) issues.push(`Completa nombre, frases y mensaje del mensaje ${index + 1}.`);
  });
  return [...new Set(issues)];
}

/** Limpia el borrador antes de enviarlo. */
export function toHoursPayload(config: BusinessHoursConfig): BusinessHoursConfig {
  return {
    ...config,
    defaultMessage: config.defaultMessage.trim(),
    schedule: config.schedule.map(day => ({ ...day, intervals: day.open ? day.intervals : [] })),
    rules: config.rules.map(rule => ({ ...rule, name: rule.name.trim(), body: rule.body.trim(), examples: rule.examples.map(example => example.trim()).filter(Boolean) })),
  };
}

export const blankRule = (): AfterHoursRule => ({ id: `regla_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: "", examples: [], body: "" });
export const ruleExamples: AfterHoursRule[] = [
  { id: "precios", name: "Pregunta precios", examples: ["precio", "precios", "cuánto cuesta", "lista de precios", "cotización"], body: "¡Hola! 👋 Ahorita estamos fuera de horario. Te compartimos precios {{proxima_apertura}}. Mientras, cuéntanos qué paquete te interesa para tenerlo listo." },
  { id: "envios", name: "Pregunta por envíos", examples: ["hacen envíos", "envío a", "mandan a", "cuánto cuesta el envío"], body: "¡Hola! Sí enviamos a todo México 📦. Estamos fuera de horario; {{proxima_apertura}} te cotizamos el envío. Déjanos tu código postal." },
];
