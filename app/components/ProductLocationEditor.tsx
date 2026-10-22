"use client";

import { useId, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import { draftOf, draftPayload, formatLocation, hasLocation, type LocationDraft, type ProductLocation } from "../lib/product-locations";

type Props = {
  productIds: number[];
  location?: ProductLocation | null;
  options: { rack: string[]; level: string[]; side: string[] };
  onSaved: (rows: ProductLocation[]) => void;
  /** Texto del botón cuando se asigna a varios productos a la vez. */
  bulkLabel?: string;
};

/** Muestra y edita rack, piso y lado. Si falla al guardar, conserva lo escrito. */
export function ProductLocationEditor({ productIds, location, options, onSaved, bulkLabel }: Props) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocationDraft>(() => draftOf(location));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = () => { setDraft(draftOf(location)); setError(""); setEditing(true); };
  const save = async (value: LocationDraft) => {
    setSaving(true); setError("");
    try {
      onSaved(await request<ProductLocation[]>("/inventory-locations", { method: "PUT", body: JSON.stringify(draftPayload(productIds, value)) }));
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la ubicación."); }
    finally { setSaving(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void save(draft); };
  const set = (key: keyof LocationDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));

  if (!editing) return bulkLabel
    ? <button type="button" className="location-bulk-button" onClick={open}>📍 {bulkLabel}</button>
    : <div className={`location-line${hasLocation(location) ? "" : " empty"}`}>
      <span>📍 {hasLocation(location) ? formatLocation(location) : "Sin ubicación"}</span>
      <button type="button" onClick={open}>{hasLocation(location) ? "Cambiar" : "Asignar ubicación"}</button>
    </div>;

  return <form className="location-editor" onSubmit={submit} onKeyDown={event => { if (event.key === "Escape") setEditing(false); }}>
    {bulkLabel && <p className="location-editor-note">Se aplicará a {productIds.length} producto{productIds.length === 1 ? "" : "s"} de esta página.</p>}
    <div className="location-fields">
      <label>Rack<input autoFocus list={`${id}-rack`} value={draft.rack} maxLength={30} placeholder="Ej. A" onChange={event => set("rack", event.target.value)} /></label>
      <label>Piso<input list={`${id}-level`} value={draft.level} maxLength={30} placeholder="Ej. 2" onChange={event => set("level", event.target.value)} /></label>
      <label>Lado<input list={`${id}-side`} value={draft.side} maxLength={30} placeholder="Ej. Izquierdo" onChange={event => set("side", event.target.value)} /></label>
    </div>
    <datalist id={`${id}-rack`}>{options.rack.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-level`}>{options.level.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-side`}>{options.side.map(value => <option key={value} value={value} />)}</datalist>
    {(draft.rack || draft.level || draft.side) && <small className="location-editor-note">Quedará: {formatLocation(draft)}</small>}
    {error && <p className="location-error" role="alert">No se guardó. {error}</p>}
    <div className="location-actions">
      {hasLocation(location) && !bulkLabel && <button type="button" className="location-remove" disabled={saving} onClick={() => void save({ rack: "", level: "", side: "" })}>Quitar ubicación</button>}
      <button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
      <button type="submit" className="location-save" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
    </div>
  </form>;
}
