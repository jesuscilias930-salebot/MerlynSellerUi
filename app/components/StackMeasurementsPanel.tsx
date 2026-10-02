"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { controlRequest } from "../lib/control-api";
import styles from "./StackMeasurementsPanel.module.css";

type Reference = { kind: string; label: string; referencePairs: number; lengthCm: number | null; widthCm: number | null; heightCm: number | null; configured: boolean };
const fields = [["referencePairs", "Pares de referencia", "pares"], ["lengthCm", "Largo de la pila", "cm"], ["widthCm", "Ancho de la pila", "cm"], ["heightCm", "Alto de la pila", "cm"]] as const;
type Field = typeof fields[number][0];
const drafts = (row: Reference): Record<Field, string> => ({ referencePairs: String(row.referencePairs), lengthCm: row.lengthCm == null ? "" : String(row.lengthCm), widthCm: row.widthCm == null ? "" : String(row.widthCm), heightCm: row.heightCm == null ? "" : String(row.heightCm) });

function StackCard({ row, onSaved }: { row: Reference; onSaved: (row: Reference) => void }) {
  const [draft, setDraft] = useState(() => drafts(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const changed = fields.some(([key]) => draft[key] !== drafts(row)[key]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(""); setNotice("");
    const input = Object.fromEntries(fields.map(([key]) => [key, Number(draft[key])])) as Record<Field, number>;
    if (fields.some(([key]) => !draft[key].trim() || !Number.isFinite(input[key]) || input[key] <= 0 || input[key] > 10000 ||
      (key === "referencePairs" ? !Number.isInteger(input[key]) : Math.abs(input[key] * 100 - Math.round(input[key] * 100)) > 0.00001))) {
      setError("Completa los pares con un número entero y las medidas positivas con hasta 2 decimales (máximo 10,000)."); return;
    }
    pending.current = true; setSaving(true);
    try {
      const saved = await controlRequest<Reference>(`/store-shipping/stack-references/${row.kind}`, { method: "PUT", body: JSON.stringify(input) });
      if (!saved?.configured || saved.kind !== row.kind || fields.some(([key]) => Number(saved[key]) !== input[key]))
        throw new Error("No se pudo confirmar el guardado. Vuelve a abrir esta sección para verificar.");
      onSaved(saved); setDraft(drafts(saved)); setNotice("Medidas guardadas.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar."); }
    finally { pending.current = false; setSaving(false); }
  }
  return <form className={styles.card} onSubmit={event => void save(event)} aria-label={`Medidas de ${row.label}`} aria-busy={saving}>
    <header><h2>{row.label}</h2><span className={row.configured ? styles.ready : styles.pending}>{row.configured ? "Configurada" : "Sin medidas"}</span></header>
    <p>Mide la pila completa de <strong>{draft.referencePairs || "—"} pares</strong>, no un par suelto ni la caja.</p>
    <fieldset disabled={saving} className={styles.fields}><legend className={styles.srOnly}>Medidas de referencia de {row.label}</legend>
      {fields.map(([key, label, unit]) => <label key={key} htmlFor={`stack-${row.kind}-${key}`}>{label} <small>({unit})</small>
        <input id={`stack-${row.kind}-${key}`} type="number" inputMode={key === "referencePairs" ? "numeric" : "decimal"}
          min={key === "referencePairs" ? 1 : 0.01} max={10000} step={key === "referencePairs" ? 1 : 0.01} required
          value={draft[key]} placeholder={key === "referencePairs" ? "Pares" : "Sin medir"}
          onChange={event => { const value = event.target.value.replace(/^0+(?=\d)/, ""); setDraft(current => ({ ...current, [key]: value })); setError(""); setNotice(""); }} />
      </label>)}
    </fieldset>
    {row.configured && <p className={styles.saved}>Guardado: {row.referencePairs} pares · {row.lengthCm} × {row.widthCm} × {row.heightCm} cm (largo × ancho × alto).</p>}
    <footer><button type="submit" disabled={saving || (row.configured && !changed)}>{saving ? "Guardando…" : "Guardar medidas"}</button><span role="status">{notice}</span></footer>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </form>;
}

export function StackMeasurementsPanel() {
  const [rows, setRows] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    controlRequest<Reference[]>("/store-shipping/stack-references", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { if (!Array.isArray(data) || data.length !== 5) throw new Error("Respuesta de medidas incompleta."); setRows(data); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las medidas."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  return <section className={styles.panel} aria-label="Medidas de pilas de calcetines">
    <div className={styles.intro}><h2>Una medida de referencia por tipo de calcetín</h2>
      <p>Apila pares completos como los empacarías y mide el largo, ancho y alto de toda la pila, sin caja. Usa centímetros y el mismo acomodo cada vez.</p>
      <p><strong>Base máxima prevista para la caja:</strong> 65 cm de ancho × 60 cm de largo. La altura dependerá del acomodo.</p>
      <p className={styles.note}>Estas referencias se guardan para el futuro cálculo de pedidos individuales. Todavía no cambian las cotizaciones. El peso se configura por separado en “Peso de productos”.</p>
    </div>
    {loading ? <p role="status">Cargando medidas…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>Reintentar</button></div> : <>
      <p className={styles.progress}>{rows.filter(row => row.configured).length} de {rows.length} referencias configuradas</p>
      <div className={styles.grid}>{rows.map(row => <StackCard key={row.kind} row={row} onSaved={saved => setRows(current => current.map(item => item.kind === saved.kind ? saved : item))} />)}</div>
    </>}
  </section>;
}
