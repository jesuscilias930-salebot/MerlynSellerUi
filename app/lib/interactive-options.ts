import type { InteractiveOption, InteractiveOptionsFormat, InteractiveOptionsMessage } from "./types";

// Límites de Meta para mensajes interactivos (deben coincidir con el backend).
export const OPTION_LIMITS = {
  buttons: 3, rows: 10, buttonTitle: 20, rowTitle: 24, rowDescription: 72,
  body: 1024, header: 60, footer: 60, listButton: 20, sectionTitle: 24,
} as const;
export const DEFAULT_LIST_BUTTON = "Ver opciones";

const length = (value?: string) => [...(value || "").trim()].length;

export const fitsButtons = (options: InteractiveOption[]) =>
  options.length <= OPTION_LIMITS.buttons && options.every(option => !option.description?.trim() && length(option.title) <= OPTION_LIMITS.buttonTitle);

export const resolveFormat = (format: InteractiveOptionsFormat | undefined, options: InteractiveOption[]): "buttons" | "list" =>
  !format || format === "auto" ? (fitsButtons(options) ? "buttons" : "list") : format;

/** Convierte líneas tipo "Caricatura 50 pares · $446.50" en opciones (título · descripción). */
export function parseOptionLines(input: string): InteractiveOption[] {
  return input.split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map(line => {
      const [title, ...rest] = line.split(/\s*[·|]\s*/);
      const description = rest.join(" · ").trim();
      return description ? { title: title.trim(), description } : { title: title.trim() };
    });
}

/** Errores en español; lista vacía = listo para enviar. */
export function validateOptionsMessage(message: InteractiveOptionsMessage): string[] {
  const errors: string[] = [];
  const options = message.options.filter(option => option.title.trim() || option.description?.trim());
  const format = resolveFormat(message.format, options);
  if (!message.body.trim()) errors.push("Escribe el texto del mensaje.");
  if (length(message.body) > OPTION_LIMITS.body) errors.push(`El mensaje admite máximo ${OPTION_LIMITS.body} caracteres.`);
  if (length(message.header) > OPTION_LIMITS.header) errors.push(`El encabezado admite máximo ${OPTION_LIMITS.header} caracteres.`);
  if (length(message.footer) > OPTION_LIMITS.footer) errors.push(`El pie admite máximo ${OPTION_LIMITS.footer} caracteres.`);
  if (!options.length) errors.push("Agrega al menos una opción.");
  if (options.length > OPTION_LIMITS.rows) errors.push(`WhatsApp permite máximo ${OPTION_LIMITS.rows} opciones.`);
  const seen = new Set<string>();
  options.forEach((option, index) => {
    const title = option.title.trim();
    if (!title) errors.push(`La opción ${index + 1} necesita un texto.`);
    if (length(title) > OPTION_LIMITS.rowTitle) errors.push(`«${title}» supera ${OPTION_LIMITS.rowTitle} caracteres. Pasa el precio a la descripción.`);
    if (length(option.description) > OPTION_LIMITS.rowDescription) errors.push(`La descripción de la opción ${index + 1} supera ${OPTION_LIMITS.rowDescription} caracteres.`);
    const key = title.toLocaleLowerCase("es");
    if (title && seen.has(key)) errors.push(`«${title}» está repetida.`);
    seen.add(key);
  });
  if (message.format === "buttons" && !fitsButtons(options)) errors.push(`Los botones admiten máximo ${OPTION_LIMITS.buttons} opciones de ${OPTION_LIMITS.buttonTitle} caracteres y sin descripción. Usa lista.`);
  if (format === "list" && length(message.buttonText) > OPTION_LIMITS.listButton) errors.push(`El botón de la lista admite máximo ${OPTION_LIMITS.listButton} caracteres.`);
  if (format === "list" && length(message.sectionTitle) > OPTION_LIMITS.sectionTitle) errors.push(`El título de la sección admite máximo ${OPTION_LIMITS.sectionTitle} caracteres.`);
  return errors;
}

/** Limpia el borrador para enviarlo a la API. */
export function toOptionsPayload(message: InteractiveOptionsMessage): InteractiveOptionsMessage {
  const options = message.options
    .filter(option => option.title.trim())
    .map(option => ({ ...(option.id ? { id: option.id } : {}), title: option.title.trim(), ...(option.description?.trim() ? { description: option.description.trim() } : {}) }));
  const format = resolveFormat(message.format, options);
  const clean = (value?: string) => value?.trim() || undefined;
  return {
    format: message.format || "auto",
    header: clean(message.header), body: message.body.trim(), footer: clean(message.footer),
    ...(format === "list" ? { buttonText: clean(message.buttonText), sectionTitle: clean(message.sectionTitle) } : {}),
    options,
  };
}

export const emptyOptionsMessage = (): InteractiveOptionsMessage => ({
  format: "auto", header: "", body: "", footer: "", buttonText: DEFAULT_LIST_BUTTON, sectionTitle: "", options: [{ title: "" }, { title: "" }],
});

export const packageOptionsExample = (): InteractiveOptionsMessage => ({
  format: "auto",
  header: "Paquetes de mayoreo",
  body: "¿Qué paquete te interesa? Toca «Ver paquetes» y elige una opción.",
  footer: "Precios sin envío",
  buttonText: "Ver paquetes",
  sectionTitle: "Paquetes",
  options: parseOptionLines([
    "Caricatura 50 pares · $446.50",
    "Caricatura 100 pares · $882",
    "Caricatura 200 pares · $1,728",
    "Caricatura 500 pares · $4,120",
    "Deportivo Pro 450 pares · $3,999",
    "Ayúdame a elegir",
  ].join("\n")),
});
