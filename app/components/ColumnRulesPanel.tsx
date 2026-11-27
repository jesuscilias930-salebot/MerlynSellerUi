"use client";

import { useEffect, useId, useState } from "react";
import { request } from "../lib/api";
import { adMatches, draftFromRule, emptyRuleDraft, nationalNumber, ruleIssues, rulePayload, testRules, type AdSource, type ColumnRule, type ColumnRuleDraft } from "../lib/column-rules";
import type { LeadColumn } from "../lib/types";

/** WhatsApp → Mover a columna por mensaje. */
export function ColumnRulesPanel({ columns }: { columns: Pick<LeadColumn, "id" | "name">[] }) {
  const [rules, setRules] = useState<ColumnRule[] | null>(null);
  const [editing, setEditing] = useState<{ rule?: ColumnRule; draft: ColumnRuleDraft } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("");
  const [samplePhone, setSamplePhone] = useState("");
  const [reload, setReload] = useState(0);
  // Anuncios que han traído chats (para elegirlos en una regla «por anuncio»).
  const [ads, setAds] = useState<AdSource[] | null>(null);
  useEffect(() => {
    if (!editing || ads) return;
    let active = true;
    request<AdSource[]>("/column-rules/ads").then(rows => { if (active) setAds(rows); }).catch(() => { if (active) setAds([]); });
    return () => { active = false; };
  }, [editing, ads]);
  // Mover a los que ya llegaron por el anuncio de una regla: primero cuenta, luego confirma.
  const backfill = async (rule: ColumnRule) => {
    setBusy(true); setError("");
    try {
      const preview = await request<{ count: number }>(`/column-rules/${rule.id}/backfill`, { method: "POST", body: JSON.stringify({ dryRun: true }) });
      if (!preview.count) { setError(`No hay leads que hayan llegado por ese anuncio fuera de «${rule.columnName}».`); return; }
      if (!window.confirm(`¿Mover a «${rule.columnName}» a ${preview.count} ${preview.count === 1 ? "lead que llegó" : "leads que llegaron"} por ese anuncio? (No se mueven los de Descartados ni los que ya están en ese dashboard.)`)) return;
      const result = await request<{ moved: number }>(`/column-rules/${rule.id}/backfill`, { method: "POST", body: JSON.stringify({ dryRun: false }) });
      setError(""); window.alert(`Se movieron ${result.moved} ${result.moved === 1 ? "lead" : "leads"} a «${rule.columnName}».`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron mover."); }
    finally { setBusy(false); }
  };
  const id = useId();
  useEffect(() => {
    let active = true;
    request<ColumnRule[]>("/column-rules").then(rows => { if (active) { setRules(rows); setError(""); } }).catch(reason => { if (active) { setRules([]); setError(reason instanceof Error ? reason.message : "No se pudieron cargar las reglas."); } });
    return () => { active = false; };
  }, [reload]);
  const issues = editing ? ruleIssues(editing.draft) : [];
  const set = (patch: Partial<ColumnRuleDraft>) => setEditing(current => current && { ...current, draft: { ...current.draft, ...patch } });
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); setReload(value => value + 1); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!editing || issues.length) return;
    const body = JSON.stringify(rulePayload(editing.draft));
    if (await run(() => request(editing.rule ? `/column-rules/${editing.rule.id}` : "/column-rules", { method: editing.rule ? "PUT" : "POST", body }))) setEditing(null);
  };
  const moveRule = (index: number, delta: number) => {
    if (!rules) return;
    const next = [...rules]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item);
    setRules(next);
    void run(() => request("/column-rules/order", { method: "PUT", body: JSON.stringify({ ruleIds: next.map(rule => rule.id) }) }));
  };
  const matched = (sample.trim() || samplePhone.trim()) && rules ? testRules(rules, sample, samplePhone) : null;
  return <section className="column-rules">
    <header className="column-rules-header"><div><p>WHATSAPP</p><h1>Mover a columna por mensaje y lada</h1>
      <span>Si un cliente llega desde cierto <b>anuncio</b>, o escribe alguna de tus <b>frases</b> (y, si lo eliges, desde cierta lada), el lead se mueve a la columna que elijas. Después, si su mensaje coincide con un escenario, el escenario responde y puede moverlo a otra etapa.</span></div>
      <button type="button" className="primary-action" disabled={!columns.length} onClick={() => setEditing({ draft: emptyRuleDraft(columns[0]?.id) })}>＋ Nueva regla</button></header>
    {error && <p className="column-rules-error" role="alert">{error}</p>}
    {editing && <form className="column-rule-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>Nombre de la regla<input autoFocus value={editing.draft.name} maxLength={80} placeholder="Ej. Interesados en mayoreo" onChange={event => set({ name: event.target.value })} /></label>
      <label>Si llegó por un anuncio que contiene <small>(opcional · una palabra del título del anuncio, p. ej. 120, o elige uno abajo · con anuncio, sus frases son opcionales: aplica a cualquier primer mensaje)</small>
        <input value={editing.draft.adMatch} maxLength={120} placeholder="Ej. 120" onChange={event => set({ adMatch: event.target.value })} /></label>
      {ads && ads.length > 0 && <div className="column-rule-ads" aria-label="Anuncios recientes">
        <small>Anuncios que te han traído chats (90 días) · toca uno para usar su id:</small>
        {ads.slice(0, 8).map(ad => <button type="button" key={ad.sourceId || ad.headline || ad.lastAt} className={editing.draft.adMatch.trim() && adMatches(editing.draft.adMatch, ad) ? "selected" : ""} onClick={() => ad.sourceId && set({ adMatch: ad.sourceId })} title={ad.body || ""}>
          📣 {ad.headline || "Anuncio sin título"} <em>{ad.leads} {ad.leads === 1 ? "lead" : "leads"}</em>
        </button>)}
        {editing.draft.adMatch.trim() && <small>{ads.filter(ad => adMatches(editing.draft.adMatch, ad)).length} de estos anuncios coinciden.</small>}
      </div>}
      <label>Si el mensaje {editing.draft.matchMode === "exact" ? "es exactamente" : "contiene"} alguna de estas frases <small>(una por renglón o separadas por coma · vacío = cualquier mensaje, solo si eliges ladas)</small>
        <textarea rows={4} value={editing.draft.phrases} placeholder={"precio de mayoreo\nquiero ser distribuidor\nvi su anuncio"} onChange={event => set({ phrases: event.target.value })} /></label>
      <label>Y el número es de alguna de estas ladas <small>(opcional · separadas por coma, p. ej. 272, 278, 55 · vacío = cualquier número)</small>
        <input value={editing.draft.areaCodes} inputMode="numeric" placeholder="272, 278" onChange={event => set({ areaCodes: event.target.value })} /></label>
      <div className="column-rule-row">
        <label>Comparación<select value={editing.draft.matchMode} onChange={event => set({ matchMode: event.target.value as ColumnRuleDraft["matchMode"] })}><option value="contains">Contiene la frase</option><option value="exact">Es exactamente la frase</option></select></label>
        <label>Mover a la columna<select value={editing.draft.columnId} onChange={event => set({ columnId: event.target.value })}><option value="">Elige una columna</option>{columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
        <label className="column-rule-check"><input type="checkbox" checked={editing.draft.isActive} onChange={event => set({ isActive: event.target.checked })} /> Activa</label>
      </div>
      <small className="column-rule-hint">No importan mayúsculas, acentos ni signos. «Contiene» busca palabras completas: «precio» coincide con «¿qué precio tiene?» pero no con «preciosos». La lada se compara con números de México (+52); los chats de Messenger e Instagram no tienen lada.</small>
      {issues.length > 0 && (editing.draft.name.trim() || editing.draft.phrases.trim() || editing.draft.areaCodes.trim() || editing.draft.adMatch.trim()) && <p className="column-rules-error">{issues[0]}</p>}
      <div className="column-rule-actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary-action" disabled={busy || issues.length > 0}>{busy ? "Guardando…" : "Guardar regla"}</button></div>
    </form>}
    {rules === null ? <p>Cargando reglas…</p> : rules.length === 0 && !editing ? <div className="column-rules-empty"><b>Aún no tienes reglas.</b><span>Crea una para mover automáticamente a los leads que escriben ciertas frases.</span></div> : <>
      <ol className="column-rule-list">{rules.map((rule, index) => <li key={rule.id} className={rule.isActive ? "" : "inactive"}>
        <div><strong>{rule.name}</strong>{!rule.isActive && <span className="column-rule-badge">Pausada</span>}
          <p>{rule.adMatch && <>Si llegó por un anuncio con <q>{rule.adMatch}</q>{rule.phrases.length || rule.areaCodes?.length ? " y " : " (cualquier mensaje)"}</>}{rule.adMatch && !rule.phrases.length ? "" : rule.phrases.length ? <>Si el mensaje {rule.matchMode === "exact" ? "es exactamente" : "contiene"} {rule.phrases.map(phrase => <q key={phrase}>{phrase}</q>)}</> : "Cualquier mensaje"}{rule.areaCodes?.length ? <> {rule.phrases.length ? "y" : "de"} lada {rule.areaCodes.map(code => <q key={code} className="area-code">{code}</q>)}</> : null} → <b>{rule.columnName || "columna"}</b></p></div>
        <div className="column-rule-buttons">
          <button type="button" aria-label="Subir prioridad" disabled={busy || index === 0} onClick={() => moveRule(index, -1)}>▲</button>
          <button type="button" aria-label="Bajar prioridad" disabled={busy || index === rules.length - 1} onClick={() => moveRule(index, 1)}>▼</button>
          <button type="button" disabled={busy} onClick={() => void run(() => request(`/column-rules/${rule.id}`, { method: "PUT", body: JSON.stringify({ ...rule, isActive: !rule.isActive }) }))}>{rule.isActive ? "Pausar" : "Activar"}</button>
          {rule.adMatch && <button type="button" disabled={busy} title="Mover a los que ya llegaron por este anuncio y siguen en otro dashboard" onClick={() => void backfill(rule)}>Mover a los que ya llegaron</button>}
          <button type="button" disabled={busy} onClick={() => setEditing({ rule, draft: draftFromRule(rule) })}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar la regla «${rule.name}»? Los leads que ya movió se quedan en su columna.`)) void run(() => request(`/column-rules/${rule.id}`, { method: "DELETE" })); }}>Eliminar</button>
        </div>
      </li>)}</ol>
      {rules.length > 1 && <small className="column-rule-hint">Si un mensaje coincide con varias reglas, primero se aplican las que tienen lada y, entre ellas, la de más arriba.</small>}
      <div className="column-rule-tester"><label htmlFor={`${id}-sample`}>Probar un mensaje</label>
        <div className="column-rule-tester-row">
          <input id={`${id}-sample`} value={sample} placeholder="Escribe un mensaje como lo haría un cliente…" onChange={event => setSample(event.target.value)} />
          <input aria-label="Número del cliente (opcional)" value={samplePhone} inputMode="tel" placeholder="Número, p. ej. 272 123 4567" onChange={event => setSamplePhone(event.target.value)} />
        </div>
        {(sample.trim() || samplePhone.trim()) && <small>{matched ? <>✓ Se movería a <b>{(matched as ColumnRule).columnName}</b> por la regla «{(matched as ColumnRule).name}».</> : "Ninguna regla activa coincide."}{samplePhone.trim() && !nationalNumber(samplePhone) ? " (Ese número no tiene una lada de México reconocible.)" : ""}</small>}
      </div>
    </>}
  </section>;
}
