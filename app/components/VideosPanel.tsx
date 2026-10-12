"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import { blankVideo, videoChannelName, videoDateLabel, videoDraft, videoListPath, videoScheduleLabel, type ContentVideo, type VideoChannel, type VideoDraft, type VideoPage, type VideoStatus } from "../lib/content-videos";
import { AppNavIcon } from "./AppNavIcon";
import styles from "./VideosPanel.module.css";

const message = (error: unknown) => error instanceof Error ? error.message : "No pudimos completar la solicitud. Intenta nuevamente.";
const localToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

export function VideosPanel() {
  const [channel, setChannel] = useState<VideoChannel>("organic");
  return <section className={styles.panel} aria-label="Organización de videos">
    <header className={styles.heading}><div><small>PLAN DE CONTENIDO</small><h1>Videos</h1><p>Tus ideas, grabaciones y publicaciones, en un solo lugar.</p></div><span className={styles.headingIcon}><AppNavIcon name="video"/></span></header>
    <div className={styles.tabs} role="tablist" aria-label="Tipo de contenido">
      {(["organic", "ads"] as const).map(value => <button type="button" key={value} role="tab" id={`video-tab-${value}`} aria-selected={channel === value} aria-controls={`video-panel-${value}`} tabIndex={channel === value ? 0 : -1}
        onClick={() => setChannel(value)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "organic" : event.key === "End" ? "ads" : channel === "organic" ? "ads" : "organic"; setChannel(next); document.getElementById(`video-tab-${next}`)?.focus(); } }}>
        {videoChannelName(value)}<small>{value === "organic" ? "Contenido sin anuncios" : "Creativos para campañas"}</small>
      </button>)}
    </div>
    <VideoWorkspace key={channel} channel={channel}/>
  </section>;
}

function VideoWorkspace({ channel }: { channel: VideoChannel }) {
  const [query, setQuery] = useState(""), [settledQuery, setSettledQuery] = useState("");
  const [status, setStatus] = useState<VideoStatus>("all"), [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: VideoPage; error?: string }>();
  const [editor, setEditor] = useState<{ video?: ContentVideo } | null>(null);
  const [action, setAction] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const path = videoListPath(channel, status, settledQuery, page), key = `${path}:${revision}`;
  const current = result?.key === key ? result : undefined;
  const today = localToday();
  const summary = current?.data?.stats;
  const searchId = useId();
  useEffect(() => { const timer = window.setTimeout(() => { setSettledQuery(query.trim()); setPage(0); }, 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    request<VideoPage>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: message(error) }); });
    return () => controller.abort();
  }, [path, key]);
  function refresh() { setRevision(value => value + 1); }
  async function toggle(video: ContentVideo) {
    if (action) return;
    setAction(video.id); setError(""); setNotice("");
    try {
      await request(`/content-videos/${video.id}/published`, { method: "PATCH", body: JSON.stringify({ isPublished: !video.isPublished, revision: video.revision }) });
      setNotice(video.isPublished ? "Video marcado como pendiente." : "Video marcado como publicado."); refresh();
    } catch (error) { setError(message(error)); }
    finally { setAction(""); }
  }
  async function remove(video: ContentVideo) {
    if (action || !window.confirm(`¿Eliminar “${video.title}”? Se eliminarán también su guion, fechas y notas. Esta acción no se puede deshacer.`)) return;
    setAction(video.id); setError(""); setNotice("");
    try {
      await request(`/content-videos/${video.id}`, { method: "DELETE", body: JSON.stringify({ revision: video.revision }) });
      setNotice("Video eliminado."); if (current?.data?.items.length === 1 && page > 0) setPage(page - 1); else refresh();
    } catch (error) { setError(message(error)); }
    finally { setAction(""); }
  }
  return <div role="tabpanel" id={`video-panel-${channel}`} aria-labelledby={`video-tab-${channel}`} className={styles.workspace}>
    <div className={styles.summary}><div><span>Videos</span><strong>{summary?.total ?? "—"}</strong></div><div><span>Por publicar</span><strong>{summary?.pending ?? "—"}</strong></div><div><span>Publicados</span><strong>{summary?.published ?? "—"}</strong></div></div>
    <div className={styles.toolbar}>
      <label htmlFor={searchId}>Buscar por título<input id={searchId} type="search" value={query} maxLength={120} placeholder="Encuentra una idea o video…" onChange={event => setQuery(event.target.value)}/></label>
      <label>Estado<select value={status} onChange={event => { setStatus(event.target.value as VideoStatus); setPage(0); }}><option value="all">Todos</option><option value="pending">Por publicar</option><option value="published">Publicados</option></select></label>
      <button type="button" className={styles.primary} onClick={() => { setError(""); setNotice(""); setEditor({}); }}>＋ Nuevo video</button>
    </div>
    <div className={styles.listHeading}><p>{channel === "organic" ? "Planea el contenido para tu comunidad." : "Organiza los videos de tus campañas publicitarias."}</p><button type="button" className={styles.secondary} disabled={!!action} onClick={() => { setError(""); refresh(); }}>Actualizar</button></div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {(error || current?.error) && <div role="alert" className={styles.error}><span>{error || current?.error}</span><button type="button" className={styles.secondary} disabled={!!action} onClick={() => { setError(""); refresh(); }}>Reintentar / actualizar</button></div>}
    {!current && <p role="status" className={styles.loading}>Cargando videos…</p>}
    {current?.data?.total === 0 && <div className={styles.empty}><AppNavIcon name="video"/><h2>{settledQuery || status !== "all" ? "No hay videos con estos filtros" : "Tu siguiente video empieza aquí"}</h2><p>{settledQuery || status !== "all" ? "Prueba otro título o estado." : "Guarda una idea, prepara el guion y define cuándo grabarla y publicarla."}</p><button type="button" className={styles.secondary} onClick={() => { if (settledQuery || status !== "all") { setQuery(""); setSettledQuery(""); setStatus("all"); setPage(0); } else setEditor({}); }}>{settledQuery || status !== "all" ? "Quitar filtros" : "Crear mi primer video"}</button></div>}
    <div className={styles.cards} aria-busy={!current}>{current?.data?.items.map(video => <article key={video.id} className={styles.card}>
      <header><span className={`${styles.badge} ${video.isPublished ? styles.published : video.publishingDate && video.publishingDate <= today ? styles.due : ""}`}>{videoScheduleLabel(video, today)}</span><small>{videoChannelName(video.channel)}</small></header>
      <h2>{video.title}</h2>
      <div className={styles.dates}><div><span>Grabar</span><strong>{videoDateLabel(video.recordingDate)}</strong></div><div><span>Publicar</span><strong>{videoDateLabel(video.publishingDate)}</strong></div></div>
      <div className={styles.preparation} aria-label="Preparación del video">{([["Guion", video.script], ["Tomas", video.shots], ["Prompts", video.prompts]] as const).map(([label, text]) => <span className={text ? styles.ready : ""} key={label}>{text ? "✓" : "○"} {label}</span>)}</div>
      <p className={styles.notes}><b>Notas y resultados</b><span>{video.resultNotes || "Anota aquí lo que aprendiste y cómo funcionó el video."}</span></p>
      <label className={styles.publishedControl}><input type="checkbox" checked={video.isPublished} disabled={!!action} onChange={() => void toggle(video)}/>{action === video.id ? "Guardando…" : "Ya está publicado"}</label>
      <footer><button type="button" className={styles.secondary} disabled={!!action} onClick={() => setEditor({ video })}>Ver / editar</button><button type="button" className={styles.danger} disabled={!!action} aria-label={`Eliminar ${video.title}`} onClick={() => void remove(video)}>Eliminar</button></footer>
    </article>)}</div>
    {!!current?.data?.total && current.data.total > current.data.size && <div className={styles.pagination} aria-label="Páginas de videos"><button type="button" className={styles.secondary} disabled={!page} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(current.data.total / current.data.size)} · {current.data.total} videos</span><button type="button" className={styles.secondary} disabled={(page + 1) * current.data.size >= current.data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
    {editor && <VideoEditor channel={channel} video={editor.video} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setPage(0); refresh(); setNotice("Video guardado."); }}/>}
  </div>;
}

function VideoEditor({ channel, video, onClose, onSaved }: { channel: VideoChannel; video?: ContentVideo; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), form = useRef<HTMLFormElement>(null), titleInput = useRef<HTMLInputElement>(null);
  const [initial] = useState(() => video ? videoDraft(video) : blankVideo(channel));
  const [draft, setDraft] = useState<VideoDraft>(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const id = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); titleInput.current?.focus(); return () => element?.close(); }, []);
  function change<K extends keyof VideoDraft>(field: K, value: VideoDraft[K]) { setDraft(current => ({ ...current, [field]: value })); }
  function close() { if (busy) return; if (JSON.stringify(draft) !== JSON.stringify(initial) && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos y cerrar?")) return; onClose(); }
  async function save(event: FormEvent) {
    event.preventDefault(); const element = form.current; if (busy || !element?.reportValidity()) return;
    if (!draft.title.trim()) { setError("Escribe un título para el video."); return; }
    const fields = new FormData(element);
    const payload = { ...draft, recordingDate: String(fields.get("recordingDate") || "") || null, publishingDate: String(fields.get("publishingDate") || "") || null };
    setBusy(true); setError("");
    try {
      await request(video ? `/content-videos/${video.id}` : "/content-videos", { method: video ? "PUT" : "POST", body: JSON.stringify(video ? { ...payload, revision: video.revision } : payload) });
      onSaved();
    } catch (error) { setError(message(error)); setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.editor} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}>
    <form ref={form} onSubmit={save}>
      <header><div><small>{videoChannelName(channel).toLocaleUpperCase("es-MX")}</small><h2 id={`${id}-title`}>{video ? "Editar video" : "Nuevo video"}</h2></div><button type="button" className={styles.close} disabled={busy} aria-label="Cerrar editor" onClick={close}>×</button></header>
      <div className={styles.editorBody}><fieldset disabled={busy}>
        <label>Título del video<input ref={titleInput} type="text" required maxLength={160} value={draft.title} placeholder="Ej. Cómo armar tu primer pedido de mayoreo" onChange={event => change("title", event.target.value)}/></label>
        <div className={styles.dateFields}><label>Fecha de grabación<input name="recordingDate" type="date" min="1900-01-01" max="9999-12-31" value={draft.recordingDate || ""} onInput={event => change("recordingDate", event.currentTarget.value || null)} onChange={event => change("recordingDate", event.target.value || null)}/></label><label>Fecha de publicación<input name="publishingDate" type="date" min="1900-01-01" max="9999-12-31" value={draft.publishingDate || ""} onInput={event => change("publishingDate", event.currentTarget.value || null)} onChange={event => change("publishingDate", event.target.value || null)}/></label></div>
        <p className={styles.dateHint}>Estas fechas organizan tu plan; no publican el video automáticamente.</p>
        <div className={styles.textFields}><label>Guion<textarea rows={6} maxLength={20000} value={draft.script} placeholder="Gancho inicial, desarrollo y llamada a la acción…" onChange={event => change("script", event.target.value)}/></label><label>Tomas<textarea rows={6} maxLength={10000} value={draft.shots} placeholder="1. Presentación frente a cámara&#10;2. Acercamiento al producto&#10;3. Paquete terminado" onChange={event => change("shots", event.target.value)}/></label><label className={styles.full}>Prompts<textarea rows={4} maxLength={20000} value={draft.prompts} placeholder="Guarda las instrucciones que usarás para crear imágenes, ideas o versiones del guion…" onChange={event => change("prompts", event.target.value)}/></label></div>
        <div className={styles.resultSection}><h3>Seguimiento</h3><label className={styles.publishedControl}><input type="checkbox" checked={draft.isPublished} onChange={event => change("isPublished", event.target.checked)}/>Ya está publicado</label><label>Notas y resultados<textarea rows={4} maxLength={10000} value={draft.resultNotes} placeholder="Vistas, mensajes recibidos, ventas, costo de anuncios, aprendizajes o cambios para el próximo video…" onChange={event => change("resultNotes", event.target.value)}/></label></div>
      </fieldset>{error && <p role="alert" className={styles.error}>{error}</p>}</div>
      <footer><span>Solo el título es obligatorio.</span><button type="button" className={styles.secondary} disabled={busy} onClick={close}>Cancelar</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Guardando…" : "Guardar video"}</button></footer>
    </form>
  </dialog>;
}
