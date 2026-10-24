"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { controlRequest } from "../lib/control-api";
import { inventoryCategoryKey, inventoryCategoryName, inventoryFilterParams, inventoryPagePath, inventoryProductName, inventorySearchText, inventoryStockState, matchesColor, splitColorQuery, type InventoryCategory, type InventoryPage, type InventoryProduct } from "../lib/inventory-catalog";
import { InventoryQuantityEditor } from "./InventoryQuantityEditor";
import { ProductLocationEditor } from "./ProductLocationEditor";
import { LocationFinder } from "./LocationFinder";
import { request } from "../lib/api";
import { updateCachedLocations } from "../lib/inventory-snapshot";
import { locationMap, suggestions, type LocationMap, type ProductLocation } from "../lib/product-locations";
import { ChatIcon } from "./ChatIcon";
import { CopyStockButton } from "./CopyStockButton";
import { groupBySize } from "../lib/size-groups";
import { colorSwatch } from "../lib/product-colors";
import { loansByProduct, piecesOut, type InventoryLoan } from "../lib/inventory-loans";
import { LoansSummary, ProductLoans } from "./ProductLoans";

type Colors = Map<number, string>;
function VariantChips({ color, size }: { color?: string; size?: string | null }) {
  if (!color && !size) return null;
  return <span className="inventory-variant">
    {color && <span className="inventory-variant-chip"><i className="inventory-color-dot" style={colorSwatch(color) ? { background: colorSwatch(color) || undefined } : undefined} aria-hidden="true" />{color}</span>}
    {size && <span className="inventory-variant-chip">Talla {size}</span>}
  </span>;
}
import styles from "./InventoryPanel.module.css";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No pudimos consultar el inventario. Intenta nuevamente.";
const number = (value: number) => value.toLocaleString("es-MX");

export function InventoryPanel({ refreshKey }: { refreshKey: number }) {
  const [text, setText] = useState("");
  const [settledText, setSettledText] = useState("");
  const [selected, setSelected] = useState<InventoryProduct | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const [categories, setCategories] = useState<{ key: string; data?: InventoryCategory[]; error?: string }>();
  const [suggestions, setSuggestions] = useState<{ key: string; data?: InventoryProduct[]; error?: string }>();
  const [locations, setLocations] = useState<LocationMap>(() => new Map());
  const [locationError, setLocationError] = useState("");
  const [colors, setColors] = useState<Colors>(() => new Map());
  useEffect(() => {
    let active = true;
    // El color vive en el CRM; si falla, el inventario se muestra sin él.
    request<{ productId: number; color?: string | null }[]>("/product-details")
      .then(rows => { if (active) setColors(new Map((Array.isArray(rows) ? rows : []).filter(row => row?.color).map(row => [row.productId, row.color as string]))); })
      .catch(() => undefined);
    request<ProductLocation[]>("/inventory-locations")
      .then(rows => { if (active) setLocations(locationMap(rows)); })
      .catch(error => { if (active) setLocationError(errorMessage(error)); });
    return () => { active = false; };
  }, []);
  // Prendas tomadas temporalmente (solo aviso; no cambia la existencia).
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [loansKey, setLoansKey] = useState(0);
  useEffect(() => {
    let active = true;
    request<InventoryLoan[]>("/inventory-loans").then(rows => { if (active) setLoans(Array.isArray(rows) ? rows : []); }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey, loansKey]);
  const loansMap = useMemo(() => loansByProduct(loans), [loans]);
  const reloadLoans = () => setLoansKey(value => value + 1);
  const locationSaved = (rows: ProductLocation[]) => {
    setLocations(current => {
      const next = new Map(current);
      rows.forEach(row => { if (row.rack || row.level || row.side) next.set(row.productId, row); else next.delete(row.productId); });
      return next;
    });
    updateCachedLocations(rows);
  };
  const listId = useId();
  const rawQuery = inventorySearchText(text);
  // Los colores se filtran aquí; el resto del texto se busca en Control.
  const colorValues = useMemo(() => [...colors.values()], [colors]);
  const settled = useMemo(() => splitColorQuery(settledText, colorValues), [settledText, colorValues]);
  const colorFilter = useMemo(() => selected || !rawQuery ? [] : settled.colors, [selected, rawQuery, settled]);
  const serverText = settled.text.length >= 2 ? settled.text : "";
  const q = selected ? "" : rawQuery ? serverText : "";
  const productId = selected?.id;
  const filter = inventoryFilterParams(q, productId).toString();
  const resultKey = `${filter}:${refreshKey}:${revision}`;
  const currentCategories = categories?.key === resultKey ? categories : undefined;
  const currentSuggestions = suggestions?.key === rawQuery && settledText === rawQuery && !selected ? suggestions : undefined;
  const options = (currentSuggestions?.data || []).filter(product => matchesColor(colors.get(product.id), colorFilter)).slice(0, 8);
  const colorOnly = colorFilter.length > 0 && !serverText;
  const popup = menuOpen && !selected && rawQuery.length >= 2;
  const total = currentCategories?.data?.reduce((sum, row) => sum + row.productCount, 0) || 0;
  const categoryCount = currentCategories?.data?.length || 0;

  useEffect(() => {
    if (selected) return; // The full suggestion label is not a new search query.
    const timer = window.setTimeout(() => setSettledText(rawQuery), 300);
    return () => window.clearTimeout(timer);
  }, [rawQuery, selected]);

  useEffect(() => {
    const controller = new AbortController();
    controlRequest<InventoryCategory[]>(`/products/inventory/categories?${filter}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setCategories({ key: resultKey, data }); })
      .catch(error => { if (!controller.signal.aborted) setCategories({ key: resultKey, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [filter, resultKey]);

  useEffect(() => {
    if (!settledText || selected || settledText !== rawQuery || !serverText) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: serverText, limit: colorFilter.length ? "50" : "8" });
    controlRequest<InventoryProduct[]>(`/products/typeahead?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSuggestions({ key: settledText, data }); })
      .catch(error => { if (!controller.signal.aborted) setSuggestions({ key: settledText, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [settledText, rawQuery, selected, refreshKey, revision, serverText, colorFilter]);

  function choose(product: InventoryProduct) {
    setSelected(product); setText(inventoryProductName(product)); setMenuOpen(false); setActive(-1); setExpanded({});
  }
  function clear() { setText(""); setSettledText(""); setSelected(null); setSuggestions(undefined); setActive(-1); setExpanded({}); setMenuOpen(false); }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setMenuOpen(false); setActive(-1); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setMenuOpen(true);
      setActive(index => options.length ? event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1) : -1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (popup && active >= 0 && options[active]) choose(options[active]);
      else setMenuOpen(false);
    }
  }

  return <section className={styles.panel} aria-label="Inventario de productos">
    <div className={styles.intro}><h2>Encuentra tus productos</h2><p>Consulta las existencias por categoría o busca un producto específico.</p></div>
    <div className={styles.searchArea} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setMenuOpen(false); setActive(-1); } }}>
      <label htmlFor={`${listId}-input`}>Buscar en inventario</label>
      <div className={styles.searchField}><ChatIcon name="search"/><input id={`${listId}-input`} type="text" role="combobox" autoComplete="off" maxLength={120} value={text}
        placeholder="Nombre, color, talla, categoría o género…" aria-expanded={popup} aria-autocomplete="list" aria-controls={popup ? listId : undefined}
        aria-activedescendant={popup && active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined} aria-describedby={`${listId}-help`}
        onFocus={() => setMenuOpen(true)} onKeyDown={keyDown} onChange={event => { setText(event.target.value); setSelected(null); setMenuOpen(true); setActive(-1); setExpanded({}); }}/>
        {text && <button type="button" onClick={clear} aria-label="Limpiar búsqueda"><ChatIcon name="close"/></button>}
      </div>
      <small id={`${listId}-help`}>Escribe al menos 2 caracteres. Puedes combinar palabras como “essential negro 25-28”.</small>
      {popup && <div className={styles.suggestionPanel}>
        {colorOnly && <p role="status">Mostrando abajo los productos de color {colorFilter.join(", ")}.</p>}
        {!colorOnly && !currentSuggestions && <p role="status">Buscando sugerencias…</p>}
        {currentSuggestions?.error && <p role="alert">{currentSuggestions.error}</p>}
        {currentSuggestions?.data && options.length === 0 && <p>No hay productos que coincidan.</p>}
        <div id={listId} role="listbox" aria-label="Productos sugeridos">{options.map((product, index) => <button type="button" role="option" tabIndex={-1} id={`${listId}-${product.id}`} aria-selected={index === active} key={product.id} onClick={() => choose(product)}>
          <span><strong>{product.name}</strong><small>{[colors.get(product.id), product.size && `Talla ${product.size}`, product.categoryName || "Sin categoría", product.gender || "Sin género"].filter(Boolean).join(" · ")}</small></span><b>{number(product.currentStock)} disponibles</b>
        </button>)}</div>
        {options.length > 0 && <p className={styles.keyboardHint}>↑ ↓ para navegar · Enter para elegir · Esc para cerrar</p>}
      </div>}
    </div>
    {locationError && <p className={styles.hint} role="alert">No se pudieron cargar las ubicaciones: {locationError}</p>}
    <LocationFinder locations={locations} />
    <LoansSummary loans={loans} />
    <div className={styles.resultsHeading}>
      <p role="status">{!currentCategories ? "Consultando inventario…" : currentCategories.error ? "No se pudo cargar el inventario." : `${colorFilter.length ? "Revisando" : `${number(total)} ${total === 1 ? "producto" : "productos"} en`} ${categoryCount} ${categoryCount === 1 ? "categoría" : "categorías"}${selected ? " · Producto seleccionado" : q ? ` · Resultados para “${q}”` : ""}${colorFilter.length ? ` · Color: ${colorFilter.join(", ")}` : ""}`}</p>
      {!!currentCategories?.data?.length && <div className={styles.groupActions}><button type="button" onClick={() => setExpanded(Object.fromEntries(currentCategories.data!.map(row => [inventoryCategoryKey(row), true])))}>Expandir todas</button><button type="button" onClick={() => setExpanded(Object.fromEntries(currentCategories.data!.map(row => [inventoryCategoryKey(row), false])))}>Contraer todas</button></div>}
    </div>
    {currentCategories?.error && <div role="alert" className={styles.error}>{currentCategories.error}<button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
    {currentCategories?.data?.length === 0 && <div className={styles.empty}><h3>{q || selected ? "Sin coincidencias" : "Aún no hay productos"}</h3><p>{q || selected ? "Prueba otro nombre, categoría o género." : "Crea tus productos en Control de ventas → Productos y registra la mercancía recibida."}</p>{(q || selected) && <button type="button" onClick={clear}>Ver todo el inventario</button>}</div>}
    {!q && !selected && !!currentCategories?.data?.length && <p className={styles.hint}>Abre una categoría para consultar y ajustar sus existencias.</p>}
    <div className={styles.groups}>{currentCategories?.data?.map(category => {
      const key = inventoryCategoryKey(category), open = expanded[key] ?? Boolean(q || selected || colorFilter.length);
      return <section key={key} className={styles.category}>
        <h3><button type="button" className={styles.categoryToggle} aria-expanded={open} aria-controls={`${listId}-category-${key}`} onClick={() => setExpanded(current => ({ ...current, [key]: !open }))}>
          <span className={styles.categoryIcon} aria-hidden="true">▦</span><strong>{inventoryCategoryName(category)}</strong><span className={styles.count}>{number(category.productCount)} {category.productCount === 1 ? "producto" : "productos"}</span><span className={styles.chevron} aria-hidden="true">{open ? "⌄" : "›"}</span>
        </button></h3>
        <div id={`${listId}-category-${key}`} hidden={!open}>{open && <InventoryCategoryProducts key={`${key}:${filter}`} category={category} q={q} productId={productId} revision={`${refreshKey}:${revision}`} onSaved={async () => setRevision(value => value + 1)} locations={locations} onLocationSaved={locationSaved} colors={colors} colorFilter={colorFilter} loans={loansMap} allLoans={loans} onLoansChanged={reloadLoans}/>}</div>
      </section>;
    })}</div>
  </section>;
}

// Control entrega máximo 50 por página; juntamos la categoría completa para agruparla por talla.
const PAGE_SIZE = 50, MAX_PAGES = 40;
function InventoryCategoryProducts({ category, q, productId, revision, onSaved, locations, onLocationSaved, colors, colorFilter, loans, allLoans, onLoansChanged }: { category: InventoryCategory; q: string; productId?: number; revision: string; onSaved: () => Promise<void>; locations: LocationMap; onLocationSaved: (rows: ProductLocation[]) => void; colors: Colors; colorFilter: string[]; loans: Map<number, InventoryLoan[]>; allLoans: InventoryLoan[]; onLoansChanged: () => void }) {
  const options = { rack: suggestions(locations.values(), "rack"), level: suggestions(locations.values(), "level"), side: suggestions(locations.values(), "side") };
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: { items: InventoryProduct[]; total: number }; error?: string }>();
  const key = `${inventoryPagePath(category, q, productId, 0, PAGE_SIZE)}:${revision}:${retry}`;
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const items: InventoryProduct[] = [];
      let page = 0, totalPages = 1, total = 0;
      do {
        const data = await controlRequest<InventoryPage>(inventoryPagePath(category, q, productId, page, PAGE_SIZE), { signal: controller.signal });
        items.push(...data.content);
        totalPages = data.totalPages; total = data.totalElements; page += 1;
      } while (page < totalPages && page < MAX_PAGES && !controller.signal.aborted);
      return { items, total };
    })()
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [category, q, productId, key]);
  const visible = useMemo(() => (current?.data?.items || []).filter(product => matchesColor(colors.get(product.id), colorFilter)), [current, colors, colorFilter]);
  const sizes = useMemo(() => groupBySize(visible), [visible]);
  const openByDefault = Boolean(q || productId || colorFilter.length) || sizes.length === 1;
  return <div className={styles.categoryBody} aria-busy={!current}>
    {!current && <p role="status">Cargando productos de {inventoryCategoryName(category)}…</p>}
    {current?.error && <div role="alert" className={styles.error}>{current.error}<button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar categoría</button></div>}
    {current?.data?.items.length === 0 && <p>No hay productos en esta categoría.</p>}
    {!!current?.data?.items.length && !visible.length && <p>No hay productos de color {colorFilter.join(", ")} en esta categoría.</p>}
    {!!current?.data && current.data.total > current.data.items.length && <p className={styles.hint}>Se muestran {number(current.data.items.length)} de {number(current.data.total)} productos. Usa la búsqueda para encontrar los demás.</p>}
    <div className={styles.sizeGroups}>{sizes.map(size => {
      const stock = size.items.reduce((sum, product) => sum + Number(product.currentStock || 0), 0);
      const low = size.items.filter(product => inventoryStockState(product) !== "ready").length;
      return <details key={size.key} className={styles.sizeGroup} open={openByDefault}>
        <summary>
          <strong>{size.label}</strong>
          <span className={styles.count}>{number(size.items.length)} {size.items.length === 1 ? "producto" : "productos"} · {number(stock)} piezas</span>
          {low > 0 && <span className={`${styles.badge} ${styles.low}`}>{low} por surtir</span>}
          <span className={styles.chevron} aria-hidden="true">›</span>
        </summary>
        <div className={styles.sizeBody}>
          {size.items.length > 1 && <ProductLocationEditor productIds={size.items.map(product => product.id)} options={options} onSaved={onLocationSaved} bulkLabel={`Asignar una ubicación a los ${size.items.length} productos de ${size.size ? `talla ${size.size}` : "esta sección"}`}/>}
          <div className={styles.products}>{size.items.map(product => {
            const state = inventoryStockState(product);
            return <article key={product.id} className={styles.product}>
              <header><div><h4>{product.name}</h4><VariantChips color={colors.get(product.id)} size={product.size} /><p>{[product.gender || "Sin género", `#${product.id}`].filter(Boolean).join(" · ")}</p>{piecesOut(loans.get(product.id)) > 0 && <span className="loan-badge">🚚 {piecesOut(loans.get(product.id))} fuera</span>}</div><span className={`${styles.badge} ${styles[state]}`}>{state === "empty" ? "Sin existencias" : state === "low" ? "Stock bajo" : "Disponible"}</span></header>
              <div className={styles.stock}><strong>{number(product.currentStock)}</strong><span>unidades disponibles</span><small>Alerta mínima: {number(product.minStockAlert ?? 0)}</small></div>
              <CopyStockButton productId={product.id} />
              <ProductLocationEditor productIds={[product.id]} location={locations.get(product.id)} options={options} onSaved={onLocationSaved}/>
              <ProductLoans productId={product.id} productName={[product.name?.trim() || "Producto", product.gender?.trim(), colors.get(product.id), product.size?.trim() && `Talla ${product.size.trim()}`].filter(Boolean).join(" · ")} loans={loans.get(product.id) || []} allLoans={allLoans} onChanged={onLoansChanged} />
              <InventoryQuantityEditor id={product.id} name={inventoryProductName(product)} stock={product.currentStock} onSaved={onSaved}/>
            </article>;
          })}</div>
        </div>
      </details>;
    })}</div>
  </div>;
}
