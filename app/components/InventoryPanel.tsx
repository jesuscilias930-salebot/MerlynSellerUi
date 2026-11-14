"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { request } from "../lib/api";
import { cachedInventory, loadInventory, updateCachedLocations, type InventorySnapshot } from "../lib/inventory-snapshot";
import { applyFilters, BUNDLES_KEY, bundleRow, compareSizes, levelLabel, parseStock, productRow, sizeMatrix, stockChanges, unitLabel, type InventoryRow, type LevelFilter } from "../lib/inventory-view";
import { controlRequest } from "../lib/control-api";
import { bundleAvailability, productFamily, type QuickBundle, type QuickProduct } from "../lib/quick-inventory";
import { formatLocation, suggestions, type ProductLocation } from "../lib/product-locations";
import { colorSwatch } from "../lib/product-colors";
import { loansByProduct, piecesOut, type InventoryLoan } from "../lib/inventory-loans";
import { ChatIcon } from "./ChatIcon";
import { CopyStockButton } from "./CopyStockButton";
import { InventoryQuantityEditor } from "./InventoryQuantityEditor";
import { LocationFinder } from "./LocationFinder";
import { ProductLocationEditor } from "./ProductLocationEditor";
import { LoansSummary, ProductLoans } from "./ProductLoans";
import styles from "./InventoryPanel.module.css";

type View = "list" | "sizes";
type Selection = { kind: InventoryRow["kind"]; id: number };
const VIEW_KEY = "merlyn.inventoryView";
const PAGE = 150;
const number = (value: number) => value.toLocaleString("es-MX");
const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: value % 1 ? 2 : 0 });
const readView = (): View => { try { return typeof window !== "undefined" && window.localStorage.getItem(VIEW_KEY) === "sizes" ? "sizes" : "list"; } catch { return "list"; } };
const LEVELS: { key: LevelFilter; label: string }[] = [{ key: "all", label: "Todos" }, { key: "ready", label: "Disponibles" }, { key: "low", label: "Pocas" }, { key: "empty", label: "Agotados" }];

function Swatch({ row }: { row: Pick<InventoryRow, "kind" | "color"> }) {
  if (row.kind === "bundle") return <span className={styles.bundleIcon} aria-hidden="true">📦</span>;
  const swatch = colorSwatch(row.color);
  return <i className={styles.dot} style={swatch ? { background: swatch } : undefined} aria-hidden="true" />;
}
/** Cantidad editable de un producto en el modo «Editar existencias». */
function StockInput({ row, draft, error, onChange, compact }: { row: InventoryRow; draft?: string; error?: string; onChange: (id: number, value: string | null) => void; compact?: boolean }) {
  const value = draft ?? String(row.stock);
  const parsed = parseStock(value);
  const changed = draft !== undefined && parsed !== row.stock;
  const invalid = draft !== undefined && parsed === undefined;
  return <span className={`${styles.stockEdit} ${compact ? styles.stockEditCompact : ""} ${changed ? styles.changed : ""} ${invalid || error ? styles.invalid : ""}`}>
    <input type="text" inputMode="numeric" data-stock-input="" aria-label={`Existencias de ${row.name}${row.color ? ` ${row.color}` : ""}${row.size ? ` talla ${row.size}` : ""}`} aria-invalid={invalid || Boolean(error)} value={value} title={error || undefined}
      onFocus={event => event.currentTarget.select()}
      onChange={event => { const next = event.target.value; onChange(row.id, next === String(row.stock) ? null : next); }}
      onKeyDown={event => {
        if (event.key === "Escape") { onChange(row.id, null); return; }
        if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        // Enter o ↓ pasa al siguiente producto, ↑ al anterior: se puede capturar un conteo completo con el teclado.
        const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-stock-input]")];
        const index = inputs.indexOf(event.currentTarget);
        inputs[index + (event.key === "ArrowUp" ? -1 : 1)]?.focus();
      }} />
    {!compact && <small>{error ? error : changed ? `antes ${row.stock.toLocaleString("es-MX")}` : unitLabel(row, row.stock)}</small>}
  </span>;
}
const variant = (row: InventoryRow) => row.kind === "bundle" ? "Paquete" : [row.color, row.size && `Talla ${row.size}`, row.gender].filter(Boolean).join(" · ");

/** Inventario: busca cualquier producto y ve al instante cuántas piezas hay. */
export function InventoryPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<InventorySnapshot | null>(cachedInventory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [loansKey, setLoansKey] = useState(0);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<View>(readView);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Selection | null>(null);
  // Modo edición: cantidades escritas (por producto) que se guardan juntas con un motivo.
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Map<number, string>>(() => new Map());
  const [saveErrors, setSaveErrors] = useState<Map<number, string>>(() => new Map());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const deferredQuery = useDeferredValue(query);

  const load = async (force = false) => {
    setLoading(true); setError("");
    try { setData(await loadInventory(force)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo consultar el inventario."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void Promise.resolve().then(() => load(refreshKey > 0));
  }, [refreshKey]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    request<InventoryLoan[]>("/inventory-loans").then(rows => { if (active) setLoans(Array.isArray(rows) ? rows : []); }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey, loansKey]);
  const loansMap = useMemo(() => loansByProduct(loans), [loans]);

  const rows = useMemo(() => data ? [
    ...data.products.map(product => productRow(product, formatLocation(data.locations.get(product.id)))),
    ...data.bundles.map(bundle => bundleRow(bundle, bundleAvailability(bundle, data.products))),
  ] : [], [data]);
  const filtered = useMemo(() => applyFilters(rows, { query: deferredQuery, level, category }), [rows, deferredQuery, level, category]);
  const productResults = useMemo(() => filtered.results.filter(row => row.kind === "product"), [filtered]);
  const bundleResults = useMemo(() => filtered.results.filter(row => row.kind === "bundle"), [filtered]);
  const matrix = useMemo(() => view === "sizes" ? sizeMatrix(productResults) : [], [view, productResults]);
  const locationOptions = useMemo(() => {
    const values = data ? [...data.locations.values()] : [];
    return { rack: suggestions(values, "rack"), level: suggestions(values, "level"), side: suggestions(values, "side") };
  }, [data]);

  const pending = useMemo(() => stockChanges(drafts, rows), [drafts, rows]);
  const setDraft = (id: number, value: string | null) => {
    setDrafts(current => { const next = new Map(current); if (value === null) next.delete(id); else next.set(id, value); return next; });
    setSaveErrors(current => { if (!current.has(id)) return current; const next = new Map(current); next.delete(id); return next; });
  };
  const discardEdits = () => { setDrafts(new Map()); setSaveErrors(new Map()); setReason(""); };
  const toggleEditing = () => {
    if (editing && (pending.changes.length || pending.invalid.length) && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos?")) return;
    if (editing) discardEdits();
    setSaveNotice(""); setEditing(value => !value);
  };
  const saveEdits = async () => {
    if (saving || !pending.changes.length || pending.invalid.length || !reason.trim()) return;
    if (!window.confirm(`¿Guardar las existencias de ${pending.changes.length} ${pending.changes.length === 1 ? "producto" : "productos"}? Se conserva el historial de compras y ventas.`)) return;
    const errors = new Map<number, string>();
    setSaving({ done: 0, total: pending.changes.length }); setSaveNotice("");
    for (const [index, change] of pending.changes.entries()) {
      try {
        await controlRequest(`/products/${change.id}/inventory`, { method: "PATCH", body: JSON.stringify({ quantity: change.to, expectedStock: change.from, reason: reason.trim() }) });
      } catch (failure) { errors.set(change.id, failure instanceof Error ? failure.message : "No se pudo guardar"); }
      setSaving({ done: index + 1, total: pending.changes.length });
    }
    const saved = pending.changes.length - errors.size;
    // Solo quedan pendientes los que fallaron; los guardados toman la existencia nueva al recargar.
    setDrafts(current => new Map([...current].filter(([id]) => errors.has(id))));
    setSaveErrors(errors);
    if (!errors.size) setReason("");
    setSaveNotice(errors.size ? `Se guardaron ${saved} de ${pending.changes.length}. Revisa los marcados en rojo y vuelve a guardar.` : `✓ Existencias guardadas (${saved}).`);
    setSaving(null);
    await load(true);
  };
  const changeView = (next: View) => { setView(next); try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* Preferencia opcional. */ } };
  const resetPage = () => setLimit(PAGE);
  const open = (row: InventoryRow) => setSelected({ kind: row.kind, id: row.id });
  const clearAll = () => { setQuery(""); setLevel("all"); setCategory(""); resetPage(); input.current?.focus(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) { event.preventDefault(); setQuery(""); resetPage(); }
    if (event.key === "Enter" && filtered.results[0]) { event.preventDefault(); open(filtered.results[0]); }
  };
  const locationSaved = (saved: ProductLocation[]) => {
    updateCachedLocations(saved);
    setData(current => {
      if (!current) return current;
      const next = new Map(current.locations);
      saved.forEach(row => { if (row.rack || row.level || row.side) next.set(row.productId, row); else next.delete(row.productId); });
      return { ...current, locations: next };
    });
  };
  const filtering = Boolean(query.trim() || level !== "all" || category);
  const bulkIds = category && category !== BUNDLES_KEY && productResults.length > 1 && productResults.length <= 300 ? productResults.map(row => row.id) : [];
  const categoryName = filtered.categories.find(item => item.key === category)?.name;

  return <section className={styles.panel} aria-label="Inventario de productos">
    <div className={styles.toolbar}>
      <div className={styles.searchField}>
        <ChatIcon name="search" />
        <label htmlFor={searchId} className={styles.srOnly}>Buscar en inventario</label>
        <input ref={input} id={searchId} type="search" autoComplete="off" maxLength={120} value={query} placeholder="¿Qué producto buscas? Nombre, color, talla…" onKeyDown={keyDown} onChange={event => { setQuery(event.target.value); resetPage(); }} />
        {query && <button type="button" onClick={() => { setQuery(""); resetPage(); input.current?.focus(); }} aria-label="Limpiar búsqueda"><ChatIcon name="close" /></button>}
      </div>
      <button type="button" className={`${styles.editToggle} ${editing ? styles.editOn : ""}`} aria-pressed={editing} disabled={!data || Boolean(saving)} onClick={toggleEditing}>{editing ? "✓ Terminar edición" : "✏️ Editar existencias"}</button>
      <div className={styles.viewSwitch} role="group" aria-label="Forma de ver el inventario">
        <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}>Lista</button>
        <button type="button" aria-pressed={view === "sizes"} onClick={() => changeView("sizes")}>Por tallas</button>
      </div>
    </div>
    {editing && <p className={styles.editHint} role="status">Escribe la cantidad real de cada producto. <b>Enter</b> pasa al siguiente y <b>Esc</b> regresa al valor actual. Los cambios se guardan juntos abajo.</p>}
    {!editing && saveNotice && <p className={styles.editHint} role="status">{saveNotice}</p>}
    <p className={styles.searchHint}>Ejemplos: <button type="button" onClick={() => setQuery("essential negro")}>essential negro</button> <button type="button" onClick={() => setQuery("caricatura 2-4")}>caricatura 2-4</button> · Enter abre el primer resultado.</p>

    <div className={styles.chips} role="group" aria-label="Filtrar por existencia">
      {LEVELS.map(item => <button key={item.key} type="button" className={`${styles.chip} ${item.key !== "all" ? styles[`chip_${item.key}`] : ""}`} aria-pressed={level === item.key} onClick={() => { setLevel(item.key); resetPage(); }}>
        {item.key !== "all" && <i aria-hidden="true" />}{item.label}<b>{number(filtered.levels[item.key])}</b>
      </button>)}
    </div>
    {filtered.categories.length > 1 && <div className={`${styles.chips} ${styles.categoryChips}`} role="group" aria-label="Filtrar por categoría">
      <button type="button" className={styles.chip} aria-pressed={!category} onClick={() => { setCategory(""); resetPage(); }}>Todas las categorías<b>{number(filtered.total)}</b></button>
      {filtered.categories.map(item => <button key={item.key} type="button" className={styles.chip} aria-pressed={category === item.key} disabled={!item.count && category !== item.key} onClick={() => { setCategory(category === item.key ? "" : item.key); resetPage(); }}>
        {item.key === BUNDLES_KEY && "📦 "}{item.name}<b>{number(item.count)}</b>
      </button>)}
    </div>}

    <div className={styles.status}>
      <p role="status">{!data ? (loading ? "Cargando inventario…" : "") : `${number(filtered.results.length)} ${filtered.results.length === 1 ? "resultado" : "resultados"}${categoryName ? ` en ${categoryName}` : ""}`}
        {data && <span> · Actualizado {new Date(data.loadedAt).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}</span>}
      </p>
      <div className={styles.statusActions}>
        {filtering && <button type="button" onClick={clearAll}>Quitar filtros</button>}
        <button type="button" disabled={loading} onClick={() => void load(true)}>{loading && data ? "Actualizando…" : "↻ Actualizar"}</button>
      </div>
    </div>

    {error && <div role="alert" className={styles.error}>{error}<button type="button" onClick={() => void load(true)}>Reintentar</button></div>}
    {!data && !error && <div className={styles.skeleton} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>}

    {data && <div className={styles.extras}>
      <div className={styles.extrasRow}><LoansSummary loans={loans} /><LocationFinder locations={data.locations} /></div>
      {bulkIds.length > 0 && <ProductLocationEditor key={`${category}:${bulkIds.length}:${deferredQuery}`} productIds={bulkIds} options={locationOptions} onSaved={locationSaved} bulkLabel={`Asignar una ubicación a los ${bulkIds.length} productos mostrados`} />}
    </div>}

    {data && filtered.results.length === 0 && <div className={styles.emptyState}>
      <h3>{rows.length ? "No encontramos ese producto" : "Aún no hay productos"}</h3>
      <p>{rows.length ? "Revisa la ortografía, usa menos palabras o quita los filtros." : "Crea tus productos en Control de ventas → Productos y registra la mercancía recibida."}</p>
      {filtering && <button type="button" onClick={clearAll}>Ver todo el inventario</button>}
    </div>}

    {data && view === "list" && filtered.results.length > 0 && <>
      <ul className={styles.list}>{filtered.results.slice(0, limit).map(row => {
        const out = row.kind === "product" ? piecesOut(loansMap.get(row.id)) : 0;
        const meta = <span className={styles.rowMeta}>{row.kind === "bundle" ? "Cajas que se pueden armar" : row.category}{row.location && <small>📍 {row.location}</small>}{out > 0 && <small className={styles.out}>🚚 {out} fuera</small>}</span>;
        const qty = <span className={`${styles.qty} ${styles[row.level]}`}><b>{row.level === "empty" ? "0" : number(row.stock)}</b><small>{row.level === "empty" ? "Agotado" : row.level === "low" ? `${unitLabel(row, row.stock)} · pocas` : unitLabel(row, row.stock)}</small></span>;
        if (editing) return <li key={`${row.kind}-${row.id}`}><div className={`${styles.row} ${drafts.has(row.id) ? styles.rowChanged : ""}`}>
          <Swatch row={row} />
          <button type="button" className={styles.rowMain} onClick={() => open(row)}><strong>{row.name}</strong><small>{variant(row)}</small></button>
          {meta}
          {row.kind === "product" ? <StockInput row={row} draft={drafts.get(row.id)} error={saveErrors.get(row.id)} onChange={setDraft} /> : qty}
        </div></li>;
        return <li key={`${row.kind}-${row.id}`}><button type="button" className={styles.row} onClick={() => open(row)}>
          <Swatch row={row} />
          <span className={styles.rowMain}><strong>{row.name}</strong><small>{variant(row)}</small></span>
          {meta}
          {qty}
        </button></li>;
      })}</ul>
      {filtered.results.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(value => value + PAGE)}>Mostrar {number(Math.min(PAGE, filtered.results.length - limit))} más de {number(filtered.results.length - limit)}</button>}
    </>}

    {data && view === "sizes" && filtered.results.length > 0 && <div className={styles.matrixGroups}>
      <p className={styles.legend}><span className={styles.ready}>■</span> Disponible <span className={styles.low}>■</span> Pocas (en la alerta mínima o menos) <span className={styles.empty}>■</span> Agotado · {editing ? "Escribe la cantidad en cada talla." : "Toca una celda para ver el detalle."}</p>
      {matrix.map(group => <section key={group.key} className={styles.matrixGroup} aria-label={group.name}>
        <h3>{group.name}</h3>
        <div className={styles.matrixScroll}><table className={styles.matrix}>
          <thead><tr><th scope="col">Producto</th>{group.sizes.map(size => <th scope="col" key={size}>{size || "Única"}</th>)}<th scope="col">Total</th></tr></thead>
          <tbody>{group.lines.map(line => <tr key={line.key}>
            <th scope="row"><span className={styles.lineTitle}><Swatch row={{ kind: "product", color: line.color }} /><span><b>{line.title}</b>{line.detail && <small>{line.detail}</small>}</span></span></th>
            {group.sizes.map(size => { const row = line.cells.get(size); return <td key={size}>{row && editing ? <StockInput compact row={row} draft={drafts.get(row.id)} error={saveErrors.get(row.id)} onChange={setDraft} /> : row ? <button type="button" className={`${styles.cell} ${styles[row.level]}`} title={`${row.name} · ${variant(row)} · ${levelLabel(row.level)}`} onClick={() => open(row)}>{number(row.stock)}</button> : <span className={styles.none} aria-label="No existe">—</span>}</td>; })}
            <td className={styles.lineTotal}>{number(line.total)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>)}
      {bundleResults.length > 0 && <section className={styles.matrixGroup} aria-label="Paquetes">
        <h3>📦 Paquetes</h3>
        <ul className={styles.list}>{bundleResults.map(row => <li key={row.id}><button type="button" className={styles.row} onClick={() => open(row)}><Swatch row={row} /><span className={styles.rowMain}><strong>{row.name}</strong><small>Paquete</small></span><span className={styles.rowMeta}>Cajas que se pueden armar hoy</span><span className={`${styles.qty} ${styles[row.level]}`}><b>{number(row.stock)}</b><small>{row.level === "empty" ? "Agotado" : unitLabel(row, row.stock)}</small></span></button></li>)}</ul>
      </section>}
    </div>}

    {editing && <div className={styles.saveBar} role="region" aria-label="Guardar existencias">
      <div className={styles.saveSummary}>
        <b>{pending.changes.length ? `${pending.changes.length} ${pending.changes.length === 1 ? "producto modificado" : "productos modificados"}` : "Sin cambios todavía"}</b>
        {pending.invalid.length > 0 && <small className={styles.saveWarn}>{pending.invalid.length} con cantidad inválida (solo enteros desde 0)</small>}
        {pending.changes.length > 0 && <details><summary>Ver cambios</summary><ul>{pending.changes.map(change => <li key={change.id}><span>{change.name}</span><span>{number(change.from)} → <b>{number(change.to)}</b></span><button type="button" aria-label={`Quitar cambio de ${change.name}`} onClick={() => setDraft(change.id, null)}>×</button></li>)}</ul></details>}
        {saveNotice && <small>{saveNotice}</small>}
      </div>
      <label className={styles.reason}><span>Motivo del ajuste</span><input maxLength={500} value={reason} disabled={Boolean(saving)} placeholder="Ej. Conteo físico de bodega" onChange={event => setReason(event.target.value)} /></label>
      <div className={styles.saveActions}>
        <button type="button" disabled={Boolean(saving) || (!drafts.size && !reason)} onClick={discardEdits}>Descartar</button>
        <button type="button" className={styles.savePrimary} disabled={Boolean(saving) || !pending.changes.length || pending.invalid.length > 0 || !reason.trim()} title={!reason.trim() && pending.changes.length ? "Escribe el motivo del ajuste" : undefined} onClick={() => void saveEdits()}>{saving ? `Guardando ${saving.done} de ${saving.total}…` : `Guardar ${pending.changes.length || ""} ${pending.changes.length === 1 ? "cambio" : "cambios"}`}</button>
      </div>
    </div>}

    {data && selected && <InventoryDetail key={`${selected.kind}-${selected.id}`} selection={selected} data={data} loans={loans} loansMap={loansMap} locationOptions={locationOptions}
      onSelect={setSelected} onClose={() => setSelected(null)} onLocationSaved={locationSaved} onLoansChanged={() => setLoansKey(value => value + 1)} onStockSaved={() => load(true)} />}
  </section>;
}

type DetailProps = {
  selection: Selection; data: InventorySnapshot; loans: InventoryLoan[]; loansMap: Map<number, InventoryLoan[]>;
  locationOptions: { rack: string[]; level: string[]; side: string[] };
  onSelect: (selection: Selection) => void; onClose: () => void; onLocationSaved: (rows: ProductLocation[]) => void; onLoansChanged: () => void; onStockSaved: () => Promise<void>;
};
/** Panel lateral con todo lo que se hace con un producto: ver tallas y colores, ubicación, préstamos y ajustes. */
function InventoryDetail({ selection, data, loans, loansMap, locationOptions, onSelect, onClose, onLocationSaved, onLoansChanged, onStockSaved }: DetailProps) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); previous?.focus(); };
  }, [onClose]);
  const product = selection.kind === "product" ? data.products.find(item => item.id === selection.id) : undefined;
  const bundle = selection.kind === "bundle" ? data.bundles.find(item => item.id === selection.id) : undefined;
  return <>
    <button type="button" className={styles.scrim} aria-label="Cerrar detalle" onClick={onClose} />
    <aside ref={panel} tabIndex={-1} className={styles.drawer} aria-label="Detalle del producto">
      <header><p>{bundle ? "PAQUETE" : "PRODUCTO"}</p><button type="button" aria-label="Cerrar detalle" onClick={onClose}><ChatIcon name="close" /></button></header>
      <div className={styles.drawerBody}>
        {product && <ProductDetail product={product} data={data} loans={loans} loansMap={loansMap} locationOptions={locationOptions} onSelect={onSelect} onLocationSaved={onLocationSaved} onLoansChanged={onLoansChanged} onStockSaved={onStockSaved} />}
        {bundle && <BundleDetail bundle={bundle} data={data} onSelect={onSelect} />}
        {!product && !bundle && <p className={styles.hint}>Este producto ya no está en Control de ventas.</p>}
      </div>
    </aside>
  </>;
}

function ProductDetail({ product, data, loans, loansMap, locationOptions, onSelect, onLocationSaved, onLoansChanged, onStockSaved }: Omit<DetailProps, "selection" | "onClose"> & { product: QuickProduct }) {
  const row = productRow(product, formatLocation(data.locations.get(product.id)));
  const family = useMemo(() => productFamily(data.products, product).map(item => productRow(item)).sort((a, b) => a.color.localeCompare(b.color, "es") || compareSizes(a.size, b.size)), [data, product]);
  const out = piecesOut(loansMap.get(product.id));
  const fullName = [row.name, row.gender, row.color, row.size && `Talla ${row.size}`].filter(Boolean).join(" · ");
  return <>
    <div className={styles.detailHead}><Swatch row={row} /><div><h2>{row.name}</h2><p>{[row.color, row.size && `Talla ${row.size}`, row.gender, row.category].filter(Boolean).join(" · ")}</p></div></div>
    <div className={`${styles.bigStock} ${styles[row.level]}`}><b>{number(row.stock)}</b><span>{unitLabel(row, row.stock)} disponibles</span><em>{levelLabel(row.level)}</em></div>
    <p className={styles.hint}>Alerta mínima: {number(row.min)} · #{row.id}{out > 0 && <> · 🚚 {out} fuera del almacén</>}</p>
    <CopyStockButton productId={product.id} />
    {family.length > 1 && <section className={styles.detailSection}>
      <h3>Otras tallas y colores</h3>
      <div className={styles.family}>{family.map(item => <button key={item.id} type="button" aria-current={item.id === product.id} className={`${styles.familyItem} ${styles[item.level]}`} onClick={() => onSelect({ kind: "product", id: item.id })}>
        <span>{[item.color, item.size && `Talla ${item.size}`].filter(Boolean).join(" · ") || item.name}</span><b>{number(item.stock)}</b>
      </button>)}</div>
    </section>}
    <section className={styles.detailSection}><h3>Ubicación en bodega</h3><ProductLocationEditor productIds={[product.id]} location={data.locations.get(product.id)} options={locationOptions} onSaved={onLocationSaved} /></section>
    <section className={styles.detailSection}><h3>Prendas fuera del almacén</h3><ProductLoans productId={product.id} productName={fullName} loans={loansMap.get(product.id) || []} allLoans={loans} onChanged={onLoansChanged} /></section>
    <section className={styles.detailSection}><h3>Ajustar existencias</h3><InventoryQuantityEditor id={product.id} name={fullName} stock={row.stock} onSaved={onStockSaved} /></section>
  </>;
}

function BundleDetail({ bundle, data, onSelect }: { bundle: QuickBundle; data: InventorySnapshot; onSelect: (selection: Selection) => void }) {
  const available = bundleAvailability(bundle, data.products);
  const row = bundleRow(bundle, available);
  const byId = new Map(data.products.map(product => [product.id, product]));
  const price = Number(bundle.fixedPrice);
  return <>
    <div className={styles.detailHead}><Swatch row={row} /><div><h2>{bundle.name}</h2><p>{bundle.storeCategory || "Paquete"}{Number.isFinite(price) && price > 0 ? ` · ${money(price)}` : ""}</p></div></div>
    <div className={`${styles.bigStock} ${styles[row.level]}`}><b>{number(available)}</b><span>{unitLabel(row, available)} se pueden armar hoy</span><em>{levelLabel(row.level)}</em></div>
    <section className={styles.detailSection}><h3>Contenido de cada caja</h3>
      <ul className={styles.bundleItems}>{bundle.items.map((item, index) => {
        const product = byId.get(item.productId);
        const itemRow = product ? productRow(product) : null;
        return <li key={`${item.productId}-${index}`}>{itemRow ? <button type="button" onClick={() => onSelect({ kind: "product", id: itemRow.id })}>
          <span><b>{item.quantity} × {itemRow.name}</b><small>{[itemRow.color, itemRow.size && `Talla ${itemRow.size}`, item.assorted ? "surtido" : ""].filter(Boolean).join(" · ")}</small></span>
          <em className={styles[itemRow.level]}>{number(itemRow.stock)} disp.</em>
        </button> : <span><b>{item.quantity} × Producto #{item.productId}</b><small>Ya no está en Control</small></span>}</li>;
      })}</ul>
    </section>
  </>;
}
