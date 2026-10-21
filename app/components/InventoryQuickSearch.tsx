"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { controlSession } from "../lib/control-api";
import { cachedInventory, loadInventory, type InventorySnapshot as Snapshot } from "../lib/inventory-snapshot";
import { availabilityMessage, searchInventory, type QuickResult } from "../lib/quick-inventory";

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
  const input = useRef<HTMLInputElement>(null);

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

  const results = useMemo(() => data ? searchInventory(query, data.products, data.bundles) : [], [data, query]);
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
    <label className="inventory-quick-input">
      <span className="sr-only">Buscar en inventario</span>
      <input
        ref={input}
        type="search"
        value={query}
        placeholder="Producto, talla, categoría o bundle…"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="inventory-quick-results"
        aria-activedescendant={results.length ? `inventory-quick-${active}` : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={keyDown}
      />
    </label>
    {error && <p className="inventory-quick-error" role="alert">{error} {controlSession.get() && <button type="button" onClick={() => void load(true)}>Reintentar</button>}</p>}
    {!error && loading && !data && <p className="inventory-quick-hint">Cargando inventario…</p>}
    {!error && data && query.trim().length < 2 && <p className="inventory-quick-hint">Escribe al menos 2 letras. Ej.: «caricatura niña», «2-4», «deportivo», «50 pares».</p>}
    {!error && data && query.trim().length >= 2 && !results.length && <p className="inventory-quick-hint">Sin coincidencias para «{query.trim()}».</p>}
    {results.length > 0 && <ul id="inventory-quick-results" role="listbox" aria-label="Resultados de inventario">
      {results.map((result, index) => <li key={`${result.kind}-${result.id}`} id={`inventory-quick-${index}`} role="option" aria-selected={index === active} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)}>
        <span className="inventory-quick-kind" aria-hidden="true">{result.kind === "bundle" ? "🎁" : "🧦"}</span>
        <span className="inventory-quick-copy">
          <b>{result.title}</b>
          <small>{[result.detail, result.price ? money(result.price) : ""].filter(Boolean).join(" · ")}</small>
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
