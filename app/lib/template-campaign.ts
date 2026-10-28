import type { WhatsAppTemplate } from "./types";

/** Vista previa del texto de la plantilla con lo que irá en cada variable. */
export function templateCampaignPreview(template: Pick<WhatsAppTemplate, "components" | "mappings">, manualValues: Record<string, string>) {
  return template.components
    .filter(component => ["HEADER", "BODY", "FOOTER"].includes(String(component.type).toUpperCase()) && component.text)
    .map(component => {
      const type = String(component.type).toLowerCase();
      return String(component.text).replace(/{{(\d+)}}/g, (match, position) => {
        const mapping = template.mappings.find(item => item.component === type && item.position === Number(position));
        if (!mapping) return `[falta configurar ${match}]`;
        if (mapping.source === "contact.name") return "[nombre del cliente]";
        if (mapping.source === "contact.phone") return "[teléfono del cliente]";
        if (mapping.source === "fixed") return mapping.value || match;
        return manualValues[`${mapping.component}:${mapping.position}`]?.trim() || `[${mapping.label || match}]`;
      });
    }).join("\n\n");
}

/** Problemas antes de enviar: variables sin configurar o valores manuales vacíos. */
export function templateCampaignIssues(template: Pick<WhatsAppTemplate, "variables" | "mappings" | "components"> | undefined, manualValues: Record<string, string>): string[] {
  if (!template) return ["Elige una plantilla aprobada."];
  const issues: string[] = [];
  if (template.components.some(component => String(component.type).toUpperCase() === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(String((component as { format?: string }).format || "").toUpperCase())))
    issues.push("Esta plantilla lleva imagen, video o documento en el encabezado; por ahora solo se pueden enviar de forma masiva plantillas de texto.");
  for (const variable of template.variables) {
    const mapping = template.mappings.find(item => item.component === variable.component && item.position === variable.position);
    if (!mapping) issues.push(`Configura la variable {{${variable.position}}} en WhatsApp → Plantillas oficiales.`);
    else if (mapping.source === "manual" && !manualValues[`${mapping.component}:${mapping.position}`]?.trim()) issues.push(`Escribe el valor de «${mapping.label || `{{${variable.position}}}`}».`);
  }
  return issues;
}
