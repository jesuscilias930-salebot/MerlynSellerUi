"use client";

import { useState } from "react";
import { DEFAULT_LIST_BUTTON, OPTION_LIMITS, parseOptionLines, resolveFormat } from "../lib/interactive-options";
import type { InteractiveOption, InteractiveOptionsFormat, InteractiveOptionsMessage } from "../lib/types";
import styles from "./InteractiveOptions.module.css";

type Props = { value: InteractiveOptionsMessage; onChange: (value: InteractiveOptionsMessage) => void; disabled?: boolean; compact?: boolean };
const formats: { value: InteractiveOptionsFormat; label: string }[] = [{ value: "auto", label: "Automático" }, { value: "buttons", label: "Botones" }, { value: "list", label: "Lista" }];

export function InteractiveOptionsEditor({ value, onChange, disabled = false, compact = false }: Props) {
  const [pasted, setPasted] = useState("");
  const options = value.options;
  const filled = options.filter(option => option.title.trim());
  const resolved = resolveFormat(value.format, filled);
  const set = <K extends keyof InteractiveOptionsMessage>(key: K, next: InteractiveOptionsMessage[K]) => onChange({ ...value, [key]: next });
  const setOptions = (next: InteractiveOption[]) => set("options", next);
  // Al cambiar el texto se descarta el id para que el servidor genere uno coherente.
  const updateOption = (index: number, patch: Partial<InteractiveOption>) => setOptions(options.map((option, position) => position === index ? { title: option.title, description: option.description, ...patch } : option));
  const move = (index: number, offset: number) => { const next = [...options]; const [item] = next.splice(index, 1); next.splice(index + offset, 0, item); setOptions(next); };
  const buttonsAllowed = filled.length <= OPTION_LIMITS.buttons;
  const titleLimit = resolved === "buttons" && value.format === "buttons" ? OPTION_LIMITS.buttonTitle : OPTION_LIMITS.rowTitle;

  return <div className={styles.editor}>
    <div className={compact ? styles.editor : styles.row2}>
      <label>Encabezado (opcional)<input value={value.header || ""} onChange={event => set("header", event.target.value)} maxLength={OPTION_LIMITS.header} placeholder="Ej. Paquetes de mayoreo" disabled={disabled} /></label>
      <label>Pie de mensaje (opcional)<input value={value.footer || ""} onChange={event => set("footer", event.target.value)} maxLength={OPTION_LIMITS.footer} placeholder="Ej. Precios sin envío" disabled={disabled} /></label>
    </div>
    <label>Texto del mensaje<textarea value={value.body} onChange={event => set("body", event.target.value)} maxLength={OPTION_LIMITS.body} placeholder="¿Qué paquete te interesa?" disabled={disabled} required /></label>

    <div className={styles.field}>
      Formato
      <div className={styles.segmented} role="group" aria-label="Formato del mensaje">
        {formats.map(format => <button key={format.value} type="button" aria-pressed={(value.format || "auto") === format.value} disabled={disabled || (format.value === "buttons" && !buttonsAllowed)} onClick={() => set("format", format.value)}>{format.label}</button>)}
      </div>
      <p className={styles.hint}>{resolved === "buttons"
        ? `Se enviará como botones: el cliente toca una opción directamente (máx. ${OPTION_LIMITS.buttons}).`
        : `Se enviará como lista: el cliente toca «${value.buttonText?.trim() || DEFAULT_LIST_BUTTON}» y elige una opción (máx. ${OPTION_LIMITS.rows}).`}</p>
    </div>

    {resolved === "list" && <div className={compact ? styles.editor : styles.row2}>
      <label>Texto del botón de la lista<input value={value.buttonText || ""} onChange={event => set("buttonText", event.target.value)} maxLength={OPTION_LIMITS.listButton} placeholder={DEFAULT_LIST_BUTTON} disabled={disabled} /></label>
      <label>Título de la sección (opcional)<input value={value.sectionTitle || ""} onChange={event => set("sectionTitle", event.target.value)} maxLength={OPTION_LIMITS.sectionTitle} placeholder="Ej. Paquetes" disabled={disabled} /></label>
    </div>}

    <div className={styles.optionsHeader}><span>Opciones</span><small>{filled.length}/{OPTION_LIMITS.rows} · texto máx. {titleLimit}, descripción máx. {OPTION_LIMITS.rowDescription}</small></div>
    <ol className={styles.optionList}>
      {options.map((option, index) => <li className={styles.option} key={index}>
        <b>{index + 1}</b>
        <input aria-label={`Texto de la opción ${index + 1}`} value={option.title} onChange={event => updateOption(index, { title: event.target.value })} maxLength={OPTION_LIMITS.rowTitle} placeholder="Caricatura 50 pares" disabled={disabled} />
        <input aria-label={`Descripción de la opción ${index + 1}`} value={option.description || ""} onChange={event => updateOption(index, { description: event.target.value })} maxLength={OPTION_LIMITS.rowDescription} placeholder={resolved === "list" ? "$446.50 (opcional)" : "Solo en lista"} disabled={disabled || (value.format === "buttons")} />
        <span className={styles.optionActions}>
          <button className={styles.iconButton} type="button" aria-label="Subir opción" disabled={disabled || index === 0} onClick={() => move(index, -1)}>↑</button>
          <button className={styles.iconButton} type="button" aria-label="Bajar opción" disabled={disabled || index === options.length - 1} onClick={() => move(index, 1)}>↓</button>
          <button className={styles.iconButton} type="button" aria-label="Quitar opción" disabled={disabled || options.length === 1} onClick={() => setOptions(options.filter((_, position) => position !== index))}>✕</button>
        </span>
      </li>)}
    </ol>
    <button className={styles.addButton} type="button" disabled={disabled || options.length >= OPTION_LIMITS.rows} onClick={() => setOptions([...options, { title: "" }])}>+ Agregar opción</button>
    <details className={styles.paste}>
      <summary>Pegar varias opciones a la vez</summary>
      <div>
        <p className={styles.hint}>Una opción por línea. Separa el texto y la descripción con «·» o «|». Ej.: <i>Caricatura 50 pares · $446.50</i></p>
        <textarea value={pasted} onChange={event => setPasted(event.target.value)} placeholder={"Caricatura 50 pares · $446.50\nCaricatura 100 pares · $882\nAyúdame a elegir"} disabled={disabled} />
        <button className="plain-button" type="button" disabled={disabled || !pasted.trim()} onClick={() => { setOptions(parseOptionLines(pasted).slice(0, OPTION_LIMITS.rows)); setPasted(""); }}>Reemplazar opciones</button>
      </div>
    </details>
  </div>;
}

export function InteractiveOptionsPreview({ value }: { value: InteractiveOptionsMessage }) {
  const options = value.options.filter(option => option.title.trim());
  const format = resolveFormat(value.format, options);
  return <div className={styles.preview} aria-label="Vista previa en WhatsApp">
    <p className={styles.previewLabel}>Vista previa</p>
    <div className={styles.bubble}>
      {value.header?.trim() && <strong>{value.header}</strong>}
      <p>{value.body.trim() || "Texto del mensaje"}</p>
      {value.footer?.trim() && <small>{value.footer}</small>}
    </div>
    {format === "buttons"
      ? <div className={styles.bubbleButtons}>{options.map((option, index) => <span key={index}>{option.title}</span>)}</div>
      : <>
        <div className={styles.bubbleButtons}><span>☰ {value.buttonText?.trim() || DEFAULT_LIST_BUTTON}</span></div>
        <p className={styles.previewLabel}>Al tocar, el cliente ve</p>
        <div className={styles.listSheet}>
          {value.sectionTitle?.trim() && <b>{value.sectionTitle}</b>}
          {options.map((option, index) => <div key={index}><span><b>{option.title}</b>{option.description?.trim() && <small>{option.description}</small>}</span><i /></div>)}
        </div>
      </>}
  </div>;
}

export function InteractiveOptionsErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return <ul className={styles.errors} role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>;
}
