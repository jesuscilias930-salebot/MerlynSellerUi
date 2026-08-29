"use client";

import { FormEvent, useState } from "react";
import type { AutomationIntent } from "../lib/types";

type Props = {
  intents: AutomationIntent[];
  onSave: (intent: Omit<AutomationIntent, "id">, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type IntentDraft = Omit<AutomationIntent, "id">;

const emptyIntent = (): IntentDraft => ({
  key: "",
  name: "",
  responseBody: "",
  action: "text",
  examples: [],
  isActive: true,
  priority: 0,
});

type EditorProps = {
  initial?: AutomationIntent;
  onSave: Props["onSave"];
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
};

function AutomationEditor({ initial, onSave, onDelete, onCancel }: EditorProps) {
  const [value, setValue] = useState<IntentDraft>(
    initial ? { ...initial } : emptyIntent(),
  );
  const [examplesText, setExamplesText] = useState(
    (initial?.examples || []).join("\n"),
  );
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          ...value,
          examples: examplesText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        initial?.id,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="automation-editor" onSubmit={submit}>
      <div className="automation-card-header">
        <div><strong>{initial ? initial.name : "Nueva automatización"}</strong><small>{initial ? initial.key : "Crea una respuesta o acción automática"}</small></div>
        {onCancel && <button className="plain-button" type="button" onClick={onCancel}>Cancelar</button>}
      </div>
      <div className="automation-grid">
        <input
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
          placeholder="Nombre"
          required
        />
        <input
          value={value.key}
          onChange={(event) =>
            setValue({
              ...value,
              key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            })
          }
          placeholder="clave_interna"
          required
        />
        <select
          value={value.action}
          onChange={(event) =>
            setValue({
              ...value,
              action: event.target.value as AutomationIntent["action"],
            })
          }
        >
          <option value="text">Responder texto</option>
          <option value="send_catalog">Enviar catálogo</option>
        </select>
        <label className="automation-active">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) =>
              setValue({ ...value, isActive: event.target.checked })
            }
          />{" "}
          Activa
        </label>
      </div>

      {value.action === "text" && (
        <textarea
          value={value.responseBody || ""}
          onChange={(event) =>
            setValue({ ...value, responseBody: event.target.value })
          }
          placeholder="Respuesta aprobada que recibirá el cliente"
          required
        />
      )}

      <textarea
        value={examplesText}
        onChange={(event) => setExamplesText(event.target.value)}
        placeholder="Una forma de pedirlo por línea. Incluye errores comunes y variantes."
        required
      />

      <div className="automation-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {onDelete && (
          <button
            type="button"
            className="danger"
            disabled={saving}
            onClick={() => void onDelete()}
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}

export function AutomationsPanel({ intents, onSave, onDelete }: Props) {
  const [creating, setCreating] = useState(false);
  return (
    <section className="automations">
      <header className="automations-header"><div><p>AUTOMATIZACIONES</p><h1>Respuestas automáticas</h1><span>Configura qué debe contestar el bot y agrega ejemplos de frases que debe reconocer.</span></div><button type="button" className="primary-action" onClick={() => setCreating(true)} disabled={creating}>＋ Nueva automatización</button></header>

      <div className="automation-list">
        {intents.length === 0 && <div className="automation-empty"><b>Aún no tienes automatizaciones</b><span>Crea una para comenzar a responder automáticamente.</span></div>}
        {intents.map((intent) => (
          <AutomationEditor
            key={intent.id}
            initial={intent}
            onSave={onSave}
            onDelete={() => onDelete(intent.id)}
          />
        ))}
        {creating && <AutomationEditor onSave={async (intent) => { await onSave(intent); setCreating(false); }} onCancel={() => setCreating(false)} />}
      </div>
    </section>
  );
}
