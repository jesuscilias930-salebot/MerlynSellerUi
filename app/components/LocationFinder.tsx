"use client";

import { useEffect, useMemo, useState } from "react";
import { loadInventory, type InventorySnapshot } from "../lib/inventory-snapshot";
import { formatLocation, rackIndex, sameText, type LocationMap } from "../lib/product-locations";
import { productDetail } from "../lib/quick-inventory";

/** «¿Qué hay en…?»: productos guardados en un rack (y piso) con su stock. */
export function LocationFinder({ locations }: { locations: LocationMap }) {
  const racks = useMemo(() => rackIndex(locations.values()), [locations]);
  const [rack, setRack] = useState("");
  const [level, setLevel] = useState("");
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!rack || inventory) return;
    let active = true;
    loadInventory().then(data => { if (active) setInventory(data); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo consultar el inventario."); });
    return () => { active = false; };
  }, [rack, inventory]);
  const levels = racks.find(item => item.rack === rack)?.levels || [];
  const rows = useMemo(() => {
    if (!rack) return [];
    const byId = new Map((inventory?.products || []).map(product => [product.id, product]));
    return [...locations.values()]
      .filter(location => sameText(location.rack, rack) && (!level || sameText(location.level, level)))
      .map(location => ({ location, product: byId.get(location.productId) }))
      .sort((a, b) => (a.location.level || "").localeCompare(b.location.level || "", "es", { numeric: true }) || (a.product?.name || "").localeCompare(b.product?.name || "", "es"));
  }, [locations, rack, level, inventory]);
  if (!racks.length) return null;
  return <section className="location-finder" aria-label="Buscar por ubicación">
    <div className="location-finder-head">
      <strong>¿Qué hay en…?</strong>
      <label>Rack<select value={rack} onChange={event => { setRack(event.target.value); setLevel(""); }}><option value="">Elige un rack</option>{racks.map(item => <option key={item.rack} value={item.rack}>{item.rack}</option>)}</select></label>
      {rack && levels.length > 0 && <label>Piso<select value={level} onChange={event => setLevel(event.target.value)}><option value="">Todos</option>{levels.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
    </div>
    {error && <p className="location-error">{error}</p>}
    {rack && <ul>
      {rows.map(({ location, product }) => <li key={location.productId}>
        <span><b>{product?.name || `Producto #${location.productId}`}</b><small>{product ? productDetail(product) : inventory ? "Ya no está en el inventario de Control" : error ? "Abre Control de ventas para ver el nombre y el stock" : "Cargando…"}</small></span>
        <small>{formatLocation({ ...location, rack: null })}</small>
        {product && <em className={`inventory-quick-stock ${Number(product.currentStock) > 0 ? "ready" : "empty"}`}>{Number(product.currentStock) > 0 ? `${product.currentStock} disp.` : "Agotado"}</em>}
      </li>)}
      {!rows.length && <li className="location-finder-empty">No hay productos en esa ubicación.</li>}
    </ul>}
  </section>;
}
