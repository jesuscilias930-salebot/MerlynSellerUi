"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../lib/api";
import { accuracyLabel, geolocationError, isShortMapsLink, mapsUrl, parseCoordinates, type BusinessLocation, type SharedLocation } from "../lib/location";
import styles from "./LocationSender.module.css";

type Position = { latitude: number; longitude: number; accuracy: number };

/** GPS del navegador (celular o compu). En compu suele ser aproximado (Wi-Fi). */
function currentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { reject(new Error("Este navegador no permite obtener tu ubicación.")); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      error => reject(new Error(geolocationError(error.code))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const sendLocation = (chatId: string, body: Record<string, unknown>) =>
  request<{ id: string }>(`/conversations/${chatId}/messages/location`, { method: "POST", body: JSON.stringify(body) });

// La bodega guardada se comparte entre los chats abiertos; se vuelve a pedir al guardar.
let cached: Promise<BusinessLocation | null> | null = null;
const loadBusinessLocation = (fresh = false) => {
  if (!cached || fresh) cached = request<{ location: BusinessLocation | null }>("/settings/business-location").then(data => data.location).catch(error => { cached = null; throw error; });
  return cached;
};

function useBusinessLocation() {
  const [location, setLocation] = useState<BusinessLocation | null | undefined>(undefined);
  const [error, setError] = useState("");
  const reload = useCallback(async (fresh = false) => {
    try { setLocation(await loadBusinessLocation(fresh)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar la ubicación de la bodega."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);
  return { location, error, reload, setLocation };
}

/** Envía la ubicación actual: pide el GPS, muestra la precisión y confirma antes de mandar. */
async function sendCurrent(chatId: string, name?: string) {
  const position = await currentPosition();
  if (!window.confirm(`¿Enviar tu ubicación actual al cliente?\nPrecisión ${accuracyLabel(position.accuracy)}${position.accuracy > 500 ? " (aproximada: en celular con GPS es más exacta)" : ""}.`)) return false;
  await sendLocation(chatId, { latitude: position.latitude, longitude: position.longitude, ...(name?.trim() ? { name: name.trim() } : {}) });
  return true;
}

async function sendSaved(chatId: string, location: BusinessLocation) {
  if (!window.confirm(`¿Enviar la ubicación de ${location.name || "la bodega"}?`)) return false;
  await sendLocation(chatId, { source: "saved" });
  return true;
}

/** Dos botones rápidos junto a «PDF / Imágenes / Video». */
export function LocationQuickCards({ chatId, disabled, onNotice, onDone, onConfigure }: { chatId?: string; disabled?: boolean; onNotice: (text: string) => void; onDone?: () => void; onConfigure: () => void }) {
  const [busy, setBusy] = useState<"current" | "saved" | null>(null);
  const run = async (kind: "current" | "saved") => {
    if (!chatId || busy) return;
    setBusy(kind);
    try {
      let sent: boolean;
      if (kind === "current") sent = await sendCurrent(chatId);
      else {
        const saved = await loadBusinessLocation();
        if (!saved) { onNotice("Aún no guardas la ubicación de la bodega: configúrala en «Ubicación»."); onConfigure(); return; }
        sent = await sendSaved(chatId, saved);
      }
      if (sent) { onNotice("Ubicación enviada."); onDone?.(); }
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : "No se pudo enviar la ubicación."); }
    finally { setBusy(null); }
  };
  return <>
    <button type="button" disabled={disabled || !chatId || Boolean(busy)} onClick={() => void run("current")}><b>📍</b><small>{busy === "current" ? "Ubicando…" : "Mi ubicación"}</small></button>
    <button type="button" disabled={disabled || !chatId || Boolean(busy)} onClick={() => void run("saved")}><b>🏬</b><small>{busy === "saved" ? "Enviando…" : "Bodega"}</small></button>
  </>;
}

type Draft = { name: string; address: string; link: string; latitude: string; longitude: string };
const draftFrom = (location?: BusinessLocation | null): Draft => ({ name: location?.name || "", address: location?.address || "", link: "", latitude: location ? String(location.latitude) : "", longitude: location ? String(location.longitude) : "" });

/** Panel completo en Herramientas → Ubicación: enviar y configurar la bodega. */
export function LocationSender({ chatId, disabled }: { chatId?: string; disabled?: boolean }) {
  const business = useBusinessLocation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftFrom());
  const [locating, setLocating] = useState(false);

  const run = async (kind: string, action: () => Promise<boolean>, done: string) => {
    setBusy(kind); setNotice("");
    try { if (await action()) setNotice(done); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudo completar."); }
    finally { setBusy(""); }
  };
  const startEdit = () => { setDraft(draftFrom(business.location)); setEditing(true); setNotice(""); };
  const update = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));
  const pasteLink = (link: string) => {
    const found = parseCoordinates(link);
    update(found ? { link, latitude: String(found.latitude), longitude: String(found.longitude) } : { link });
  };
  const takeCurrentForBodega = async () => {
    setLocating(true); setNotice("");
    try { const position = await currentPosition(); update({ latitude: position.latitude.toFixed(6), longitude: position.longitude.toFixed(6) }); setNotice(`Ubicación tomada (${accuracyLabel(position.accuracy)}). Revísala en el mapa antes de guardar.`); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación."); }
    finally { setLocating(false); }
  };
  const coords = parseCoordinates(`${draft.latitude},${draft.longitude}`);
  const linkHint = draft.link.trim() && !parseCoordinates(draft.link)
    ? isShortMapsLink(draft.link) ? "Ese enlace corto no trae las coordenadas: ábrelo en el navegador y copia el enlace largo de la barra de direcciones." : "No encontré coordenadas en ese texto."
    : "";
  const save = () => run("save", async () => {
    if (!coords) throw new Error("Indica la ubicación: pega un enlace de Google Maps, usa tu ubicación actual o escribe latitud y longitud.");
    const saved = await request<{ location: BusinessLocation }>("/settings/business-location", { method: "PUT", body: JSON.stringify({ ...coords, name: draft.name, address: draft.address }) });
    await loadBusinessLocation(true); business.setLocation(saved.location); setEditing(false);
    return true;
  }, "Ubicación de la bodega guardada.");
  const remove = () => run("remove", async () => {
    if (!window.confirm("¿Quitar la ubicación guardada de la bodega?")) return false;
    await request("/settings/business-location", { method: "DELETE" });
    await loadBusinessLocation(true); business.setLocation(null); setEditing(false);
    return true;
  }, "Ubicación de la bodega eliminada.");

  const location = business.location;
  return <div className={styles.panel}>
    <section className={styles.block}>
      <b>Mi ubicación actual</b>
      <small>Usa el GPS de este dispositivo. En WhatsApp llega como pin de mapa; en Messenger e Instagram como enlace de Google Maps.</small>
      <input value={name} maxLength={160} onChange={event => setName(event.target.value)} placeholder="Nombre del lugar (opcional)" />
      <button type="button" className="tool-primary-button" disabled={disabled || !chatId || Boolean(busy)} onClick={() => void run("current", () => sendCurrent(chatId!, name), "Ubicación actual enviada.")}>{busy === "current" ? "Obteniendo ubicación…" : "📍 Enviar mi ubicación actual"}</button>
    </section>

    <section className={styles.block}>
      <b>Bodega</b>
      {business.error && <small className={styles.error}>{business.error} <button type="button" className="plain-button" onClick={() => void business.reload(true)}>Reintentar</button></small>}
      {location === undefined && !business.error && <small>Cargando…</small>}
      {location && !editing && <>
        <a className={styles.card} href={mapsUrl(location)} target="_blank" rel="noreferrer"><b>🏬 {location.name || "Bodega"}</b><small>{location.address || `${location.latitude}, ${location.longitude}`}</small><small className={styles.link}>Ver en el mapa ↗</small></a>
        <div className={styles.row}>
          <button type="button" className="tool-primary-button" disabled={disabled || !chatId || Boolean(busy)} onClick={() => void run("saved", () => sendSaved(chatId!, location), "Ubicación de la bodega enviada.")}>{busy === "saved" ? "Enviando…" : "Enviar bodega"}</button>
          <button type="button" className="plain-button" onClick={startEdit}>Editar</button>
        </div>
      </>}
      {location === null && !editing && <>
        <small>Guárdala una vez y envíala con un clic a cualquier cliente.</small>
        <button type="button" className="plain-button" onClick={startEdit}>Configurar bodega</button>
      </>}
      {editing && <div className={styles.editor}>
        <input value={draft.name} maxLength={160} onChange={event => update({ name: event.target.value })} placeholder="Nombre, p. ej. Bodega Merlyn Mayoreo" />
        <input value={draft.address} maxLength={512} onChange={event => update({ address: event.target.value })} placeholder="Dirección (calle, colonia, ciudad)" />
        <input value={draft.link} onChange={event => pasteLink(event.target.value)} placeholder="Pega el enlace de Google Maps o «18.85, -97.10»" />
        {linkHint && <small className={styles.error}>{linkHint}</small>}
        <button type="button" className="plain-button" disabled={locating} onClick={() => void takeCurrentForBodega()}>{locating ? "Obteniendo…" : "📍 Usar mi ubicación actual (si estás en la bodega)"}</button>
        <div className={styles.row}>
          <input inputMode="decimal" value={draft.latitude} onChange={event => update({ latitude: event.target.value })} placeholder="Latitud" aria-label="Latitud" />
          <input inputMode="decimal" value={draft.longitude} onChange={event => update({ longitude: event.target.value })} placeholder="Longitud" aria-label="Longitud" />
        </div>
        {coords && <a className={styles.link} href={mapsUrl(coords as SharedLocation)} target="_blank" rel="noreferrer">Revisar el punto en el mapa ↗</a>}
        <div className={styles.row}>
          <button type="button" className="tool-primary-button" disabled={Boolean(busy) || !coords} onClick={() => void save()}>{busy === "save" ? "Guardando…" : "Guardar bodega"}</button>
          <button type="button" className="plain-button" onClick={() => { setEditing(false); setNotice(""); }}>Cancelar</button>
          {location && <button type="button" className="plain-button" disabled={Boolean(busy)} onClick={() => void remove()}>Quitar</button>}
        </div>
      </div>}
    </section>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </div>;
}
