"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { request } from "../lib/api";
import { emptyOptionsMessage, packageOptionsExample, toOptionsPayload, validateOptionsMessage } from "../lib/interactive-options";
import type { InteractiveOptionsMessage, InteractiveOptionsTemplate } from "../lib/types";
import { InteractiveOptionsEditor, InteractiveOptionsErrors, InteractiveOptionsPreview } from "./InteractiveOptionsEditor";
import { OPTION_TEMPLATES_UPDATED } from "./InteractiveOptionsCard";
import styles from "./InteractiveOptions.module.css";

export type InteractiveOptionsDraft = InteractiveOptionsMessage & { name: string };

const fromTemplate = (template: InteractiveOptionsTemplate): InteractiveOptionsMessage => ({
  format: template.format, header: template.header || "", body: template.body, footer: template.footer || "",
  buttonText: template.buttonText || "", sectionTitle: template.sectionTitle || "", options: template.options.map(option => ({ ...option })),
});

// Sección autocontenida: carga y guarda sus propios mensajes al abrirse.
export function InteractiveOptionsPanel() {
  const [templates, setTemplates] = useState<InteractiveOptionsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { setTemplates(await request<InteractiveOptionsTemplate[]>("/settings/option-templates")); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudieron cargar los mensajes con opciones."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const changed = async (text: string) => { setNotice(text); await load(); window.dispatchEvent(new Event(OPTION_TEMPLATES_UPDATED)); };
  const onSave = async (template: InteractiveOptionsDraft, id?: string) => {
    try {
      await request(id ? `/settings/option-templates/${id}` : "/settings/option-templates", { method: id ? "PATCH" : "POST", body: JSON.stringify(template) });
      await changed(id ? "Mensaje actualizado." : "Mensaje guardado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el mensaje."); throw error; }
  };
  const onDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este mensaje con opciones?")) return;
    try { await request(`/settings/option-templates/${id}`, { method: "DELETE" }); await changed("Mensaje eliminado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el mensaje."); }
  };
  const [name, setName] = useState("");
  const [message, setMessage] = useState<InteractiveOptionsMessage>(emptyOptionsMessage);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const errors = validateOptionsMessage(message);
  const reset = () => { setName(""); setMessage(emptyOptionsMessage()); setEditingId(undefined); setTouched(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setTouched(true);
    if (errors.length || !name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), ...toOptionsPayload(message) }, editingId); reset(); } catch { /* el aviso ya se muestra */ } finally { setSaving(false); }
  };
  const edit = (template: InteractiveOptionsTemplate) => { setEditingId(template.id); setName(template.name); setMessage(fromTemplate(template)); setTouched(false); };
  const loadExample = () => { setEditingId(undefined); setName("Paquetes de mayoreo"); setMessage(packageOptionsExample()); setTouched(false); };

  return <section className={styles.panel}>
    <header>
      <div><p>MENSAJES CON OPCIONES</p><h2>Botones y listas de opciones</h2><span>El cliente elige una opción con un toque y su respuesta llega al chat. Envíalos desde las herramientas de cualquier conversación.</span></div>
      <button className="plain-button" type="button" onClick={loadExample}>Cargar ejemplo de paquetes</button>
    </header>
    {notice && <p className="cta-url-notice" role="status">{notice}</p>}
    <form className={styles.workspace} onSubmit={event => void submit(event)}>
      <div className={styles.editor}>
        <label>Nombre interno<input value={name} onChange={event => setName(event.target.value)} placeholder="Paquetes de mayoreo" maxLength={120} required /></label>
        <InteractiveOptionsEditor value={message} onChange={setMessage} />
        {touched && <InteractiveOptionsErrors errors={errors} />}
        <footer className={styles.formFooter}>
          {editingId && <button className="plain-button" type="button" onClick={reset}>Cancelar</button>}
          <button className="primary-action" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar mensaje"}</button>
        </footer>
      </div>
      <aside><InteractiveOptionsPreview value={message} /></aside>
    </form>
    <div className={styles.savedList}>
      {loading ? <p>Cargando…</p> : templates.length === 0 && <p>Aún no hay mensajes con opciones guardados. Prueba «Cargar ejemplo de paquetes».</p>}
      {templates.map(template => <article key={template.id}>
        <div><b>{template.name}</b><small>{template.format === "buttons" ? "Botones" : "Lista"} · {template.options.map(option => option.title).join(" · ")}</small></div>
        <button className="plain-button" type="button" onClick={() => edit(template)}>Editar</button>
        <button className="danger-link" type="button" onClick={() => void onDelete(template.id)}>Eliminar</button>
      </article>)}
    </div>
  </section>;
}
