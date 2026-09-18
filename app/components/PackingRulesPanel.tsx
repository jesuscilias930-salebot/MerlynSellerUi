"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { controlRequest } from "../lib/control-api";
import styles from "./PackingRulesPanel.module.css";

type Values = { minPairs: number; maxPairs: number; lengthCm: number; widthCm: number; heightCm: number; packagingWeightGrams: number };
type Rule = Values & { id: number };
type Draft = Record<keyof Values, string>;
const blank = (): Draft => ({ minPairs: "", maxPairs: "", lengthCm: "", widthCm: "", heightCm: "", packagingWeightGrams: "" });
const fields: { key: keyof Values; label: string; min: string; max: string; step: string }[] = [
  { key: "minPairs", label: "Desde (pares)", min: "1", max: "100000", step: "1" },
  { key: "maxPairs", label: "Hasta (pares)", min: "1", max: "100000", step: "1" },
  { key: "lengthCm", label: "Largo (cm)", min: "0.001", max: "500", step: "0.001" },
  { key: "widthCm", label: "Ancho (cm)", min: "0.001", max: "500", step: "0.001" },
  { key: "heightCm", label: "Alto (cm)", min: "0.001", max: "500", step: "0.001" },
  { key: "packagingWeightGrams", label: "Peso del empaque vacío (g)", min: "0", max: "100000", step: "0.001" },
];
const endpoint = "/store-shipping/packing-rules";
export function PackingRulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  async function load() {
    setLoading(true); setLoadError("");
    try { setRules(await controlRequest<Rule[]>(endpoint)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los empaques."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const sorted = [...rules].sort((a, b) => a.minPairs - b.minPairs);
  function reset() { setEditing(null); setDraft(blank()); setError(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (pending.current || loading || loadError) return;
    setError(""); setNotice("");
    const values = Object.fromEntries(fields.map(f => [f.key, Number(draft[f.key])])) as Values;
    if (fields.some(f => !draft[f.key].trim() || !Number.isFinite(values[f.key]) || values[f.key] < Number(f.min) || values[f.key] > Number(f.max) || (f.step === "1" && !Number.isInteger(values[f.key])) || Math.abs(values[f.key] * 1000 - Math.round(values[f.key] * 1000)) > 0.00001)) {
      setError("Completa cantidades enteras, medidas positivas y peso del empaque (máximo 3 decimales)."); return;
    }
    if (values.maxPairs < values.minPairs) { setError("Hasta debe ser igual o mayor que Desde."); return; }
    if (rules.some(r => r.id !== editing && values.minPairs <= r.maxPairs && values.maxPairs >= r.minPairs)) { setError("El rango se superpone a otro empaque. Ajusta sus límites antes de guardar."); return; }
    pending.current = true; setBusy(true);
    try {
      const saved = await controlRequest<Rule>(editing === null ? endpoint : `${endpoint}/${editing}`, { method: editing === null ? "POST" : "PUT", body: JSON.stringify(values) });
      setRules(current => [...current.filter(r => r.id !== saved.id), saved]); reset(); setNotice("Empaque guardado. La próxima cotización usará estas medidas.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el empaque."); }
    finally { pending.current = false; setBusy(false); }
  }
  function edit(rule: Rule) {
    setEditing(rule.id); setDraft(Object.fromEntries(fields.map(f => [f.key, String(rule[f.key])])) as Draft);
    setError(""); setNotice(""); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }
  async function remove(rule: Rule) {
    if (pending.current || !window.confirm(`¿Eliminar el empaque desde ${rule.minPairs} pares? Esto puede cambiar el empaque usado en futuras cotizaciones.`)) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try { await controlRequest(`${endpoint}/${rule.id}`, { method: "DELETE" }); setRules(current => current.filter(r => r.id !== rule.id)); if (editing === rule.id) reset(); setNotice("Empaque eliminado."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo eliminar el empaque."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.panel}>
    <header><h2>Empaques</h2><p>Una configuración compartida para todos los calcetines de tu negocio, no una por producto.</p></header>
    <div className={styles.explanation}>El backend suma los pares individuales y los incluidos en bundles, elige el rango y usa sus medidas para cotizar en Envia.com. El peso total se calcula con el peso por par de cada producto más el empaque vacío.</div>
    {loadError && <p role="alert">{loadError} <button type="button" onClick={() => void load()}>Reintentar</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <p className={styles.success} role="status">{notice}</p>
    <div className={styles.layout}>
      <form ref={formRef} className={styles.card} onSubmit={e => void save(e)} aria-busy={busy}>
        <h3>{editing === null ? "Agregar empaque" : "Editar empaque"}</h3>
        <div className={styles.fields}>{fields.map(f => <label key={f.key} htmlFor={`packing-${f.key}`}>{f.label}
          <input id={`packing-${f.key}`} type="number" inputMode={f.step === "1" ? "numeric" : "decimal"} required min={f.min} max={f.max} step={f.step} value={draft[f.key]} disabled={busy || loading || !!loadError} onChange={e => setDraft(current => ({ ...current, [f.key]: e.target.value }))} />
        </label>)}</div>
        <p>El peso del empaque incluye caja y protección, sin los calcetines.</p>
        <p>El último rango (mayor cantidad Desde) se aplica <strong>en adelante</strong>, aunque tenga un valor Hasta guardado. Los rangos anteriores sí respetan Hasta.</p>
        <div className={styles.actions}><button type="submit" disabled={busy || loading || !!loadError}>{busy ? "Guardando…" : "Guardar empaque"}</button>{editing !== null && <button type="button" disabled={busy} onClick={reset}>Cancelar edición</button>}</div>
      </form>
      <div className={styles.list}>
        <header className={styles.listHeader}><div><h3>Empaques configurados{!loading && !loadError ? ` (${sorted.length})` : ""}</h3><p>Rangos y medidas que se usarán para cotizar.</p></div><button type="button" disabled={loading || busy} onClick={() => void load()}>{loading ? "Actualizando…" : "Actualizar lista"}</button></header>
        {loading && <p role="status">Cargando empaques…</p>}
        {!loading && !loadError && !sorted.length && <p>No hay empaques configurados. Agrega el primero para poder cotizar envíos.</p>}
        {sorted.map((r, i) => <article className={styles.card} key={r.id}>
          <h3>{i === sorted.length - 1 ? `${r.minPairs} pares en adelante` : `${r.minPairs}–${r.maxPairs} pares`}</h3>
          {i === sorted.length - 1 && <span className={styles.badge}>Último rango · sin límite superior</span>}
          <p>Empaque #{r.id} · Rango guardado: {r.minPairs}–{r.maxPairs} pares</p>
          {i > 0 && r.minPairs > sorted[i - 1].maxPairs + 1 && <p className={styles.warning}>Sin cobertura entre {sorted[i - 1].maxPairs + 1} y {r.minPairs - 1} pares.</p>}
          {i === 0 && r.minPairs > 1 && <p className={styles.warning}>Sin cobertura de 1 a {r.minPairs - 1} pares.</p>}
          <dl><div><dt>Largo × ancho × alto</dt><dd>{r.lengthCm} × {r.widthCm} × {r.heightCm} cm</dd></div><div><dt>Empaque vacío</dt><dd>{r.packagingWeightGrams} g</dd></div></dl>
          <div className={styles.actions}><button type="button" disabled={busy || loading} onClick={() => edit(r)}>Editar</button><button type="button" disabled={busy || loading} onClick={() => void remove(r)}>Eliminar</button></div>
        </article>)}
        <p>Se cotiza una caja consolidada. Verifica que el pedido quepa físicamente; el último rango abierto no significa que la caja tenga capacidad ilimitada.</p>
      </div>
    </div>
  </section>;
}
