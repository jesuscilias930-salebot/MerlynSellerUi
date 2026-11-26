import type { WhatsAppTemplate } from "./types";

/** Escenario de plantilla: solo lo inicia una respuesta a esta plantilla aprobada de Meta. */
export type ScenarioTemplateTrigger = { templateId: string; templateName: string };

type ButtonsComponent = { type: string; buttons?: { type?: string; text?: string }[] };

/** Textos de los botones de respuesta rápida de la plantilla (lo que el cliente puede tocar). */
export function templateQuickReplies(template?: Pick<WhatsAppTemplate, "components"> | null): string[] {
  const buttons = (template?.components || []).flatMap(component => (component as ButtonsComponent).type?.toUpperCase() === "BUTTONS" ? (component as ButtonsComponent).buttons || [] : []);
  return [...new Set(buttons.filter(button => button.type?.toUpperCase() === "QUICK_REPLY" && button.text?.trim()).map(button => button.text!.trim()))];
}

/** Agrega una frase (si no está) al texto de frases, una por línea. */
export function addPhrase(text: string, phrase: string): string {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  return lines.some(line => line.toLowerCase() === phrase.trim().toLowerCase()) ? lines.join("\n") : [...lines, phrase.trim()].join("\n");
}

/** Plantillas que se pueden elegir: aprobadas, más la ya elegida aunque haya cambiado de estado. */
export const selectableTemplates = (templates: WhatsAppTemplate[], current?: ScenarioTemplateTrigger | null) =>
  templates.filter(template => template.status === "APPROVED" || template.id === current?.templateId);
