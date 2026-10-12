"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { controlRequest } from "../lib/control-api";
import { inventoryCategoryKey, inventoryCategoryName, inventoryFilterParams, inventoryPagePath, inventoryProductName, inventorySearchText, inventoryStockState, type InventoryCategory, type InventoryPage, type InventoryProduct } from "../lib/inventory-catalog";
import { InventoryQuantityEditor } from "./InventoryQuantityEditor";
import { ChatIcon } from "./ChatIcon";
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
  const listId = useId();
  const rawQuery = inventorySearchText(text);
  const q = selected ? "" : rawQuery ? settledText : "";
  const productId = selected?.id;
  const filter = inventoryFilterParams(q, productId).toString();
  const resultKey = `${filter}:${refreshKey}:${revision}`;
  const currentCategories = categories?.key === resultKey ? categories : undefined;
  const currentSuggestions = suggestions?.key === rawQuery && settledText === rawQuery && !selected ? suggestions : undefined;
  const options = currentSuggestions?.data || [];
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
    if (!settledText || selected || settledText !== rawQuery) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: settledText, limit: "8" });
    controlRequest<InventoryProduct[]>(`/products/typeahead?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSuggestions({ key: settledText, data }); })
      .catch(error => { if (!controller.signal.aborted) setSuggestions({ key: settledText, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [settledText, rawQuery, selected, refreshKey, revision]);

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
        placeholder="Nombre, categoría, género o talla…" aria-expanded={popup} aria-autocomplete="list" aria-controls={popup ? listId : undefined}
        aria-activedescendant={popup && active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined} aria-describedby={`${listId}-help`}
        onFocus={() => setMenuOpen(true)} onKeyDown={keyDown} onChange={event => { setText(event.target.value); setSelected(null); setMenuOpen(true); setActive(-1); setExpanded({}); }}/>
        {text && <button type="button" onClick={clear} aria-label="Limpiar búsqueda"><ChatIcon name="close"/></button>}
      </div>
      <small id={`${listId}-help`}>Escribe al menos 2 caracteres. Puedes filtrar con palabras como “caricatura niña”.</small>
      {popup && <div className={styles.suggestionPanel}>
        {!currentSuggestions && <p role="status">Buscando sugerencias…</p>}
        {currentSuggestions?.error && <p role="alert">{currentSuggestions.error}</p>}
        {currentSuggestions?.data?.length === 0 && <p>No hay productos que coincidan.</p>}
        <div id={listId} role="listbox" aria-label="Productos sugeridos">{options.map((product, index) => <button type="button" role="option" tabIndex={-1} id={`${listId}-${product.id}`} aria-selected={index === active} key={product.id} onClick={() => choose(product)}>
          <span><strong>{product.name}</strong><small>{[product.categoryName || "Sin categoría", product.gender || "Sin género", product.size].filter(Boolean).join(" · ")}</small></span><b>{number(product.currentStock)} disponibles</b>
        </button>)}</div>
        {options.length > 0 && <p className={styles.keyboardHint}>↑ ↓ para navegar · Enter para elegir · Esc para cerrar</p>}
      </div>}
    </div>
    <div className={styles.resultsHeading}>
      <p role="status">{!currentCategories ? "Consultando inventario…" : currentCategories.error ? "No se pudo cargar el inventario." : `${number(total)} ${total === 1 ? "producto" : "productos"} en ${categoryCount} ${categoryCount === 1 ? "categoría" : "categorías"}${selected ? " · Producto seleccionado" : q ? ` · Resultados para “${q}”` : ""}`}</p>
      {!!currentCategories?.data?.length && <div className={styles.groupActions}><button type="button" onClick={() => setExpanded(Object.fromEntries(currentCategories.data!.map(row => [inventoryCategoryKey(row), true])))}>Expandir todas</button><button type="button" onClick={() => setExpanded(Object.fromEntries(currentCategories.data!.map(row => [inventoryCategoryKey(row), false])))}>Contraer todas</button></div>}
    </div>
    {currentCategories?.error && <div role="alert" className={styles.error}>{currentCategories.error}<button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
    {currentCategories?.data?.length === 0 && <div className={styles.empty}><h3>{q || selected ? "Sin coincidencias" : "Aún no hay productos"}</h3><p>{q || selected ? "Prueba otro nombre, categoría o género." : "Crea tus productos en Control de ventas → Productos y registra la mercancía recibida."}</p>{(q || selected) && <button type="button" onClick={clear}>Ver todo el inventario</button>}</div>}
    {!q && !selected && !!currentCategories?.data?.length && <p className={styles.hint}>Abre una categoría para consultar y ajustar sus existencias.</p>}
    <div className={styles.groups}>{currentCategories?.data?.map(category => {
      const key = inventoryCategoryKey(category), open = expanded[key] ?? Boolean(q || selected);
      return <section key={key} className={styles.category}>
        <h3><button type="button" className={styles.categoryToggle} aria-expanded={open} aria-controls={`${listId}-category-${key}`} onClick={() => setExpanded(current => ({ ...current, [key]: !open }))}>
          <span className={styles.categoryIcon} aria-hidden="true">▦</span><strong>{inventoryCategoryName(category)}</strong><span className={styles.count}>{number(category.productCount)} {category.productCount === 1 ? "producto" : "productos"}</span><span className={styles.chevron} aria-hidden="true">{open ? "⌄" : "›"}</span>
        </button></h3>
        <div id={`${listId}-category-${key}`} hidden={!open}>{open && <InventoryCategoryProducts key={`${key}:${filter}`} category={category} q={q} productId={productId} revision={`${refreshKey}:${revision}`} onSaved={async () => setRevision(value => value + 1)}/>}</div>
      </section>;
    })}</div>
  </section>;
}

function InventoryCategoryProducts({ category, q, productId, revision, onSaved }: { category: InventoryCategory; q: string; productId?: number; revision: string; onSaved: () => Promise<void> }) {
  const body = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: InventoryPage; error?: string }>();
  const path = inventoryPagePath(category, q, productId, page);
  const key = `${path}:${revision}:${retry}`;
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    const controller = new AbortController();
    controlRequest<InventoryPage>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [path, key]);
  function changePage(next: number) { setPage(next); body.current?.scrollIntoView({ block: "start" }); }
  return <div ref={body} className={styles.categoryBody} aria-busy={!current}>
    {!current && <p role="status">Cargando productos de {inventoryCategoryName(category)}…</p>}
    {current?.error && <div role="alert" className={styles.error}>{current.error}<button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar categoría</button></div>}
    {current?.data?.content.length === 0 && <p>No hay productos en esta página.</p>}
    <div className={styles.products}>{current?.data?.content.map(product => {
      const state = inventoryStockState(product);
      return <article key={product.id} className={styles.product}>
        <header><div><h4>{product.name}</h4><p>{[product.gender || "Sin género", product.size, `#${product.id}`].filter(Boolean).join(" · ")}</p></div><span className={`${styles.badge} ${styles[state]}`}>{state === "empty" ? "Sin existencias" : state === "low" ? "Stock bajo" : "Disponible"}</span></header>
        <div className={styles.stock}><strong>{number(product.currentStock)}</strong><span>unidades disponibles</span><small>Alerta mínima: {number(product.minStockAlert ?? 0)}</small></div>
        <InventoryQuantityEditor id={product.id} name={inventoryProductName(product)} stock={product.currentStock} onSaved={onSaved}/>
      </article>;
    })}</div>
    {!!current?.data && current.data.totalPages > 1 && <nav className={styles.pagination} aria-label={`Páginas de ${inventoryCategoryName(category)}`}><button type="button" disabled={page === 0} onClick={() => changePage(page - 1)}>Anterior</button><span>Página {page + 1} de {current.data.totalPages} · {number(current.data.totalElements)} productos</span><button type="button" disabled={page + 1 >= current.data.totalPages} onClick={() => changePage(page + 1)}>Siguiente</button></nav>}
  </div>;
}
