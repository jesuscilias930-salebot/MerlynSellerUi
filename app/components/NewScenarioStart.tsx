"use client";

import { FormEvent, useState } from "react";
import { SCENARIO_TEMPLATES, type ScenarioTemplate } from "../lib/scenario-templates";

export type NewScenarioChoice = { template: ScenarioTemplate; name: string; triggers: string[]; aiDescription: string; isActive: boolean };

/** Primer paso al crear un escenario: elegir punto de partida, nombre y frases. */
export function NewScenarioStart({ onCreate, onCancel }: { onCreate: (choice: NewScenarioChoice) => void; onCancel: () => void }) {
  const [templateId, setTemplateId] = useState("packages");
  const template = SCENARIO_TEMPLATES.find(item => item.id === templateId) as ScenarioTemplate;
  const [name, setName] = useState(template.name);
  const [triggers, setTriggers] = useState(template.triggers.join("\n"));
  const [touched, setTouched] = useState(false);
  const choose = (next: ScenarioTemplate) => {
    // Solo sugiere textos si la persona aún no escribió los suyos.
    if (!touched) { setName(next.name); setTriggers(next.triggers.join("\n")); }
    setTemplateId(next.id);
  };
  const triggerList = triggers.split("\n").map(item => item.trim()).filter(Boolean);
  const problems = [
    name.trim().length < 2 ? "Escribe un nombre (mínimo 2 caracteres)." : "",
    !triggerList.length ? "Agrega al menos una frase con la que inicia." : "",
    triggerList.some(item => item.length < 2) ? "Cada frase necesita al menos 2 caracteres." : "",
  ].filter(Boolean);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problems.length) return;
    onCreate({ template, name: name.trim(), triggers: triggerList, aiDescription: template.aiDescription, isActive: false });
  };
  return <form className="scenario-start" onSubmit={submit}>
    <header>
      <div><p>NUEVO ESCENARIO</p><h1>¿Cómo quieres empezar?</h1><span>Elige un punto de partida. Después podrás cambiar cualquier mensaje o paso en el mapa.</span></div>
      <button type="button" className="plain-button" onClick={onCancel}>Cancelar</button>
    </header>
    <ol className="scenario-start-steps" aria-label="Pasos"><li data-active="true">1 · Punto de partida</li><li data-active="true">2 · Cuándo inicia</li><li>3 · Ajustar el flujo</li></ol>
    <div className="scenario-template-grid" role="radiogroup" aria-label="Punto de partida">
      {SCENARIO_TEMPLATES.map(item => <button key={item.id} type="button" role="radio" aria-checked={item.id === templateId} className={item.id === templateId ? "selected" : ""} onClick={() => choose(item)}>
        <span aria-hidden="true">{item.icon}</span>
        <b>{item.title}</b>
        <small>{item.description}</small>
        <em>{item.steps.length} paso{item.steps.length === 1 ? "" : "s"}</em>
      </button>)}
    </div>
    <section className="scenario-start-form">
      <label>Nombre del escenario<input value={name} maxLength={100} placeholder="Ej. Envíos nacionales" onChange={event => { setTouched(true); setName(event.target.value); }} /></label>
      <label>Inicia cuando el cliente escribe algo como… <small>Una frase por línea. Se reconocen aunque tengan errores de dedo o acentos.</small>
        <textarea value={triggers} placeholder={"hacen envíos\nenvían a Veracruz"} onChange={event => { setTouched(true); setTriggers(event.target.value); }} />
      </label>
      {triggerList.length > 0 && <div className="scenario-trigger-chips" aria-label="Frases">{triggerList.slice(0, 8).map(item => <span key={item}>«{item}»</span>)}</div>}
      <p className="scenario-start-note">Se crea <b>pausado</b>: actívalo cuando lo hayas revisado. Nada se guarda hasta que pulses «Guardar escenario».</p>
      {touched && problems.length > 0 && <ul className="scenario-start-problems" role="alert">{problems.map(item => <li key={item}>{item}</li>)}</ul>}
      <footer><button className="primary-action" onMouseDown={() => setTouched(true)}>Continuar al mapa →</button></footer>
    </section>
  </form>;
}
