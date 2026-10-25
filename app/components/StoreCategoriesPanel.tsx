"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { request } from "../lib/api";
import { controlRequest, controlSession } from "../lib/control-api";
import { categoriesPayload, categoryIssues, categoryRows, sectionsPreview, type CategoryRow, type ControlCategory, type SavedSection } from "../lib/store-categories";
import styles from "./StoreCategoriesPanel.module.css";

/** E-commerce → Categorías: qué categorías se muestran juntas en la página de productos de la tienda. */
export function StoreCategoriesPanel() {
  const listId = useId();
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([controlRequest<ControlCategory[]>("/category"), request<SavedSection[]>("/store-categories")])
      .then(([categories, sections]) => {
        if (!active) return;
        const next = categoryRows(Array.isArray(categories) ? categories : [], Array.isArray(sections) ? sections : []);
        setRows(next); setSaved(JSON.stringify(categoriesPayload(next))); setError("");
      })
      .catch(reason => { if (active) { setRows([]); setError(controlSession.get() ? (reason instanceof Error ? reason.message : "No se pudieron cargar las categorías.") : "Inicia sesión en Control de ventas y después vuelve a E-commerce."); } });
    return () => { active = false; };
  }, [retry]);
  const preview = useMemo(() => sectionsPreview(rows || []), [rows]);
  const issues = categoryIssues(rows || []);
  const dirty = rows !== null && JSON.stringify(categoriesPayload(rows)) !== saved;
  const set = (categoryId: number, patch: Partial<CategoryRow>) => { setNotice(""); setRows(current => (current || []).map(row => row.categoryId === categoryId ? { ...row, ...patch } : row)); };
  const save = async () => {
    if (!rows || issues.length) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = categoriesPayload(rows);
      await request("/store-categories", { method: "PUT", body: JSON.stringify(payload) });
      setSaved(JSON.stringify(payload));
      setNotice("Guardado. La tienda mostrará estas secciones en la página de productos.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  };
  return <section className={styles.panel}>
    <header className={styles.header}>
      <div><small>E-COMMERCE</small><h1>Categorías</h1>
        <p>Elige en qué sección de la página de productos aparece cada categoría. Las categorías con la misma sección se muestran juntas, por ejemplo tus dos tipos de Essentials en «Essentials». Los precios por volumen de cada categoría no cambian.</p></div>
      <button type="button" className={styles.save} disabled={!dirty || saving || issues.length > 0} onClick={() => void save()}>{saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}</button>
    </header>
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {rows === null && <p role="status">Cargando categorías…</p>}
    {rows !== null && rows.length > 0 && <>
      <div className={styles.preview} aria-label="Vista previa de la tienda">
        <span>Así se verá en la tienda:</span>
        <div><b className={styles.chipAll}>Todos</b>{preview.map(entry => <b key={entry.section} title={entry.categories.join(", ")}>{entry.section}{entry.categories.length > 1 && <small>{entry.categories.length} categorías</small>}</b>)}</div>
      </div>
      <div className={styles.table} role="table" aria-label="Categorías de la tienda">
        <div className={styles.head} role="row"><span role="columnheader">Categoría en Control</span><span role="columnheader">Se muestra en la sección</span><span role="columnheader">Orden</span></div>
        {rows.map(row => {
          const together = preview.find(entry => entry.section.toLowerCase() === row.section.trim().toLowerCase())?.categories.filter(name => name !== row.categoryName) || [];
          return <div key={row.categoryId} className={styles.row} role="row">
            <span role="cell"><b>{row.categoryName}</b><small>#{row.categoryId}{together.length ? ` · junto con ${together.join(", ")}` : ""}</small></span>
            <span role="cell" className={styles.sectionCell}>
              <input aria-label={`Sección para ${row.categoryName}`} list={`${listId}-sections`} value={row.section} maxLength={60} onChange={event => set(row.categoryId, { section: event.target.value })} />
              {row.section.trim() !== row.categoryName && <button type="button" onClick={() => set(row.categoryId, { section: row.categoryName })} title="Mostrarla en su propia sección">Separar</button>}
            </span>
            <span role="cell"><input aria-label={`Orden de ${row.categoryName}`} inputMode="numeric" className={styles.order} value={row.position} maxLength={3} onChange={event => set(row.categoryId, { position: event.target.value.replace(/\D/g, "") })} /></span>
          </div>;
        })}
      </div>
      <datalist id={`${listId}-sections`}>{preview.map(entry => <option key={entry.section} value={entry.section} />)}</datalist>
      <p className={styles.hint}>Para juntar categorías, escribe o elige el mismo nombre de sección. El orden más bajo aparece primero; con el mismo orden se ordenan alfabéticamente.</p>
      {issues.length > 0 && <p role="alert" className={styles.error}>{issues[0]}</p>}
    </>}
    {rows !== null && rows.length === 0 && !error && <p>No hay categorías en Control de ventas.</p>}
  </section>;
}
