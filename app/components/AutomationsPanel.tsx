"use client";

import { FormEvent, useState } from "react";
import type { AutomationIntent } from "../lib/types";

type Props = { intents: AutomationIntent[]; onSave: (intent: Omit<AutomationIntent, "id">, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void> };
const empty = (): Omit<AutomationIntent, "id"> => ({ key: "", name: "", responseBody: "", action: "text", examples: [], isActive: true, priority: 0 });

function Editor({ initial, onSave, onDelete }: { initial?: AutomationIntent; onSave: Props["onSave"]; onDelete?: () => Promise<void> }) {
  const [value, setValue] = useState<Omit<AutomationIntent, "id">(initial ? { ...initial } : empty());
  const [examplesText, setExamplesText] = useState((initial?.examples || []).join("\n"));
  const submit = async (event: FormEvent) => { event.preventDefault(); await onSave({ ...value, examples: examplesText.split("\n").map((item) => item.trim()).filter(Boolean) }, initial?.id); };
  return <form className="automation-editor" onSubmit={submit}><div className="automation-grid"><input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Nombre" required /><input value={value.key} onChange={(event) => setValue({ ...value, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="clave_interna" required /><select value={value.action} onChange={(event) => setValue({ ...value, action: event.target.value as AutomationIntent["action"] })}><option value="text">Responder texto</option><option value="send_catalog">Enviar catálogo</option></select><label className="automation-active"><input type="checkbox" checked={value.isActive} onChange={(event) => setValue({ ...value, isActive: event.target.checked })} /> Activa</label></div>{value.action === "text" && <textarea value={value.responseBody || ""} onChange={(event) => setValue({ ...value, responseBody: event.target.value })} placeholder="Respuesta aprobada que recibirá el cliente" required />}<textarea value={examplesText} onChange={(event) => setExamplesText(event.target.value)} placeholder="Una forma de pedirlo por línea. Incluye errores comunes y variantes." required /><div className="automation-actions"><button>Guardar</button>{onDelete && <button type="button" className="danger" onClick={() => void onDelete()}>Eliminar</button>}</div></form>;
}

export function AutomationsPanel({ intents, onSave, onDelete }: Props) {
  return <section className="automations"><header><p>AUTOMATIZACIONES</p><h1>Respuestas automáticas</h1><span>El bot usa estas respuestas aprobadas. El catálogo se envía solo si está configurado en Ajustes.</span></header><div className="automation-list">{intents.map((intent) => <Editor key={intent.id} initial={intent} onSave={onSave} onDelete={() => onDelete(intent.id)} />)}<Editor onSave={onSave} /></div></section>;
}
