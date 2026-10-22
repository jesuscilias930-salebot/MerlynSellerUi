"use client";

import { useId, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import { COMMON_COLORS } from "../lib/product-colors";
import {
  emptySlotDraft, formatLocation, slotDrafts, slotIssues, slotLabel, slotPayload, slotPieces,
  type LocationSlot, type SlotDraft,
} from "../lib/product-locations";

type Options = { rack: string[]; level: string[]; side: string[]; size: string[] };

/**
 * Ubicaciones por talla y/o color de un producto que en Control tiene un solo stock.
 * Ej.: Essential High Quality → Talla 25-28 · Negro en Rack A · Piso 2.
 */
export function ProductLocationSlots({ productId, productName, stock, slots, options, onSaved }: {
  productId: number; productName: string; stock: number; slots: LocationSlot[]; options: Options; onSaved: (productId: number, rows: LocationSlot[]) => void;
}) {
  const id = useId();
  const [drafts, setDrafts] = useState<SlotDraft[] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = () => {
    const current = slotDrafts(slots);
    setDrafts(current.length ? current : [emptySlotDraft()]);
    setAttempted(false);
    setError("");
  };
  const set = (key: string, patch: Partial<SlotDraft>) => setDrafts(current => current?.map(draft => draft.key === key ? { ...draft, ...patch } : draft) || null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!drafts) return;
    setAttempted(true);
    if (slotIssues(drafts).length) return;
    setSaving(true); setError("");
    try {
      const rows = await request<LocationSlot[]>(`/inventory-locations/slots/${productId}`, { method: "PUT", body: JSON.stringify(slotPayload(drafts)) });
      onSaved(productId, Array.isArray(rows) ? rows : []);
      setDrafts(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar las ubicaciones.");
    } finally {
      setSaving(false);
    }
  };

  if (!drafts) {
    const pieces = slotPieces(slots);
    if (!slots.length) return <button type="button" className="slot-add-button" onClick={open}>＋ Ubicar por talla o color</button>;
    return <section className="slot-summary" aria-label={`Ubicaciones por talla y color de ${productName}`}>
      <header><strong>Por talla y color</strong><button type="button" onClick={open}>Editar</button></header>
      <ul>{slots.map(slot => <li key={`${slot.size}|${slot.color}`}>
        <b>{slotLabel(slot)}</b>
        <span>📍 {formatLocation(slot)}</span>
        {slot.quantity != null && <em>{slot.quantity} pzas</em>}
      </li>)}</ul>
      {pieces > 0 && <small className={pieces > stock ? "slot-warning" : undefined}>{pieces > stock ? `Las filas suman ${pieces} piezas y el stock es ${stock}. Revisa las cantidades.` : `${pieces} de ${stock} piezas ubicadas por talla o color.`}</small>}
    </section>;
  }

  const issues = attempted ? slotIssues(drafts) : [];
  const pieces = slotPieces(drafts.map(draft => ({ quantity: draft.quantity })));
  return <form className="slot-editor" onSubmit={save} onKeyDown={event => { if (event.key === "Escape" && !saving) setDrafts(null); }}>
    <header>
      <strong>Ubicación por talla y color</strong>
      <small>Una fila por cada talla o color que guardas en un lugar distinto. Las piezas son opcionales.</small>
    </header>
    <div className="slot-rows" role="table" aria-label="Ubicaciones por talla y color">
      <div className="slot-row slot-head" role="row">
        <span role="columnheader">Talla</span><span role="columnheader">Color</span><span role="columnheader">Piezas</span>
        <span role="columnheader">Rack</span><span role="columnheader">Piso</span><span role="columnheader">Lado</span><span aria-hidden="true" />
      </div>
      {drafts.map((draft, index) => <div key={draft.key} className="slot-row" role="row">
        <label><span>Talla</span><input list={`${id}-size`} value={draft.size} maxLength={40} placeholder="Ej. 25-28" onChange={event => set(draft.key, { size: event.target.value })} autoFocus={index === drafts.length - 1 && !draft.size} /></label>
        <label><span>Color</span><input list={`${id}-color`} value={draft.color} maxLength={40} placeholder="Opcional" onChange={event => set(draft.key, { color: event.target.value })} /></label>
        <label><span>Piezas</span><input type="number" min="0" step="1" inputMode="numeric" value={draft.quantity} placeholder="—" onChange={event => set(draft.key, { quantity: event.target.value })} /></label>
        <label><span>Rack</span><input list={`${id}-rack`} value={draft.rack} maxLength={30} placeholder="Ej. A" onChange={event => set(draft.key, { rack: event.target.value })} /></label>
        <label><span>Piso</span><input list={`${id}-level`} value={draft.level} maxLength={30} placeholder="Ej. 2" onChange={event => set(draft.key, { level: event.target.value })} /></label>
        <label><span>Lado</span><input list={`${id}-side`} value={draft.side} maxLength={30} placeholder="Ej. Izq." onChange={event => set(draft.key, { side: event.target.value })} /></label>
        <button type="button" className="slot-remove" aria-label={`Quitar fila ${index + 1}`} title="Quitar fila" onClick={() => setDrafts(current => current?.filter(item => item.key !== draft.key) || null)}>✕</button>
      </div>)}
    </div>
    <datalist id={`${id}-size`}>{options.size.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-color`}>{COMMON_COLORS.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-rack`}>{options.rack.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-level`}>{options.level.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-side`}>{options.side.map(value => <option key={value} value={value} />)}</datalist>
    <button type="button" className="slot-add-row" disabled={drafts.length >= 100} onClick={() => setDrafts(current => [...(current || []), emptySlotDraft(current?.at(-1))])}>＋ Agregar talla o color</button>
    {pieces > 0 && <small className={pieces > stock ? "slot-warning" : "location-editor-note"}>Repartidas {pieces} de {stock} piezas{pieces > stock ? ": es más de lo que hay en stock." : "."}</small>}
    {issues.length > 0 && <ul className="slot-issues" role="alert">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {error && <p className="location-error" role="alert">No se guardó. {error}</p>}
    <div className="location-actions">
      <button type="button" disabled={saving} onClick={() => setDrafts(null)}>Cancelar</button>
      <button type="submit" className="location-save" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
    </div>
  </form>;
}
