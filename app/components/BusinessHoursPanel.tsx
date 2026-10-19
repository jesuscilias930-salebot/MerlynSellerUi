"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { request } from "../lib/api";
import {
  blankRule, DAY_LABELS, DAY_ORDER, PLACEHOLDERS, ruleExamples, scheduleIssues, TIMEZONES, toHoursPayload,
  type AfterHoursRule, type BusinessHoursConfig, type BusinessHoursPreview, type BusinessHoursStatus, type HoursDay,
} from "../lib/business-hours";
import styles from "./BusinessHours.module.css";

type Response = { config: BusinessHoursConfig; status: BusinessHoursStatus };

// Sección autocontenida: WhatsApp → Horario de atención.
export function BusinessHoursPanel() {
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [status, setStatus] = useState<BusinessHoursStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [closedDate, setClosedDate] = useState("");
  const [testText, setTestText] = useState("¿Cuánto cuesta el paquete de 100 pares?");
  const [testAt, setTestAt] = useState("");
  const [preview, setPreview] = useState<BusinessHoursPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const defaultMessageRef = useRef<HTMLTextAreaElement>(null);

  const apply = (data: Response) => { setConfig(data.config); setSavedJson(JSON.stringify(data.config)); setStatus(data.status); };
  const load = useCallback(async () => {
    try { apply(await request<Response>("/settings/business-hours")); setLoadError(""); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "No se pudo cargar el horario."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const issues = useMemo(() => config ? scheduleIssues(config) : [], [config]);
  const dirty = Boolean(config && JSON.stringify(config) !== savedJson);
  const update = (patch: Partial<BusinessHoursConfig>) => { setConfig(current => current && { ...current, ...patch }); setSavedNotice(""); };
  const updateDay = (day: number, patch: Partial<HoursDay>) => config && update({ schedule: config.schedule.map(item => item.day === day ? { ...item, ...patch } : item) });
  const updateRule = (index: number, patch: Partial<AfterHoursRule>) => config && update({ rules: config.rules.map((rule, position) => position === index ? { ...rule, ...patch } : rule) });
  const moveRule = (index: number, offset: number) => { if (!config) return; const rules = [...config.rules]; const [rule] = rules.splice(index, 1); rules.splice(index + offset, 0, rule); update({ rules }); };

  const save = async () => {
    if (!config) return;
    setSaving(true); setSaveError(""); setSavedNotice("");
    try {
      apply(await request<Response>("/settings/business-hours", { method: "PUT", body: JSON.stringify(toHoursPayload(config)) }));
      setSavedNotice("Horario guardado.");
    } catch (error) {
      // El borrador se conserva para corregirlo y volver a guardar.
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el horario.");
    } finally { setSaving(false); }
  };
  const test = async () => {
    if (!config) return;
    setPreviewError("");
    try {
      setPreview(await request<BusinessHoursPreview>("/settings/business-hours/preview", { method: "POST", body: JSON.stringify({ config: toHoursPayload(config), text: testText, at: testAt ? new Date(testAt).toISOString() : undefined }) }));
    } catch (error) { setPreview(null); setPreviewError(error instanceof Error ? error.message : "No se pudo probar."); }
  };
  const insertToken = (token: string) => {
    if (!config) return;
    const field = defaultMessageRef.current;
    const at = field?.selectionStart ?? config.defaultMessage.length;
    update({ defaultMessage: `${config.defaultMessage.slice(0, at)}${token}${config.defaultMessage.slice(field?.selectionEnd ?? at)}` });
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(at + token.length, at + token.length); });
  };
  const copyMonday = () => {
    if (!config) return;
    const monday = config.schedule.find(day => day.day === 1);
    if (!monday) return;
    update({ schedule: config.schedule.map(day => day.day === 0 || day.day === 1 ? day : { ...day, open: monday.open, intervals: monday.intervals.map(interval => ({ ...interval })) }) });
  };

  if (!config) return <section className={styles.panel}>{loadError ? <p className={styles.error} role="alert">{loadError} <button className={styles.link} type="button" onClick={() => void load()}>Reintentar</button></p> : <p className={styles.hint}>Cargando horario…</p>}</section>;

  return <section className={styles.panel}>
    <header className={styles.header}>
      <div><p>WHATSAPP</p><h1>Horario de atención</h1><span>Define cuándo atiende tu equipo. Fuera de ese horario, el cliente recibe un aviso según lo que escriba, una sola vez por noche o día cerrado.</span></div>
      {status && <span className={styles.status} data-open={status.open}><i />{status.open ? "Ahora: abierto" : `Ahora: cerrado · abre ${status.nextOpeningText || "—"}`}</span>}
    </header>

    <section className={`${styles.card} ${config.enabled ? styles.enable : ""}`}>
      <label className={styles.toggle}><input type="checkbox" checked={config.enabled} onChange={event => update({ enabled: event.target.checked })} /><span><b>Enviar mensajes fuera de horario</b><small>Apagado, el horario se guarda pero no se envía ningún aviso.</small></span></label>
    </section>

    <section className={styles.card}>
      <header><strong>Horario semanal</strong><small>Puedes agregar hasta 3 turnos por día, por ejemplo de 8:00 a 14:00 y de 16:00 a 19:00.</small></header>
      <label>Zona horaria<select value={config.timezone} onChange={event => update({ timezone: event.target.value })}>{TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{!TIMEZONES.some(([value]) => value === config.timezone) && <option value={config.timezone}>{config.timezone}</option>}</select></label>
      <div className={styles.week}>
        {DAY_ORDER.map(dayNumber => { const day = config.schedule.find(item => item.day === dayNumber) as HoursDay; return <div className={styles.day} data-open={day.open} key={dayNumber}>
          <span className={styles.dayName}>{DAY_LABELS[dayNumber]}</span>
          <label className={styles.dayToggle}><input type="checkbox" checked={day.open} onChange={event => updateDay(dayNumber, { open: event.target.checked, intervals: event.target.checked && !day.intervals.length ? [{ start: "08:00", end: "18:00" }] : day.intervals })} />{day.open ? "Abierto" : "Cerrado"}</label>
          <div className={styles.intervals}>
            {day.open ? <>
              {day.intervals.map((interval, index) => <span className={styles.interval} key={index}>
                <input type="time" aria-label={`${DAY_LABELS[dayNumber]} abre`} value={interval.start} onChange={event => updateDay(dayNumber, { intervals: day.intervals.map((item, position) => position === index ? { ...item, start: event.target.value } : item) })} />a
                <input type="time" aria-label={`${DAY_LABELS[dayNumber]} cierra`} value={interval.end === "24:00" ? "23:59" : interval.end} onChange={event => updateDay(dayNumber, { intervals: day.intervals.map((item, position) => position === index ? { ...item, end: event.target.value } : item) })} />
                {day.intervals.length > 1 && <button className={styles.remove} type="button" aria-label="Quitar turno" onClick={() => updateDay(dayNumber, { intervals: day.intervals.filter((_, position) => position !== index) })}>✕</button>}
              </span>)}
              <button className={styles.link} type="button" disabled={day.intervals.length >= 3} onClick={() => updateDay(dayNumber, { intervals: [...day.intervals, { start: "16:00", end: "19:00" }] })}>+ turno</button>
              {dayNumber === 1 && <button className={styles.link} type="button" onClick={copyMonday}>Copiar a martes–sábado</button>}
            </> : <span className={styles.closedText}>Todo el día fuera de horario</span>}
          </div>
        </div>; })}
      </div>
    </section>

    <section className={styles.card}>
      <header><strong>Días cerrados</strong><small>Festivos o vacaciones: esos días todo el día se considera fuera de horario.</small></header>
      <div className={styles.inline}>
        <label>Fecha<input type="date" value={closedDate} onChange={event => setClosedDate(event.target.value)} /></label>
        <button className="plain-button" type="button" disabled={!closedDate || config.closedDates.includes(closedDate)} onClick={() => { update({ closedDates: [...config.closedDates, closedDate].sort() }); setClosedDate(""); }}>Agregar día</button>
      </div>
      {config.closedDates.length > 0 && <div className={styles.chips}>{config.closedDates.map(date => <span className={styles.chip} key={date}>{new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}<button className={styles.remove} type="button" aria-label={`Quitar ${date}`} onClick={() => update({ closedDates: config.closedDates.filter(item => item !== date) })}>✕</button></span>)}</div>}
    </section>

    <section className={styles.card}>
      <header><strong>Mensaje general</strong><small>Se envía cuando lo que escribe el cliente no coincide con ninguno de los mensajes de abajo (también si manda foto, audio o sticker).</small></header>
      <textarea ref={defaultMessageRef} value={config.defaultMessage} maxLength={4096} onChange={event => update({ defaultMessage: event.target.value })} />
      <div className={styles.tokens}>{PLACEHOLDERS.map(item => <button key={item.token} type="button" title={`Ej. ${item.example}`} onClick={() => insertToken(item.token)}>+ {item.label}</button>)}</div>
      <small className={styles.hint}>«Próxima apertura» se reemplaza por algo como «mañana a las 8:00» y «Horario» por «lunes a sábado de 8:00 a 18:00».</small>
    </section>

    <section className={styles.card}>
      <header><strong>Mensajes según lo que escribe el cliente</strong><small>Como en los escenarios: si el mensaje se parece a alguna de las frases, se envía ese texto en lugar del general. Si coinciden varios, gana el de más arriba.</small></header>
      <div className={styles.rules}>
        {config.rules.map((rule, index) => <article className={styles.rule} key={rule.id}>
          <header><b>MENSAJE {index + 1}</b><div>
            <button className={styles.remove} type="button" aria-label="Subir" disabled={index === 0} onClick={() => moveRule(index, -1)}>↑</button>
            <button className={styles.remove} type="button" aria-label="Bajar" disabled={index === config.rules.length - 1} onClick={() => moveRule(index, 1)}>↓</button>
            <button className={styles.remove} type="button" aria-label="Eliminar mensaje" onClick={() => update({ rules: config.rules.filter((_, position) => position !== index) })}>✕</button>
          </div></header>
          <div style={{ display: "grid", gap: 10 }}>
            <label>Nombre interno<input value={rule.name} maxLength={100} placeholder="Pregunta precios" onChange={event => updateRule(index, { name: event.target.value })} /></label>
            <label>Si el cliente escribe algo como… (una frase por línea)<textarea value={rule.examples.join("\n")} placeholder={"precio\ncuánto cuesta\nlista de precios"} onChange={event => updateRule(index, { examples: event.target.value.split("\n") })} /></label>
          </div>
          <label>Responder<textarea value={rule.body} maxLength={4096} style={{ minHeight: 132 }} placeholder="Estamos fuera de horario. Te compartimos precios {{proxima_apertura}}." onChange={event => updateRule(index, { body: event.target.value })} /></label>
        </article>)}
      </div>
      <div className={styles.inline}>
        <button className="plain-button" type="button" disabled={config.rules.length >= 20} onClick={() => update({ rules: [...config.rules, blankRule()] })}>+ Agregar mensaje</button>
        {config.rules.length === 0 && <button className={styles.link} type="button" onClick={() => update({ rules: ruleExamples.map(rule => ({ ...rule, id: `${rule.id}_${Date.now().toString(36)}` })) })}>Usar ejemplos (precios y envíos)</button>}
      </div>
    </section>

    <section className={styles.card}>
      <header><strong>Qué pasa después del aviso</strong></header>
      <label className={styles.toggle}><input type="checkbox" checked={config.moveToAttention} onChange={event => update({ moveToAttention: event.target.checked })} /><span><b>Mover el lead a «Requiere atención»</b><small>Para que tu equipo lo vea y responda al abrir.</small></span></label>
      <label className={styles.toggle}><input type="checkbox" checked={config.continueAutomations} onChange={event => update({ continueAutomations: event.target.checked })} /><span><b>Dejar que escenarios y respuestas automáticas también contesten</b><small>Apagado (recomendado), fuera de horario solo se envía el aviso. Encendido, el cliente recibe el aviso y además el bot sigue respondiendo.</small></span></label>
      <small className={styles.hint}>Si pausaste el bot en una conversación, no se le envía aviso.</small>
    </section>

    <section className={styles.card}>
      <header><strong>Probar</strong><small>Simula un mensaje con lo que tienes en pantalla, sin guardar ni enviar nada.</small></header>
      <div className={styles.inline}>
        <label>Mensaje del cliente<input value={testText} onChange={event => setTestText(event.target.value)} /></label>
        <label style={{ flex: "0 1 220px" }}>Fecha y hora (vacío = ahora)<input type="datetime-local" value={testAt} onChange={event => setTestAt(event.target.value)} /></label>
        <button className="plain-button" type="button" onClick={() => void test()}>Probar</button>
      </div>
      {previewError && <p className={styles.error} role="alert">{previewError}</p>}
      {preview && <div className={styles.preview} aria-live="polite">
        {preview.open ? <span className={styles.previewMeta}>En ese momento está <b>abierto</b>: no se envía aviso y responde tu equipo o el bot como siempre.</span> : <>
          <span className={styles.previewMeta}>Cerrado · abre {preview.nextOpeningText} · {preview.rule ? <>coincide con <b>{preview.rule.name}</b></> : "se usa el mensaje general"}{!config.enabled && " · (aún no está activado)"}</span>
          <div className={styles.bubble}>{preview.message}</div>
        </>}
      </div>}
    </section>

    {issues.length > 0 && <ul className={styles.issues}>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {saveError && <p className={styles.error} role="alert"><b>No se guardó.</b> {saveError} Tus cambios siguen aquí.</p>}
    {savedNotice && !dirty && <p className={styles.saved} role="status">{savedNotice}</p>}
    <footer className={styles.footer}>
      <span>{dirty ? "Cambios sin guardar" : "Todo guardado"}</span>
      {dirty && <button className="plain-button" type="button" onClick={() => { setConfig(JSON.parse(savedJson)); setSaveError(""); }}>Descartar cambios</button>}
      <button className="primary-action" type="button" disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar horario"}</button>
    </footer>
  </section>;
}
