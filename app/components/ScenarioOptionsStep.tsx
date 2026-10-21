"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { validateOptionsMessage } from "../lib/interactive-options";
import type { InteractiveOptionsMessage, InteractiveOptionsTemplate, ScenarioOption, ScenarioStep } from "../lib/types";
import { OPTION_TEMPLATES_UPDATED } from "./InteractiveOptionsCard";
import { InteractiveOptionsEditor, InteractiveOptionsErrors, InteractiveOptionsPreview } from "./InteractiveOptionsEditor";
import styles from "./InteractiveOptions.module.css";

/** Mensaje con opciones guardado en el paso del escenario. */
export const stepOptionsMessage = (step: ScenarioStep): InteractiveOptionsMessage => ({
  format: step.format || "auto", header: step.header || "", body: step.body || "", footer: step.footer || "",
  buttonText: step.buttonText ?? "", sectionTitle: step.sectionTitle || "", options: step.options || [],
});
export const stepOptionsIssue = (step: ScenarioStep): string | null => validateOptionsMessage(stepOptionsMessage(step))[0] || null;

type Props = { step: ScenarioStep; targets: ScenarioStep[]; onChange: (patch: Partial<ScenarioStep>) => void };

export function ScenarioOptionsStep({ step, targets, onChange }: Props) {
  const [templates, setTemplates] = useState<InteractiveOptionsTemplate[]>([]);
  useEffect(() => {
    const load = () => request<InteractiveOptionsTemplate[]>("/settings/option-templates").then(setTemplates).catch(() => undefined);
    void load();
    window.addEventListener(OPTION_TEMPLATES_UPDATED, load);
    return () => window.removeEventListener(OPTION_TEMPLATES_UPDATED, load);
  }, []);
  const message = stepOptionsMessage(step);
  const options = step.options || [];
  const errors = validateOptionsMessage(message);
  const started = Boolean(message.body.trim() || options.some(option => option.title.trim()));
  const setMessage = (next: InteractiveOptionsMessage) => onChange({
    format: next.format, header: next.header, body: next.body, footer: next.footer,
    buttonText: next.buttonText, sectionTitle: next.sectionTitle, options: next.options as ScenarioOption[],
  });
  const applyTemplate = (id: string) => {
    const template = templates.find(item => item.id === id);
    if (!template) return;
    // Copia el contenido; los destinos se conservan por texto de opción cuando coinciden.
    const destinations = new Map(options.map(option => [option.title.trim().toLocaleLowerCase("es"), option.nextStepId]));
    onChange({
      format: template.format, header: template.header || "", body: template.body, footer: template.footer || "",
      buttonText: template.buttonText || "", sectionTitle: template.sectionTitle || "",
      options: template.options.map(option => ({ ...option, nextStepId: destinations.get(option.title.trim().toLocaleLowerCase("es")) })),
    });
  };
  const setAllDestinations = (nextStepId: string) => onChange({
    options: options.map(option => option.title.trim() && !option.nextStepId ? { ...option, nextStepId } : option),
  });
  const setDestination = (index: number, nextStepId: string) => onChange({
    options: options.map((option, position) => position === index ? { ...option, nextStepId: nextStepId || undefined } : option),
  });

  return <>
    <label>
      Cargar mensaje guardado
      <select value="" onChange={event => applyTemplate(event.target.value)} disabled={!templates.length}>
        <option value="">{templates.length ? "Copiar desde WhatsApp → Mensajes con opciones…" : "Aún no hay mensajes con opciones guardados"}</option>
        {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
    </label>
    <InteractiveOptionsEditor value={message} onChange={setMessage} compact />
    {started && <InteractiveOptionsErrors errors={errors} />}
    <div className="flow-branches">
      <strong>Siguiente paso</strong>
      <small>Cada opción puede seguir su propio camino. También puedes arrastrar en el lienzo desde el punto de una opción hasta el paso que quieras. Si conectas a «Esperar respuesta», la opción elegida se evalúa con las respuestas de ese paso.</small>
      <label>
        Todas las opciones sin destino continúan en
        <select value="" onChange={event => { if (event.target.value) setAllDestinations(event.target.value); }} disabled={!options.some(option => option.title.trim() && !option.nextStepId)}>
          <option value="">{options.some(option => option.title.trim() && !option.nextStepId) ? "Elegir un paso…" : "Todas las opciones ya tienen destino"}</option>
          {targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
      </label>
      {options.map((option, index) => option.title.trim() ? <label key={index}>
        Si elige «{option.title.trim()}»
        <select value={option.nextStepId || ""} onChange={event => setDestination(index, event.target.value)}>
          <option value="">Terminar escenario (lo atiende el equipo)</option>
          {targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
      </label> : null)}
    </div>
    <label>
      Respuesta si escribe algo que no coincide
      <textarea value={step.fallbackBody || ""} onChange={event => onChange({ fallbackBody: event.target.value })} placeholder="Opcional. Ej. Toca «Ver paquetes» y elige una opción 😊. Si queda vacío, el lead pasa a Requiere atención." />
    </label>
    <div className={styles.editor}><InteractiveOptionsPreview value={message} /></div>
  </>;
}
