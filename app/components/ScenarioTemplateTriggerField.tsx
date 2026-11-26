"use client";

import { addPhrase, selectableTemplates, templateQuickReplies, type ScenarioTemplateTrigger } from "../lib/scenario-template-trigger";
import type { WhatsAppTemplate } from "../lib/types";

/** «¿Cómo inicia?»: con frases del cliente o como respuesta a una plantilla aprobada de Meta. */
export function ScenarioTemplateTriggerField({ templates, value, onChange, triggerText, onTriggerTextChange }: {
  templates: WhatsAppTemplate[];
  value: ScenarioTemplateTrigger | null;
  onChange: (value: ScenarioTemplateTrigger | null) => void;
  triggerText: string;
  onTriggerTextChange: (text: string) => void;
}) {
  const options = selectableTemplates(templates, value);
  const template = templates.find(item => item.id === value?.templateId);
  const buttons = templateQuickReplies(template);
  const chooseKind = (kind: string) => {
    if (kind === "phrases") onChange(null);
    else if (!value) { const first = options[0]; onChange(first ? { templateId: first.id, templateName: first.name } : { templateId: "", templateName: "" }); }
  };
  return <div className="scenario-start-kind">
    <label>¿Cómo inicia este escenario?
      <select value={value ? "template" : "phrases"} onChange={event => chooseKind(event.target.value)}>
        <option value="phrases">Cuando el cliente escribe una de las frases</option>
        <option value="template">Cuando el cliente responde a una plantilla de WhatsApp</option>
      </select>
    </label>
    {value && <>
      <label>Plantilla
        <select value={value.templateId} onChange={event => { const next = templates.find(item => item.id === event.target.value); onChange(next ? { templateId: next.id, templateName: next.name } : { templateId: "", templateName: "" }); }}>
          <option value="">Elige una plantilla aprobada…</option>
          {options.map(item => <option key={item.id} value={item.id}>{item.name}{item.status !== "APPROVED" ? ` (${item.status.toLowerCase()})` : ""}</option>)}
          {value.templateId && !template && <option value={value.templateId}>{value.templateName || "Plantilla guardada"}</option>}
        </select>
      </label>
      {!options.length && <small className="scenario-start-kind-hint">No hay plantillas aprobadas. Sincronízalas en WhatsApp → Plantillas.</small>}
      <small className="scenario-start-kind-hint">Las respuestas a esta plantilla solo inician escenarios de plantilla, nunca los de frases. Abajo, en las frases, pon el botón o respuesta que lo inicia; déjalas vacías para que cualquier respuesta lo inicie.</small>
      {buttons.length > 0 && <div className="scenario-start-kind-buttons" role="group" aria-label="Botones de la plantilla">
        <span>Botones de la plantilla:</span>
        {buttons.map(text => <button key={text} type="button" onClick={() => onTriggerTextChange(addPhrase(triggerText, text))}>＋ {text}</button>)}
      </div>}
    </>}
  </div>;
}
