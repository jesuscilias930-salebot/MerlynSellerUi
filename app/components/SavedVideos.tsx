"use client";

import { useCallback, useEffect, useState } from "react";
import { api, request } from "../lib/api";
import { MAX_VIDEO_UPLOAD_BYTES, VIDEO_ACCEPT, videoContentType } from "../lib/video-upload";
import { mediaUploadRequest, progressLabel } from "../lib/media-upload-request";

export type SavedVideo = { id: string; name: string; filename: string | null; bytes: number; chatShortcut: boolean; position: number };

// La lista se comparte entre chats abiertos; solo trae nombres y tamaños, nunca los videos.
let cached: Promise<SavedVideo[]> | null = null;
const load = (fresh = false) => {
  if (!cached || fresh) cached = request<SavedVideo[]>("/settings/saved-videos").catch(error => { cached = null; throw error; });
  return cached;
};

export function useSavedVideos() {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(async (fresh = false) => {
    try { setVideos(await load(fresh)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los videos guardados."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);
  const replace = (next: SavedVideo[]) => { cached = Promise.resolve(next); setVideos(next); };
  return { videos, error, reload, replace };
}

export const sendSavedVideo = (chatId: string, videoId: string) =>
  request(`/conversations/${chatId}/messages/saved-video`, { method: "POST", body: JSON.stringify({ videoId }) });

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type Store = ReturnType<typeof useSavedVideos>;

/** Herramientas → Videos guardados: subir una vez, ver, enviar y marcar como atajo del chat. */
export function SavedVideosPanel({ chatId, store }: { chatId?: string; store: Store }) {
  const { videos, error, reload, replace } = store;
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: "uploading" | "processing"; fraction: number } | null>(null);

  const upload = async () => {
    if (!file || busy) return;
    const mime = videoContentType(file);
    if (!mime) return setNotice("Selecciona un video MP4, MOV, M4V o 3GPP.");
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) return setNotice("El video no puede superar 250 MB.");
    setBusy("upload"); setNotice("");
    try {
      const response = await mediaUploadRequest(`${api}/settings/saved-videos/upload`, {
        method: "POST", credentials: "include", body: file,
        headers: { "Content-Type": mime, "X-Upload-Filename": encodeURIComponent(file.name), "X-Video-Name": encodeURIComponent(name.trim() || file.name.replace(/\.[^.]+$/, "")) },
      }, crypto.randomUUID(), setProgress);
      const body = await response.json().catch(() => ({})) as SavedVideo & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar el video.");
      replace([...videos, body]); setName(""); setFile(null);
      setNotice(`«${body.name}» guardado (${megabytes(body.bytes)}). Ya puedes enviarlo con un clic.`);
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudo guardar el video."); }
    finally { setBusy(""); setProgress(null); }
  };
  const send = async (video: SavedVideo) => {
    if (!chatId || busy) return;
    setBusy(`send-${video.id}`); setNotice("");
    try { await sendSavedVideo(chatId, video.id); setNotice(`«${video.name}» enviado.`); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudo enviar el video."); }
    finally { setBusy(""); }
  };
  const patch = async (video: SavedVideo, changes: Partial<Pick<SavedVideo, "chatShortcut" | "name">>) => {
    replace(videos.map(item => item.id === video.id ? { ...item, ...changes } : item));
    try { await request(`/settings/saved-videos/${video.id}`, { method: "PATCH", body: JSON.stringify(changes) }); }
    catch (reason) { replace(videos); setNotice(reason instanceof Error ? reason.message : "No se pudo guardar el cambio."); }
  };
  const remove = async (video: SavedVideo) => {
    if (!window.confirm(`¿Eliminar el video guardado «${video.name}»? Los mensajes ya enviados no cambian.`)) return;
    try { await request(`/settings/saved-videos/${video.id}`, { method: "DELETE" }); replace(videos.filter(item => item.id !== video.id)); if (preview === video.id) setPreview(null); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudo eliminar el video."); }
  };

  return <div className="saved-videos">
    <div className="saved-videos-upload">
      <input value={name} maxLength={120} onChange={event => setName(event.target.value)} placeholder="Nombre, p. ej. Recorrido de la bodega" />
      <label className="saved-videos-file">{file ? `🎬 ${file.name} · ${megabytes(file.size)}` : "Elegir video (hasta 250 MB)"}<input type="file" accept={VIDEO_ACCEPT} onChange={event => { setFile(event.target.files?.[0] || null); event.target.value = ""; }} /></label>
      <button type="button" className="tool-primary-button" disabled={!file || Boolean(busy)} onClick={() => void upload()}>{busy === "upload" ? progressLabel(progress || undefined) : "Guardar video"}</button>
      {busy === "upload" && progress && <span className="chat-upload-bar saved-videos-progress" role="progressbar" aria-label="Avance de la subida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}><span style={{ width: `${Math.round(progress.fraction * 100)}%` }} className={progress.phase === "processing" ? "indeterminate" : ""} /></span>}
      <small>Se sube y prepara una sola vez; después se envía al instante a cualquier chat.</small>
    </div>
    {error && <p className="tool-notice">{error} <button type="button" className="plain-button" onClick={() => void reload(true)}>Reintentar</button></p>}
    {videos.map(video => <article key={video.id} className="saved-video">
      <div className="saved-video-head">
        <b>🎬 {video.name}</b><small>{megabytes(video.bytes)}</small>
      </div>
      {preview === video.id && <video src={`${api}/settings/saved-videos/${video.id}/media`} controls playsInline preload="metadata" />}
      <div className="saved-video-actions">
        <button type="button" className="tool-primary-button" disabled={!chatId || Boolean(busy)} onClick={() => void send(video)}>{busy === `send-${video.id}` ? "Enviando…" : "Enviar"}</button>
        <button type="button" className="plain-button" onClick={() => setPreview(current => current === video.id ? null : video.id)}>{preview === video.id ? "Ocultar" : "▶ Ver"}</button>
        <button type="button" className="plain-button" onClick={() => void remove(video)}>Eliminar</button>
      </div>
      <label className="saved-image-shortcut"><input type="checkbox" checked={video.chatShortcut} onChange={event => void patch(video, { chatShortcut: event.target.checked })} /> Botón de atajo en el chat</label>
    </article>)}
    {!videos.length && !error && <small className="saved-videos-empty">Aún no tienes videos guardados.</small>}
    {notice && <p className="tool-notice" role="status">{notice}</p>}
  </div>;
}
