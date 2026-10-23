"use client";

import { useEffect, useMemo, useState } from "react";
import { cachedInventory, loadInventory, type InventorySnapshot } from "../lib/inventory-snapshot";
import { searchInventory } from "../lib/quick-inventory";
import type { DeliveryLine } from "../lib/deliveries";

/** Busca en el inventario y agrega productos o bundles; opcionalmente texto libre. */
export function InventoryPicker({ onPick, allowCustom = false, placeholder = "Buscar producto o bundle…" }: { onPick: (line: DeliveryLine) => void; allowCustom?: boolean; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<InventorySnapshot | null>(cachedInventory);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadInventory().then(snapshot => { if (active) setData(snapshot); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar el inventario."); });
    return () => { active = false; };
  }, []);
  const results = useMemo(() => (data ? searchInventory(query, data.products, data.bundles, 6, data.locations) : []), [data, query]);
  const pick = (line: DeliveryLine) => { onPick(line); setQuery(""); };
  return <div className="inventory-picker">
    <input type="search" value={query} placeholder={placeholder} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (results[0]) pick({ kind: results[0].kind, id: results[0].id, name: results[0].title, quantity: 1 });
      else if (allowCustom && query.trim()) pick({ kind: "custom", name: query.trim(), quantity: 1 });
    }} />
    {error && <small className="inventory-picker-note">{error}{allowCustom ? " Puedes escribir el producto como texto." : ""}</small>}
    {query.trim().length >= 2 && <ul>
      {results.map(result => <li key={`${result.kind}-${result.id}`}>
        <button type="button" onClick={() => pick({ kind: result.kind, id: result.id, name: result.title, quantity: 1 })}>
          <i aria-hidden="true">{result.kind === "bundle" ? "🎁" : "🧦"}</i><span><b>{result.title}</b><small>{[result.color, result.size && `Talla ${result.size}`, result.detail, result.location && `📍 ${result.location}`].filter(Boolean).join(" · ")}</small></span>
          <em className={`inventory-quick-stock ${result.state}`}>{result.state === "empty" ? "Agotado" : `${result.available} disp.`}</em>
        </button>
      </li>)}
      {allowCustom && <li><button type="button" onClick={() => pick({ kind: "custom", name: query.trim(), quantity: 1 })}><i aria-hidden="true">✎</i><span><b>Agregar «{query.trim()}» como texto</b><small>No descuenta inventario</small></span></button></li>}
      {!results.length && !allowCustom && <li className="inventory-picker-empty">Sin coincidencias.</li>}
    </ul>}
  </div>;
}

/** Lista editable de productos con cantidad. */
export function DeliveryLinesEditor({ lines, onChange }: { lines: DeliveryLine[]; onChange: (lines: DeliveryLine[]) => void }) {
  if (!lines.length) return null;
  return <ul className="delivery-lines">
    {lines.map((line, index) => <li key={`${line.kind}-${line.id ?? line.name}-${index}`}>
      <span>{line.kind === "bundle" ? "🎁" : line.kind === "product" ? "🧦" : "✎"} {line.name}</span>
      <input type="number" min={1} aria-label={`Cantidad de ${line.name}`} value={line.quantity} onChange={event => onChange(lines.map((item, position) => position === index ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} />
      <button type="button" aria-label={`Quitar ${line.name}`} onClick={() => onChange(lines.filter((_, position) => position !== index))}>✕</button>
    </li>)}
  </ul>;
}
export const addLine = (lines: DeliveryLine[], line: DeliveryLine) => {
  const existing = lines.findIndex(item => item.kind === line.kind && (line.kind === "custom" ? item.name === line.name : item.id === line.id));
  return existing >= 0 ? lines.map((item, index) => index === existing ? { ...item, quantity: item.quantity + line.quantity } : item) : [...lines, line];
};
