"use client";

import { useEffect, useRef, useState } from "react";
import { quoteBundleRef } from "../lib/quote";
import type { QuoteBundleRef } from "../lib/types";
import { useControlBundles } from "./useControlBundles";

/** «(Paquete 100) cambiar» junto al nombre del cliente. */
export function QuoteBundlePicker({ value, onChange }: { value: QuoteBundleRef | null; onChange: (bundle: QuoteBundleRef | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [saving, setSaving] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const { bundles, loading, error, retry } = useControlBundles(open);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const choose = async (bundle: QuoteBundleRef | null) => {
    setSaving(true);
    try { await onChange(bundle); setOpen(false); } finally { setSaving(false); }
  };
  return <span className="quote-bundle" ref={anchor}>
    {value && <span className="quote-bundle-name" title="Paquete con el que abre el cotizador">({value.name})</span>}
    <button type="button" className="quote-bundle-change" aria-expanded={open} aria-label={value ? `Cambiar el paquete ${value.name}` : "Elegir paquete para cotizar"} onClick={() => { const rect = anchor.current?.getBoundingClientRect(); if (rect) setPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) }); setOpen(current => !current); }}>{value ? "cambiar" : "+ paquete"}</button>
    {open && <div className="quote-bundle-popover" style={position} role="dialog" aria-label="Paquete para cotizar" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      <b className="quote-bundle-title">Paquete para cotizar</b>
      {loading && <small role="status">Cargando bundles…</small>}
      {error && <small role="alert">{error} <button type="button" onClick={retry}>Reintentar</button></small>}
      <div className="quote-bundle-options">
        {bundles.map(bundle => <button key={bundle.id} type="button" disabled={saving} className={value?.id === String(bundle.id) ? "selected" : ""} onClick={() => void choose(quoteBundleRef(bundle))}>{bundle.name}</button>)}
      </div>
      {value && <button type="button" className="quote-bundle-clear" disabled={saving} onClick={() => void choose(null)}>Quitar paquete</button>}
    </div>}
  </span>;
}

/** Campo del escenario: el paquete con el que abrirá el cotizador de los chats que lo activen. */
export function ScenarioQuoteBundleField({ value, onChange }: { value: QuoteBundleRef | null; onChange: (bundle: QuoteBundleRef | null) => void }) {
  const { bundles, loading, error, retry } = useControlBundles(true);
  const known = !value || bundles.some(bundle => String(bundle.id) === value.id);
  return <label className="scenario-quote-bundle">
    Paquete para cotizar
    <select value={value?.id || ""} onChange={event => { const bundle = bundles.find(item => String(item.id) === event.target.value); onChange(bundle ? quoteBundleRef(bundle) : null); }}>
      <option value="">{loading ? "Cargando bundles…" : "Sin paquete"}</option>
      {!known && value && <option value={value.id}>{value.name}</option>}
      {bundles.map(bundle => <option key={bundle.id} value={String(bundle.id)}>{bundle.name}</option>)}
    </select>
    <small>Cuando este escenario se active, el chat mostrará este paquete junto al nombre y el cotizador abrirá con él.</small>
    {error && <small role="alert">{error} <button type="button" onClick={retry}>Reintentar</button></small>}
  </label>;
}
