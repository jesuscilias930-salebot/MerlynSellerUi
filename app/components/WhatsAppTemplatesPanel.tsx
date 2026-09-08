"use client";

import type { WhatsAppTemplate, WhatsAppTemplateMapping } from "../lib/types";

const sourceOptions: { value: WhatsAppTemplateMapping["source"]; label: string }[] = [
  { value: "contact.name", label: "Cliente · Nombre" },
  { value: "contact.phone", label: "Cliente · Teléfono" },
  { value: "fixed", label: "Valor fijo" },
  { value: "manual", label: "Pedir al enviar" },
];

export function WhatsAppTemplatesPanel({ templates, syncing, onSync, onSaveMappings }: { templates: WhatsAppTemplate[]; syncing: boolean; onSync: () => Promise<void>; onSaveMappings: (templateId: string, mappings: WhatsAppTemplateMapping[]) => Promise<void> }) {
  const approved = templates.filter(template => template.status === "APPROVED");
  const mappingFor = (template: WhatsAppTemplate, variable: WhatsAppTemplate["variables"][number]) => template.mappings.find(item => item.component === variable.component && item.position === variable.position) || { ...variable, source: "manual" as const, label: `Valor para {{${variable.position}}}` };
  const update = (template: WhatsAppTemplate, variable: WhatsAppTemplate["variables"][number], changes: Partial<WhatsAppTemplateMapping>) => {
    const current = mappingFor(template, variable);
    const rest = template.mappings.filter(item => !(item.component === variable.component && item.position === variable.position));
    void onSaveMappings(template.id, [...rest, { ...current, ...changes }]);
  };
  return <section className="whatsapp-templates-panel"><header><div><p>WHATSAPP BUSINESS</p><h2>Plantillas oficiales</h2><span>Sincroniza las plantillas aprobadas por Meta y define el origen de cada variable.</span></div><button className="primary-action" type="button" disabled={syncing} onClick={() => void onSync()}>{syncing ? "Sincronizando…" : "↻ Sincronizar con Meta"}</button></header><div className="template-info">Solo las plantillas con estado <b>Aprobada</b> estarán disponibles para enviar desde un chat.</div>{templates.length === 0 && <div className="templates-empty">Aún no hay plantillas sincronizadas. Configura <code>WHATSAPP_BUSINESS_ACCOUNT_ID</code> y usa “Sincronizar con Meta”.</div>}{templates.map(template => <article className={`whatsapp-template-card ${template.status === "APPROVED" ? "approved" : ""}`} key={template.id}><header><div><b>{template.name}</b><small>{template.language} · {template.category || "Sin categoría"}</small></div><span>{template.status === "APPROVED" ? "Aprobada" : template.status}</span></header><div className="template-copy">{template.components.filter(component => component.text).map((component, index) => <p key={index}><small>{component.type}</small>{component.text}</p>)}</div>{template.variables.length > 0 && <section className="template-variable-mappings"><h3>Variables y origen de datos</h3>{template.variables.map(variable => { const mapping = mappingFor(template, variable); return <div className="template-variable-row" key={`${variable.component}-${variable.position}`}><b>{variable.component} · {`{{${variable.position}}}`}</b><select value={mapping.source} onChange={event => update(template, variable, { source: event.target.value as WhatsAppTemplateMapping["source"] })}>{sourceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{mapping.source === "fixed" && <input value={mapping.value || ""} placeholder="Valor fijo" onChange={event => update(template, variable, { value: event.target.value })} />}{mapping.source === "manual" && <input value={mapping.label || ""} placeholder="Etiqueta para el agente" onChange={event => update(template, variable, { label: event.target.value })} />}</div>; })}</section>}</article>)}{templates.length > 0 && approved.length === 0 && <p className="templates-empty">Meta devolvió plantillas, pero ninguna está aprobada todavía.</p>}</section>;
}
