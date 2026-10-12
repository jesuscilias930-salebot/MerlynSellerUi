"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import { analysisDateLabel, analysisFilename, DEFAULT_ANALYSIS_GOAL, formatConversationAnalysis, initialAnalysisFilters, type AnalysisColumn, type AnalysisFilters, type AnalysisPreview, type PreparedAnalysis } from "../lib/conversation-analysis";
import styles from "./ConversationAnalysisPanel.module.css";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No pudimos completar la solicitud. Intenta nuevamente.";

export function ConversationAnalysisPanel() {
  const [columns, setColumns] = useState<AnalysisColumn[]>(), [columnsError, setColumnsError] = useState("");
  const [retry, setRetry] = useState(0), [filters, setFilters] = useState<AnalysisFilters>(() => initialAnalysisFilters());
  const [goal, setGoal] = useState(DEFAULT_ANALYSIS_GOAL), [result, setResult] = useState<{ key: string; data: AnalysisPreview }>();
  const [selected, setSelected] = useState<string[]>([]), [snapshot, setSnapshot] = useState<PreparedAnalysis>();
  const [text, setText] = useState(""), [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState<"search" | "prepare" | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const activeRequest = useRef<AbortController | null>(null), fileSection = useRef<HTMLElement>(null);
  const downloadUrlRef = useRef("");
  const filterKey = JSON.stringify(filters), current = result?.key === filterKey ? result.data : undefined;
  const selectedRows = current?.conversations.filter(chat => selected.includes(chat.id)) || [];
  const totalMessages = selectedRows.reduce((sum, chat) => sum + chat.messageCount, 0);

  useEffect(() => {
    const controller = new AbortController();
    request<AnalysisColumn[]>("/conversation-analysis/columns", { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setColumns(data); setColumnsError(""); } }).catch(error => { if (!controller.signal.aborted) setColumnsError(errorMessage(error)); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => () => { if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current); }, []);
  useEffect(() => { if (snapshot) fileSection.current?.scrollIntoView({ block: "start" }); }, [snapshot]);

  function clearDownload() { if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current); downloadUrlRef.current = ""; setDownloadUrl(""); setReviewed(false); }
  function approveFile(approved: boolean) {
    clearDownload();
    if (!approved || !text.trim() || busy) return;
    // Build from the reviewed text during the user's gesture, then keep the
    // URL alive until an edit, selection change or unmount (Safari/iOS).
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    downloadUrlRef.current = url; setDownloadUrl(url); setReviewed(true);
  }
  function invalidate() { setSnapshot(undefined); setText(""); clearDownload(); setNotice(""); setError(""); }
  function change<K extends keyof AnalysisFilters>(key: K, value: AnalysisFilters[K]) { invalidate(); setFilters(current => ({ ...current, [key]: value })); }
  function selectColumn(id: string) { change("columnIds", filters.columnIds.includes(id) ? filters.columnIds.filter(value => value !== id) : [...filters.columnIds, id]); }
  function selectChat(id: string) { invalidate(); setSelected(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]); }
  async function search(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!filters.columnIds.length) { setError("Selecciona al menos una columna."); return; }
    if (!filters.startDate || !filters.endDate || filters.startDate > filters.endDate) { setError("Selecciona un periodo válido."); return; }
    activeRequest.current?.abort(); const controller = new AbortController(); activeRequest.current = controller;
    invalidate(); setResult(undefined); setSelected([]); setBusy("search");
    try { const data = await request<AnalysisPreview>("/conversation-analysis/preview", { method: "POST", body: JSON.stringify(filters), signal: controller.signal }); if (!controller.signal.aborted) { setResult({ key: filterKey, data }); setSelected(data.conversations.map(chat => chat.id)); } }
    catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  }
  async function prepare() {
    if (busy || !selectedRows.length) return;
    activeRequest.current?.abort(); const controller = new AbortController(); activeRequest.current = controller;
    invalidate(); setBusy("prepare");
    try {
      const data = await request<PreparedAnalysis>("/conversation-analysis/prepare", { method: "POST", body: JSON.stringify({ ...filters, conversationIds: selectedRows.map(chat => chat.id) }), signal: controller.signal });
      if (!controller.signal.aborted) { setSnapshot(data); setText(formatConversationAnalysis(data, goal)); }
    } catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  }
  return <section className={styles.panel} aria-label="Análisis de conversaciones">
    <header><small>WHATSAPP · EXPORTACIÓN PARA IA</small><h1>Análisis de conversaciones</h1><p>Selecciona tus chats y descarga un archivo con el contexto y las instrucciones para analizar dónde se frenan las ventas.</p></header>
    <div className={styles.info}>No enviamos datos a una IA automáticamente. Estar en una columna no confirma si el cliente compró; el archivo lo aclara.</div>
    {columnsError && <div className={styles.error} role="alert">{columnsError}<button type="button" className={styles.secondary} onClick={() => setRetry(value => value + 1)}>Reintentar columnas</button></div>}
    {!columns && !columnsError && <p role="status">Cargando columnas…</p>}
    {columns?.length === 0 && <p>No hay columnas disponibles. Configura tu tablero en Leads.</p>}
    {!!columns?.length && <form onSubmit={search} className={styles.step}>
      <h2><span>1</span> Elige qué conversaciones incluir</h2>
      <fieldset disabled={!!busy}><legend>Columnas del tablero</legend><div className={styles.columns}>{columns.map(column => <label key={column.id} className={filters.columnIds.includes(column.id) ? styles.chosen : ""}><input type="checkbox" checked={filters.columnIds.includes(column.id)} disabled={!filters.columnIds.includes(column.id) && filters.columnIds.length >= 30} onChange={() => selectColumn(column.id)}/><span>{column.name}<small>{column.conversationCount} {column.conversationCount === 1 ? "chat" : "chats"} en la columna</small></span></label>)}</div></fieldset>
      <fieldset disabled={!!busy} className={styles.fields}><legend className={styles.srOnly}>Periodo y límites</legend>
        <label>Último mensaje desde<input type="date" required min="1900-01-01" max="9999-12-31" value={filters.startDate} onInput={event => change("startDate", event.currentTarget.value)} onChange={event => change("startDate", event.target.value)}/></label>
        <label>Último mensaje hasta<input type="date" required min={filters.startDate || "1900-01-01"} max="9999-12-31" value={filters.endDate} onInput={event => change("endDate", event.currentTarget.value)} onChange={event => change("endDate", event.target.value)}/></label>
        <label>Sin actividad<select value={filters.inactiveDays} onChange={event => change("inactiveDays", Number(event.target.value))}><option value={0}>No filtrar por inactividad</option>{[3, 7, 14, 30].map(days => <option key={days} value={days}>Hace al menos {days} días</option>)}</select></label>
        <label>Máximo de chats por lote<select value={filters.limit} onChange={event => change("limit", Number(event.target.value))}>{[10, 25, 50].map(count => <option key={count} value={count}>{count} conversaciones</option>)}</select></label>
      </fieldset>
      <p className={styles.help}>Fechas y horas de Ciudad de México. Se filtra por el último mensaje disponible, no por movimientos entre columnas. Periodo máximo: 366 días.</p>
      <label className={styles.goal}>Objetivo del análisis<textarea rows={3} maxLength={1000} disabled={!!busy} value={goal} onChange={event => { invalidate(); setGoal(event.target.value); }}/></label>
      <button type="submit" className={styles.primary} disabled={!!busy || !filters.columnIds.length}>{busy === "search" ? "Buscando…" : "Buscar conversaciones"}</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {current && <section className={styles.step} aria-label="Seleccionar conversaciones"><h2><span>2</span> Revisa la selección</h2>
      <div className={styles.selectionHeading}><p role="status">Chats seleccionados: {selectedRows.length} de {current.conversations.length} · {totalMessages.toLocaleString("es-MX")} mensajes disponibles</p><div><button type="button" className={styles.secondary} disabled={!!busy} onClick={() => { invalidate(); setSelected(current.conversations.map(chat => chat.id)); }}>Seleccionar todos</button><button type="button" className={styles.secondary} disabled={!!busy} onClick={() => { invalidate(); setSelected([]); }}>Quitar selección</button></div></div>
      {current.hasMore && <p className={styles.info}>Hay más coincidencias. Este lote muestra los {current.limit} chats más recientes; ajusta las fechas para preparar otros lotes.</p>}
      {!current.conversations.length && <div className={styles.empty}><h3>No hay conversaciones con estos filtros</h3><p>Prueba otro periodo, columna o filtro de inactividad.</p></div>}
      <div className={styles.candidates}>{current.conversations.map(chat => <label key={chat.id} className={selected.includes(chat.id) ? styles.chosen : ""}><input type="checkbox" disabled={!!busy} checked={selected.includes(chat.id)} onChange={() => selectChat(chat.id)}/><span><strong>{chat.name}</strong><small>{chat.columnName}</small></span><span className={styles.activity}><b>{chat.messageCount.toLocaleString("es-MX")} mensajes</b><small>{analysisDateLabel(chat.lastMessageAt)}</small></span></label>)}</div>
      {!!current.conversations.length && <><p className={styles.help}>Los nombres de esta lista son solo para tu revisión dentro del CRM. El archivo usa alias, omite identificadores internos y adjuntos, y oculta los datos personales detectados en los textos. Revisa el resultado antes de compartirlo.</p><button type="button" className={styles.primary} disabled={!!busy || !selectedRows.length} onClick={() => void prepare()}>{busy === "prepare" ? "Preparando archivo…" : `Preparar archivo (${selectedRows.length})`}</button></>}
    </section>}
    {snapshot && <section ref={fileSection} className={styles.step} aria-label="Revisar archivo"><h2><span>3</span> Revisa y descarga tu archivo</h2>
      <div className={styles.fileSummary}><strong>{snapshot.conversations.length} {snapshot.conversations.length === 1 ? "conversación" : "conversaciones"}</strong><span>{snapshot.redactionCount} sustituciones de datos detectados</span><span>{(new TextEncoder().encode(text).length / 1024).toFixed(1)} KB · TXT UTF-8</span></div>
      {snapshot.conversations.some(chat => chat.partial) && <p className={styles.warning}>Algunos historiales se recortaron. El archivo señala cuántos mensajes faltan; incluye hasta los 100 más recientes y 24,000 caracteres por chat.</p>}
      <p className={styles.warning}>El ocultamiento de datos es automático y puede ser incompleto. Revisa el texto y elimina cualquier información personal que no desees compartir antes de adjuntarlo a una IA.</p>
      <details className={styles.aliases}><summary>Relacionar los alias con tus conversaciones (no se descarga)</summary><p className={styles.help}>Mantén esta revisión abierta para relacionar los alias del reporte con tus chats. Esta relación no se guarda ni se comparte con la IA.</p><ul>{snapshot.conversationIndex.map(item => <li key={item.alias}><strong>{item.alias}</strong> {current?.conversations.find(chat => chat.id === item.id)?.name || "Conversación seleccionada"}</li>)}</ul></details>
      <label className={styles.fileLabel}>Contenido del archivo · puedes editarlo<textarea rows={16} spellCheck={false} value={text} onChange={event => { setText(event.target.value); clearDownload(); setNotice(""); }}/></label>
      <label className={styles.review}><input type="checkbox" checked={reviewed} onChange={event => approveFile(event.target.checked)}/>Revisé el archivo y retiré los datos personales que no quiero compartir.</label>
      <div className={styles.download}>{reviewed && downloadUrl && !busy ? <a className={styles.primary} href={downloadUrl} download={analysisFilename(snapshot)} onClick={() => setNotice("Descarga iniciada. Adjúntalo manualmente al chat de IA que quieras usar.")}>Descargar archivo .txt</a> : <button type="button" className={styles.primary} disabled>Descargar archivo .txt</button>}<small>Luego adjunta este archivo a tu chat de IA. El prompt ya está incluido.</small></div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>}
  </section>;
}
