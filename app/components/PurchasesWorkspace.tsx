"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { controlRequest } from "../lib/control-api";
import { colorSwatch } from "../lib/product-colors";
import {
  draftFromPurchase, draftIssues, draftTotals, emptyLine, emptyPurchase, lineIssues, lineTotals, purchaseDateLabel,
  purchaseTotal, purchaseUnits, sortPurchases, toPurchaseRequest, type Purchase, type PurchaseDraft, type PurchaseItem, type PurchaseLine,
} from "../lib/purchases";
import { ConfirmDialog } from "./ConfirmDialog";
import styles from "./PurchasesWorkspace.module.css";

export type PurchaseProduct = {
  id: number; name: string; currentStock?: number;
  category?: { id?: number; name?: string } | null; gender?: string | null; size?: string | null;
};
type Page<T> = { content?: T[]; last?: boolean; totalElements?: number };
type Tab = "new" | "history";
type Confirm = { kind: "delete"; purchase: Purchase } | { kind: "edit"; purchase: Purchase } | { kind: "clear" } | null;

const PAGE_SIZE = 20;
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
const pieces = (value: number) => `${new Intl.NumberFormat("es-MX").format(value)} ${value === 1 ? "pieza" : "piezas"}`;
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const meta = (product: PurchaseProduct | PurchaseItem["product"] | undefined, color?: string) =>
  [product?.category?.name, product?.gender, product?.size, color].filter(Boolean).join(" · ");
const isDirty = (draft: PurchaseDraft) =>
  Boolean(draft.supplierName.trim() || draft.invoiceTotal.trim() || draft.lines.length > 1
    || draft.lines.some(line => line.productId || line.units || line.unitCost || line.unitsPerBulk || line.pricePerBulk || line.taxed));

function Swatch({ color, keepSpace = false }: { color?: string | null; keepSpace?: boolean }) {
  const value = colorSwatch(color);
  if (!color) return keepSpace ? <span className={styles.swatch} data-none="" aria-hidden="true" /> : null;
  return <span className={styles.swatch} style={value ? { background: value } : undefined} data-unknown={value ? undefined : ""} title={color} aria-hidden="true" />;
}

function ProductPicker({ products, colors, value, taken, invalid, onChange }: {
  products: PurchaseProduct[]; colors: Record<number, string>; value: string; taken: Set<string>; invalid: boolean; onChange: (id: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(!value);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const selected = products.find(product => String(product.id) === value);
  const matches = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return products.filter(product => {
      const text = plain([product.name, meta(product, colors[product.id])].join(" "));
      return words.every(word => text.includes(word));
    }).slice(0, 30);
  }, [products, colors, query]);
  const choose = (product: PurchaseProduct) => {
    if (taken.has(String(product.id))) return;
    onChange(String(product.id));
    setSearching(false);
    setQuery("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, matches.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (event.key === "Enter") { event.preventDefault(); if (open && matches[active]) choose(matches[active]); else setOpen(true); }
    else if (event.key === "Escape") { event.preventDefault(); if (open) setOpen(false); else if (value) setSearching(false); }
  };

  if (value && !searching) return <div className={styles.picked}>
    <Swatch color={selected ? colors[selected.id] : null} />
    <div>
      <strong>{selected?.name || `Producto #${value}`}</strong>
      <small>{selected ? meta(selected, colors[selected.id]) || "Sin detalles" : "Ya no aparece en tu catálogo"}</small>
    </div>
    {selected?.currentStock != null && <span className={styles.stock}>Hay {pieces(Number(selected.currentStock))}</span>}
    <button type="button" className={styles.linkButton} onClick={() => { setSearching(true); setActive(0); setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}>Cambiar</button>
  </div>;

  return <div className={styles.picker}>
    <input
      ref={inputRef} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-invalid={invalid || undefined}
      aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
      value={query} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={onKey}
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => setOpen(false)}
      placeholder={products.length ? "Busca el producto: nombre, categoría, talla o color" : "Cargando productos…"} autoComplete="off"
    />
    <span className={styles.searchIcon} aria-hidden="true">⌕</span>
    {open && <ul id={listId} role="listbox" aria-label="Productos">
      {matches.map((product, index) => {
        const used = taken.has(String(product.id));
        return <li key={product.id} id={`${listId}-${product.id}`} role="option" aria-selected={index === active} aria-disabled={used || undefined}
          data-active={index === active ? "" : undefined} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(product)}>
          <Swatch color={colors[product.id]} keepSpace />
          <span><strong>{product.name}</strong><small>{meta(product, colors[product.id]) || "Sin detalles"}</small></span>
          <em>{used ? "Ya está en esta compra" : product.currentStock != null ? `${product.currentStock} en stock` : ""}</em>
        </li>;
      })}
      {!matches.length && <li className={styles.noMatch}>{products.length ? "Ningún producto coincide. Créalo primero en Control de ventas → Productos." : "Aún no hay productos en tu catálogo."}</li>}
    </ul>}
    {value && <button type="button" className={styles.linkButton} onClick={() => setSearching(false)}>Cancelar</button>}
  </div>;
}

function NumberField({ label, value, onChange, prefix, step = "1", min = "1", hint, invalid }: {
  label: string; value: string; onChange: (value: string) => void; prefix?: string; step?: string; min?: string; hint?: string; invalid?: boolean;
}) {
  return <label className={styles.field}>
    <span>{label}</span>
    <span className={styles.inputWrap} data-prefix={prefix || undefined}>
      {prefix && <i aria-hidden="true">{prefix}</i>}
      <input type="number" inputMode={step === "1" ? "numeric" : "decimal"} min={min} step={step} value={value} aria-invalid={invalid || undefined} onChange={event => onChange(event.target.value)} />
    </span>
    {hint && <small>{hint}</small>}
  </label>;
}

function LineCard({ line, index, count, products, colors, taken, showIssues, onChange, onRemove }: {
  line: PurchaseLine; index: number; count: number; products: PurchaseProduct[]; colors: Record<number, string>; taken: Set<string>;
  showIssues: boolean; onChange: (patch: Partial<PurchaseLine>) => void; onRemove: () => void;
}) {
  const totals = lineTotals(line);
  const issues = lineIssues(line);
  const flag = (text: string) => showIssues && issues.includes(text);
  return <article className={styles.line} data-invalid={showIssues && issues.length ? "" : undefined}>
    <header>
      <span className={styles.lineNumber}>{index + 1}</span>
      <ProductPicker products={products} colors={colors} value={line.productId} taken={taken} invalid={flag("elige el producto")} onChange={productId => onChange({ productId })} />
      {count > 1 && <button type="button" className={styles.remove} onClick={onRemove} aria-label={`Quitar producto ${index + 1}`} title="Quitar producto">✕</button>}
    </header>
    <div className={styles.lineBody}>
      <div className={styles.segmented} role="radiogroup" aria-label="¿Cómo lo compraste?">
        {([["unit", "Por pieza"], ["bulk", "Por bulto o caja"]] as const).map(([mode, label]) =>
          <button key={mode} type="button" role="radio" aria-checked={line.mode === mode} onClick={() => onChange({ mode })}>{label}</button>)}
      </div>
      {line.mode === "unit" ? <div className={styles.fields}>
        <NumberField label="Piezas recibidas" value={line.units} onChange={units => onChange({ units })} invalid={flag("indica las piezas recibidas")} />
        <NumberField label="Costo por pieza" prefix="$" step="0.01" min="0.01" value={line.unitCost} onChange={unitCost => onChange({ unitCost })} invalid={flag("indica el costo por pieza")} hint="Precio pagado por cada par o pieza" />
      </div> : <div className={styles.fields} data-bulk="">
        <NumberField label="Bultos recibidos" value={line.bulks} onChange={bulks => onChange({ bulks })} invalid={flag("indica cuántos bultos")} />
        <span className={styles.times} aria-hidden="true">×</span>
        <NumberField label="Piezas por bulto" value={line.unitsPerBulk} onChange={unitsPerBulk => onChange({ unitsPerBulk })} invalid={flag("indica las piezas por bulto")} />
        <NumberField label="Precio por bulto" prefix="$" step="0.01" min="0.01" value={line.pricePerBulk} onChange={pricePerBulk => onChange({ pricePerBulk })} invalid={flag("indica el precio por bulto")} />
      </div>}
      <label className={styles.switch}>
        <input type="checkbox" role="switch" checked={line.taxed} onChange={event => onChange({ taxed: event.target.checked })} />
        <span aria-hidden="true" />
        Compra con factura (IVA)
      </label>
    </div>
    <footer className={styles.lineSummary}>
      {totals.units > 0 ? <>
        <span>{pieces(totals.units)}</span>
        {totals.unitCost > 0 && <span>{money(totals.unitCost)} c/u</span>}
        <b>{money(totals.total)}</b>
      </> : <span>Captura las cantidades para ver el subtotal.</span>}
    </footer>
    {showIssues && issues.length > 0 && <p className={styles.lineIssue} role="alert">Falta: {issues.join(", ")}.</p>}
  </article>;
}

export function PurchasesWorkspace({ products, colors, onInventoryChanged }: {
  products: PurchaseProduct[]; colors: Record<number, string>; onInventoryChanged: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [draft, setDraft] = useState<PurchaseDraft>(emptyPurchase);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const loadHistory = useCallback(async (nextPage = 0) => {
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const data = await controlRequest<Page<Purchase>>(`/purchase?page=${nextPage}&size=${PAGE_SIZE}`);
      const content = data?.content || [];
      setPurchases(current => {
        const merged = new Map((nextPage ? current : []).map(item => [item.id, item]));
        content.forEach(item => merged.set(item.id, item));
        return sortPurchases([...merged.values()]);
      });
      setPage(nextPage);
      setHasMore(data?.last === false || (data?.last == null && content.length === PAGE_SIZE));
      setTotal(typeof data?.totalElements === "number" ? data.totalElements : null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No fue posible cargar las compras.");
    } finally {
      setHistoryBusy(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void loadHistory(0); });
    return () => { active = false; };
  }, [loadHistory]);

  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const suppliers = useMemo(() => [...new Set(purchases.map(item => item.supplierName?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es")), [purchases]);
  const totals = draftTotals(draft);
  const issues = draftIssues(draft);
  const generalIssues = issues.filter(issue => !issue.startsWith("Producto "));

  const updateLine = (key: string, patch: Partial<PurchaseLine>) => {
    setFormError("");
    setDraft(current => ({ ...current, lines: current.lines.map(line => line.key === key ? { ...line, ...patch } : line) }));
  };
  const reset = () => { setDraft(emptyPurchase()); setEditing(null); setAttempted(false); setFormError(""); };
  const startEdit = (purchase: Purchase) => {
    setDraft(draftFromPurchase(purchase));
    setEditing(purchase);
    setAttempted(false);
    setFormError("");
    setNotice("");
    setTab("new");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const askEdit = (purchase: Purchase) => {
    if (isDirty(draft) && editing?.id !== purchase.id) setConfirm({ kind: "edit", purchase });
    else startEdit(purchase);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setNotice("");
    if (issues.length) {
      setFormError(issues.length === 1 ? issues[0] : `Revisa ${issues.length} detalles marcados antes de guardar.`);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid]")?.focus());
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const saved = await controlRequest<Purchase>(editing ? `/purchase/${editing.id}` : "/purchase", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(toPurchaseRequest(draft)),
      });
      const wasEditing = Boolean(editing);
      reset();
      setHighlight(saved?.id ?? editing?.id ?? null);
      setNotice(wasEditing ? "Compra actualizada. El inventario se recalculó." : "Compra registrada. Las piezas ya se sumaron al inventario.");
      setTab("history");
      setSearch("");
      await Promise.allSettled([loadHistory(0), Promise.resolve(onInventoryChanged())]);
    } catch (error) {
      // El borrador se conserva para corregir y reintentar.
      setFormError(error instanceof Error ? error.message : "No fue posible guardar la compra.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (purchase: Purchase) => {
    setDeleting(true);
    try {
      await controlRequest<void>(`/purchase/${purchase.id}`, { method: "DELETE" });
      if (editing?.id === purchase.id) reset();
      setPurchases(current => current.filter(item => item.id !== purchase.id));
      setTotal(current => current == null ? current : Math.max(0, current - 1));
      setNotice(`Compra #${purchase.id} eliminada.`);
      setConfirm(null);
      await Promise.resolve(onInventoryChanged());
    } catch (error) {
      setConfirm(null);
      setNotice("");
      setHistoryError(error instanceof Error ? error.message : "No fue posible eliminar la compra.");
    } finally {
      setDeleting(false);
    }
  };

  const itemName = (item: PurchaseItem) => {
    const id = item.productId || item.product?.id;
    return item.product?.name || (id ? productById.get(id)?.name : undefined) || "Producto";
  };
  const filtered = useMemo(() => {
    const words = plain(search).split(/\s+/).filter(Boolean);
    if (!words.length) return purchases;
    return purchases.filter(purchase => {
      const text = plain([`#${purchase.id}`, purchase.supplierName, purchase.purchaseDate?.slice(0, 10), purchaseDateLabel(purchase.purchaseDate),
        ...(purchase.purchaseItemsRequest || []).map(item => {
          const id = item.productId || item.product?.id;
          return [item.product?.name || (id ? productById.get(id)?.name : ""), id ? colors[id] : ""].join(" ");
        })].filter(Boolean).join(" "));
      return words.every(word => text.includes(word));
    });
  }, [purchases, search, productById, colors]);
  const historyCount = total ?? purchases.length;
  const taken = (key: string) => new Set(draft.lines.filter(line => line.key !== key && line.productId).map(line => line.productId));

  return <section className={styles.workspace}>
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>ADQUISICIÓN DE MERCANCÍA</p>
        <h2>Compras a proveedores</h2>
        <p>Registra lo que te llegó y las piezas se suman solas a tu inventario.</p>
      </div>
    </header>
    <div className={styles.tabs} role="tablist" aria-label="Compras">
      <button type="button" role="tab" id="purchase-tab-new" aria-controls="purchase-panel-new" aria-selected={tab === "new"} onClick={() => setTab("new")}>
        {editing ? `Editando compra #${editing.id}` : "Registrar compra"}
      </button>
      <button type="button" role="tab" id="purchase-tab-history" aria-controls="purchase-panel-history" aria-selected={tab === "history"} onClick={() => setTab("history")}>
        Compras registradas <span className={styles.count}>{historyCount}{hasMore && total == null ? "+" : ""}</span>
      </button>
    </div>
    {notice && <p className={styles.notice} role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">✕</button></p>}

    {tab === "new" && <form ref={formRef} id="purchase-panel-new" role="tabpanel" aria-labelledby="purchase-tab-new" className={styles.form} onSubmit={submit} noValidate>
      {editing && <div className={styles.editing}>
        <div><strong>Estás editando la compra #{editing.id}</strong><span>Del {purchaseDateLabel(editing.purchaseDate)}. Al guardar, el inventario se ajusta con las nuevas cantidades.</span></div>
        <button type="button" className={styles.secondary} onClick={reset}>Cancelar edición</button>
      </div>}

      <section className={styles.card}>
        <h3><span>1</span>Datos de la compra</h3>
        <div className={styles.detailsGrid}>
          <label className={styles.field}>
            <span>Proveedor <em>opcional</em></span>
            <input list="purchase-suppliers" value={draft.supplierName} maxLength={120} placeholder="¿A quién le compraste?" onChange={event => setDraft({ ...draft, supplierName: event.target.value })} />
            <datalist id="purchase-suppliers">{suppliers.map(name => <option key={name} value={name} />)}</datalist>
          </label>
          <label className={styles.field}>
            <span>Fecha de compra</span>
            <input type="date" required value={draft.purchaseDate} aria-invalid={attempted && generalIssues.some(issue => issue.includes("fecha")) || undefined} onChange={event => setDraft({ ...draft, purchaseDate: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Total de la factura o nota <em>opcional</em></span>
            <span className={styles.inputWrap} data-prefix=""><i aria-hidden="true">$</i>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={draft.invoiceTotal} placeholder="0.00" onChange={event => setDraft({ ...draft, invoiceTotal: event.target.value })} />
            </span>
            <small>Lo comparamos con la suma de los productos.</small>
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h3><span>2</span>Productos recibidos <small>{draft.lines.length} {draft.lines.length === 1 ? "línea" : "líneas"}</small></h3>
        <div className={styles.lines}>
          {draft.lines.map((line, index) => <LineCard key={line.key} line={line} index={index} count={draft.lines.length} products={products} colors={colors}
            taken={taken(line.key)} showIssues={attempted} onChange={patch => updateLine(line.key, patch)}
            onRemove={() => setDraft(current => ({ ...current, lines: current.lines.filter(item => item.key !== line.key) }))} />)}
        </div>
        <button type="button" className={styles.addLine} onClick={() => setDraft(current => ({ ...current, lines: [...current.lines, emptyLine()] }))}>＋ Agregar otro producto</button>
      </section>

      {attempted && generalIssues.length > 0 && <ul className={styles.issues}>{generalIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {formError && <p className={styles.error} role="alert">{formError}</p>}

      <footer className={styles.summaryBar}>
        <div className={styles.summaryNumbers}>
          <span><small>Productos</small><b>{totals.products}</b></span>
          <span><small>Piezas</small><b>{new Intl.NumberFormat("es-MX").format(totals.units)}</b></span>
          <span><small>Total calculado</small><b>{money(totals.total)}</b></span>
          {totals.invoice != null && <span className={styles.check} data-ok={totals.difference === 0 ? "" : undefined}>
            <small>Factura {money(totals.invoice)}</small>
            <b>{totals.difference === 0 ? "✓ Cuadra" : (totals.difference || 0) > 0 ? `Faltan ${money(totals.difference || 0)}` : `${money(Math.abs(totals.difference || 0))} de más`}</b>
          </span>}
        </div>
        <div className={styles.summaryActions}>
          <button type="button" className={styles.secondary} disabled={saving || !isDirty(draft)} onClick={() => setConfirm({ kind: "clear" })}>{editing ? "Descartar cambios" : "Limpiar"}</button>
          <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar compra"}</button>
        </div>
      </footer>
    </form>}

    {tab === "history" && <section id="purchase-panel-history" role="tabpanel" aria-labelledby="purchase-tab-history" className={styles.history}>
      <div className={styles.historyTools}>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por proveedor, producto, color o número de compra" aria-label="Buscar compras" />
        <button type="button" className={styles.secondary} disabled={historyBusy} onClick={() => void loadHistory(0)}>{historyBusy ? "Cargando…" : "Actualizar"}</button>
        <button type="button" className={styles.primary} onClick={() => { if (editing) reset(); setTab("new"); }}>＋ Nueva compra</button>
      </div>
      {historyError && <p className={styles.error} role="alert">{historyError}</p>}
      {!historyBusy && !historyError && purchases.length === 0 && <div className={styles.empty}>
        <strong>Aún no registras compras</strong>
        <p>Cuando te llegue mercancía, regístrala aquí para sumar las piezas al inventario y conocer tu costo real.</p>
        <button type="button" className={styles.primary} onClick={() => setTab("new")}>Registrar la primera compra</button>
      </div>}
      {purchases.length > 0 && filtered.length === 0 && <p className={styles.muted}>Ninguna compra cargada coincide con “{search}”.{hasMore ? " Prueba cargando más compras." : ""}</p>}
      <div className={styles.purchases}>
        {filtered.map(purchase => {
          const items = purchase.purchaseItemsRequest || [];
          const itemsTotal = items.reduce((sum, item) => sum + Number(item.totalPaid || 0), 0);
          const invoice = Number(purchase.totalInvoiceAmount || 0);
          return <details key={purchase.id} className={styles.purchase} data-highlight={highlight === purchase.id ? "" : undefined}>
            <summary>
              <div className={styles.purchaseMain}>
                <strong>{purchase.supplierName || "Sin proveedor"}</strong>
                <small>Compra #{purchase.id} · {purchaseDateLabel(purchase.purchaseDate)}</small>
                <span className={styles.chips}>
                  {items.slice(0, 3).map((item, index) => <span key={item.id ?? index}><Swatch color={colors[item.productId || item.product?.id || 0]} />{itemName(item)}</span>)}
                  {items.length > 3 && <span>+{items.length - 3} más</span>}
                </span>
              </div>
              <div className={styles.purchaseNumbers}><b>{money(purchaseTotal(purchase))}</b><small>{pieces(purchaseUnits(purchase))}</small></div>
              <span className={styles.chevron} aria-hidden="true">›</span>
            </summary>
            <div className={styles.purchaseDetail}>
              <div className={styles.tableWrap}><table>
                <thead><tr><th>Producto</th><th>Cómo se compró</th><th>Piezas</th><th>Costo c/u</th><th>Subtotal</th></tr></thead>
                <tbody>{items.map((item, index) => {
                  const id = item.productId || item.product?.id;
                  return <tr key={item.id ?? index}>
                    <td><strong>{itemName(item)}</strong><small>{meta(item.product || (id ? productById.get(id) : undefined), id ? colors[id] : undefined)}</small></td>
                    <td>{item.isBulk ? `${item.bulksReceived || 0} ${Number(item.bulksReceived) === 1 ? "bulto" : "bultos"} × ${item.unitsPerBulk || 0} pzas` : "Por pieza"}{item.isTaxed && <em className={styles.tag}>Con factura</em>}</td>
                    <td>{item.totalUnitsAcquired || 0}</td>
                    <td>{money(Number(item.unitCostNet || 0))}</td>
                    <td><b>{money(Number(item.totalPaid || 0))}</b></td>
                  </tr>;
                })}</tbody>
              </table></div>
              <footer>
                <span>Suma de productos <b>{money(itemsTotal)}</b>{invoice > 0 && <> · Factura <b>{money(invoice)}</b></>}</span>
                <span className={styles.rowActions}>
                  <button type="button" className={styles.secondary} onClick={() => askEdit(purchase)}>Editar</button>
                  <button type="button" className={styles.dangerButton} onClick={() => setConfirm({ kind: "delete", purchase })}>Eliminar</button>
                </span>
              </footer>
            </div>
          </details>;
        })}
      </div>
      {hasMore && <button type="button" className={styles.more} disabled={historyBusy} onClick={() => void loadHistory(page + 1)}>{historyBusy ? "Cargando…" : "Cargar compras anteriores"}</button>}
    </section>}

    <ConfirmDialog
      open={confirm !== null}
      tone={confirm?.kind === "edit" ? "primary" : "danger"}
      busy={deleting}
      title={confirm?.kind === "delete" ? `¿Eliminar la compra #${confirm.purchase.id}?` : confirm?.kind === "edit" ? `¿Editar la compra #${confirm.purchase.id}?` : editing ? "¿Descartar los cambios?" : "¿Limpiar el formulario?"}
      confirmLabel={confirm?.kind === "delete" ? "Eliminar compra" : confirm?.kind === "edit" ? "Sí, editar" : editing ? "Descartar" : "Limpiar"}
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        if (!confirm) return;
        if (confirm.kind === "delete") void remove(confirm.purchase);
        else if (confirm.kind === "edit") { setConfirm(null); startEdit(confirm.purchase); }
        else { setConfirm(null); reset(); }
      }}
    >
      {confirm?.kind === "delete" && <p>Úsalo solo si fue un registro equivocado. Se quitará del historial de compras; revisa el inventario después.</p>}
      {confirm?.kind === "edit" && <p>Tienes una compra sin guardar en el formulario. Si continúas, se reemplazará por la compra #{confirm.purchase.id}.</p>}
      {confirm?.kind === "clear" && <p>{editing ? "La compra se quedará como estaba antes de editarla." : "Se borrará lo que capturaste en esta compra."}</p>}
    </ConfirmDialog>
  </section>;
}
