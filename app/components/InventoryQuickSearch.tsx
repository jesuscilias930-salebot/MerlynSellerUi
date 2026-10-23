"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { controlSession } from "../lib/control-api";
import { cachedInventory, loadInventory, type InventorySnapshot as Snapshot } from "../lib/inventory-snapshot";
import { availabilityMessage, normalizeText, searchInventory, sizeSuggestions, type QuickResult } from "../lib/quick-inventory";
import { colorSwatch } from "../lib/product-colors";

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: value % 1 ? 2 : 0 });
const ago = (time: number) => {
  const seconds = Math.round((Date.now() - time) / 1000);
  return seconds < 60 ? "hace un momento" : `hace ${Math.round(seconds / 60)} min`;
};
const stockLabel = (result: QuickResult) =>
  result.state === "empty" ? "Agotado" : `${result.state === "low" ? "Pocas · " : ""}${result.available} ${result.kind === "bundle" ? (result.available === 1 ? "caja" : "cajas") : (result.available === 1 ? "par" : "pares")}`;

/** Búsqueda rápida de existencias (productos y bundles) desde el chat. */
export function InventoryQuickSearch({ onInsert, autoFocus = true }: { onInsert: (text: string) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Snapshot | null>(cachedInventory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [size, setSize] = useState("");
  const [sizeOpen, setSizeOpen] = useState(false);
  const [sizeActive, setSizeActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const sizeId = useId();

  const load = async (force = false) => {
    setLoading(true); setError("");
    try {
      setData(await loadInventory(force));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo consultar el inventario.");
    } finally { setLoading(false); }
  };
  useEffect(() => {
    void Promise.resolve().then(() => load());
    if (autoFocus) input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Texto y talla se combinan (AND). Solo con talla se listan más productos.
  const results = useMemo(() => data ? searchInventory(query, data.products, data.bundles, query.trim().length >= 2 ? 12 : 30, data.locations, size) : [], [data, query, size]);
  const sizeOptions = useMemo(() => data ? sizeSuggestions(data.products, size) : [], [data, size]);
  const sizeChosen = sizeOptions.some(option => normalizeText(option) === normalizeText(size)) && sizeOptions.length === 1;
  const sizePopup = sizeOpen && sizeOptions.length > 0 && !sizeChosen;
  const chooseSize = (value: string) => { setSize(value); setSizeOpen(false); setSizeActive(-1); setActive(0); };
  const sizeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setSizeOpen(true);
      const count = sizeOptions.length;
      if (count) setSizeActive(index => event.key === "ArrowDown" ? (index + 1) % count : index <= 0 ? count - 1 : index - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (sizePopup) chooseSize(sizeOptions[Math.max(sizeActive, 0)]);
      else setSizeOpen(false);
    } else if (event.key === "Escape" && sizePopup) {
      event.preventDefault(); event.stopPropagation(); setSizeOpen(false);
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(index => (index + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onInsert(availabilityMessage(results[Math.min(active, results.length - 1)]));
    }
  };

  return <div className="inventory-quick">
    <div className="inventory-quick-fields">
    <label className="inventory-quick-input">
        <span className="sr-only">Buscar en inventario</span>
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="Producto, color, talla, categoría, rack o bundle…"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="inventory-quick-results"
          aria-activedescendant={results.length ? `inventory-quick-${active}` : undefined}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={keyDown}
        />
      </label>
      <div className="inventory-quick-size" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSizeOpen(false); }}>
        <label className="sr-only" htmlFor={`${sizeId}-input`}>Talla</label>
        <input
          id={`${sizeId}-input`}
          type="text"
          autoComplete="off"
          value={size}
          placeholder="Talla"
          maxLength={40}
          role="combobox"
          aria-expanded={sizePopup}
          aria-autocomplete="list"
          aria-controls={sizePopup ? `${sizeId}-list` : undefined}
          aria-activedescendant={sizePopup && sizeActive >= 0 ? `${sizeId}-${sizeActive}` : undefined}
          onFocus={() => setSizeOpen(true)}
          onChange={event => { setSize(event.target.value); setSizeOpen(true); setSizeActive(-1); setActive(0); }}
          onKeyDown={sizeKeyDown}
        />
        {size && <button type="button" className="inventory-quick-size-clear" aria-label="Quitar talla" onClick={() => { setSize(""); setSizeActive(-1); setActive(0); }}>✕</button>}
        {sizePopup && <div id={`${sizeId}-list`} role="listbox" aria-label="Tallas" className="inventory-quick-size-list">
          {sizeOptions.map((option, index) => <button key={option} id={`${sizeId}-${index}`} type="button" role="option" tabIndex={-1} aria-selected={index === sizeActive}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setSizeActive(index)} onClick={() => chooseSize(option)}>{option}</button>)}
        </div>}
      </div>
    </div>
    {error && <p className="inventory-quick-error" role="alert">{error} {controlSession.get() && <button type="button" onClick={() => void load(true)}>Reintentar</button>}</p>}
    {!error && loading && !data && <p className="inventory-quick-hint">Cargando inventario…</p>}
    {!error && data && query.trim().length < 2 && !size.trim() && <p className="inventory-quick-hint">Escribe al menos 2 letras o elige una talla. Ej.: «essential negro» con talla «25-28».</p>}
    {!error && data && (query.trim().length >= 2 || size.trim()) && !results.length && <p className="inventory-quick-hint">Sin coincidencias para {[query.trim() && `«${query.trim()}»`, size.trim() && `talla «${size.trim()}»`].filter(Boolean).join(" en ")}.</p>}
    {results.length > 0 && <ul id="inventory-quick-results" role="listbox" aria-label="Resultados de inventario">
      {results.map((result, index) => <li key={`${result.kind}-${result.id}`} id={`inventory-quick-${index}`} role="option" aria-selected={index === active} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)}>
        <span className="inventory-quick-kind" aria-hidden="true">{result.kind === "bundle" ? "🎁" : "🧦"}</span>
        <span className="inventory-quick-copy">
          <b>{result.title}</b>
          {(result.color || result.size) && <span className="inventory-variant">
            {result.color && <span className="inventory-variant-chip"><i className="inventory-color-dot" style={colorSwatch(result.color) ? { background: colorSwatch(result.color) || undefined } : undefined} aria-hidden="true" />{result.color}</span>}
            {result.size && <span className="inventory-variant-chip">Talla {result.size}</span>}
          </span>}
          <small>{[result.detail, result.price ? money(result.price) : ""].filter(Boolean).join(" · ")}</small>
          {result.location && <small className="inventory-quick-location">📍 {result.location}</small>}
        </span>
        <span className={`inventory-quick-stock ${result.state}`}>{stockLabel(result)}</span>
        <button type="button" title="Escribir la respuesta en el mensaje" onClick={() => onInsert(availabilityMessage(result))}>Responder</button>
      </li>)}
    </ul>}
    {data && <footer className="inventory-quick-footer">
      <span>{data.products.length} productos · {data.bundles.length} bundles · actualizado {ago(data.loadedAt)}</span>
      <button type="button" disabled={loading} onClick={() => void load(true)}>{loading ? "Actualizando…" : "Actualizar"}</button>
    </footer>}
  </div>;
}
