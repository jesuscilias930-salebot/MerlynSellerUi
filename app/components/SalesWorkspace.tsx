"use client";

import { useEffect, useState, type FormEvent } from "react";
import { controlRequest } from "../lib/control-api";
import { salesToday, salesRange, validSalesRange, saleProductName, saleSource, type SalesPeriod, type SalesRange, type SaleProduct } from "../lib/sales-workspace";
import { StoreOrdersPanel } from "./StoreOrdersPanel";
import styles from "./SalesWorkspace.module.css";

type Sale = { id: number; saleDate?: string; source?: string; subtotal: number; customer?: { name?: string; phone?: string }; saleItemDtoList?: { id: number; quantity: number; unitPriceAtSale: number; product?: SaleProduct; bundle?: { name?: string } }[] };
type Page = { content: Sale[]; totalElements: number; totalPages: number };
type Expense = { date: string; advertising: number; notes: string };
type Summary = { start: string; end: string; saleCount: number; grossIncome: number; reinvestment: number; advertising: number; taxes: number; taxBase: number; taxRate: number; profitBeforeTaxes: number; netProfit: number | null; missingCostLines: number };
type Tab = "list" | "register" | "ads" | "report";
const money = (value: number | string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
const dateLabel = (date: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
const message = (error: unknown) => error instanceof Error ? error.message : "No fue posible completar la solicitud.";

function PeriodFilters({ value, onApply, children, initialPeriod = "day" }: { value: SalesRange; onApply: (range: SalesRange) => void; children?: React.ReactNode; initialPeriod?: SalesPeriod }) {
  const [period, setPeriod] = useState<SalesPeriod>(initialPeriod);
  const [draft, setDraft] = useState(value);
  return <form className={styles.filters} onSubmit={event => { event.preventDefault(); if (validSalesRange(draft)) onApply(draft); }}>
    <label>Periodo<select value={period} onChange={event => { const next = event.target.value as SalesPeriod; setPeriod(next); if (next !== "custom") setDraft(salesRange(next, draft.start)); }}><option value="day">Día</option><option value="week">Semana (lunes a domingo)</option><option value="year">Año</option><option value="custom">Fecha personalizada</option></select></label>
    {period !== "custom" ? <label>{period === "year" ? "Elige una fecha del año" : period === "week" ? "Elige una fecha de la semana" : "Fecha"}<input type="date" required value={draft.start} onChange={e => { if (e.target.value) setDraft(salesRange(period, e.target.value)); }} /></label> : <><label>Desde<input type="date" value={draft.start} required onChange={e => setDraft({ ...draft, start: e.target.value })} /></label><label>Hasta<input type="date" value={draft.end} min={draft.start} required onChange={e => setDraft({ ...draft, end: e.target.value })} /></label></>}
    {children}<button type="submit" disabled={!validSalesRange(draft)}>Consultar</button>
  </form>;
}

export function SalesWorkspace() {
  const [tab, setTab] = useState<Tab>("list");
  const [listDate, setListDate] = useState(salesToday());
  return <section className={styles.workspace}>
    <header><p className={styles.kicker}>CONTROL SOCKS</p><h2>Ventas y resultados</h2><p>Consulta tus ventas, registra operaciones y lleva el control de tus gastos.</p></header>
    <div className={styles.tabs} role="tablist" aria-label="Ventas">
      {([["list", "Ventas"], ["register", "Registrar venta"], ["ads", "Anuncios"], ["report", "Reporte"]] as const).map(([id, label]) => <button key={id} id={`sales-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`sales-panel-${id}`} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`sales-panel-${tab}`} aria-labelledby={`sales-tab-${tab}`}>
      {tab === "list" && <SalesList initialDate={listDate} />}
      {tab === "register" && <RegisterSale onRegistered={date => { setListDate(date); setTab("list"); }} />}
      {tab === "ads" && <AdvertisingPanel />}
      {tab === "report" && <SalesReport />}
    </div>
  </section>;
}

function SalesList({ initialDate }: { initialDate: string }) {
  const [range, setRange] = useState(salesRange("day", initialDate));
  const [sourceDraft, setSourceDraft] = useState(""); const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState({ source: "", search: "" });
  const [page, setPage] = useState(0); const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Page | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const [showOrders, setShowOrders] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setBusy(true); setError(""); setData(null); } });
    const params = new URLSearchParams({ ...range, page: String(page), size: "20" });
    if (filters.source) params.set("source", filters.source); if (filters.search) params.set("search", filters.search);
    controlRequest<Page>(`/sales?${params}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(err => { if (!controller.signal.aborted) setError(message(err)); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [range, page, filters, revision]);
  return <div className={styles.section}>
    <div className={styles.heading}><div><h3>Historial de ventas</h3><p>Las ventas confirmadas desde chats se incluyen automáticamente. Conversar o cotizar no registra una venta.</p></div><button type="button" disabled={busy} onClick={() => setRevision(r => r + 1)}>Actualizar</button></div>
    <PeriodFilters value={range} onApply={next => { setRange(next); setFilters({ source: sourceDraft, search: searchDraft.trim() }); setPage(0); }}>
      <label>Origen<select value={sourceDraft} onChange={e => setSourceDraft(e.target.value)}><option value="">Todos los orígenes</option><option value="CHAT">Chat</option><option value="MANUAL">Manual</option><option value="STORE">Tienda</option></select></label>
      <label>Cliente o teléfono<input value={searchDraft} maxLength={120} placeholder="Buscar cliente" onChange={e => setSearchDraft(e.target.value)} /></label>
    </PeriodFilters>
    <p className={styles.caption}>{dateLabel(range.start)} — {dateLabel(range.end)} · {data ? `${data.totalElements} ventas` : "Consultando…"}</p>
    {busy && <p role="status">Cargando ventas…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {data && data.content.length === 0 && <p className={styles.empty}>No hay ventas registradas con estos filtros.</p>}
    <div className={styles.sales}>{data?.content.map(sale => <details key={sale.id} className={styles.sale}>
      <summary><span><strong>Venta #{sale.id} · {sale.customer?.name || "Cliente"}</strong><small>{sale.saleDate ? dateLabel(sale.saleDate) : "Fecha no registrada"} · {saleSource(sale.source)}</small></span><strong>{money(sale.subtotal)}</strong><span className={styles.view}>Ver detalle</span></summary>
      <div className={styles.ticket}>{sale.customer?.phone && <p>{sale.customer.phone}</p>}{sale.saleItemDtoList?.map(item => <div key={item.id} className={styles.line}><span><strong>{saleProductName(item.product)}</strong>{item.bundle?.name && <small>Paquete: {item.bundle.name}</small>}<small>{item.quantity} unidades × {money(item.unitPriceAtSale)}</small></span><b>{money(item.quantity * Number(item.unitPriceAtSale))}</b></div>)}<div className={styles.total}><strong>Total mercancía</strong><strong>{money(sale.subtotal)}</strong></div></div>
    </details>)}</div>
    <div className={styles.pagination}><button type="button" disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, data?.totalPages || 1)}</span><button type="button" disabled={busy || !data || page + 1 >= data.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
    <div className={styles.orders}><button type="button" aria-expanded={showOrders} onClick={() => setShowOrders(!showOrders)}>{showOrders ? "Ocultar" : "Ver"} pedidos del ecommerce</button>{showOrders && <StoreOrdersPanel />}</div>
  </div>;
}

function RegisterSale({ onRegistered }: { onRegistered: (date: string) => void }) {
  type Product = SaleProduct & { id: number; currentStock: number };
  type Bundle = { id: number; name: string; items?: { assorted?: boolean }[] };
  type Line = { key: number; kind: "product" | "bundle"; itemId: string; quantity: string };
  const [catalog, setCatalog] = useState<{ customers: { id: number; name: string }[]; products: Product[]; bundles: Bundle[] } | null>(null);
  const [lines, setLines] = useState<Line[]>([{ key: 0, kind: "product", itemId: "", quantity: "" }]);
  const [customer, setCustomer] = useState(""); const [date, setDate] = useState(salesToday());
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState<Sale | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setError(""); });
    Promise.all([controlRequest<{ id: number; name: string }[]>("/customers", { signal: controller.signal }), controlRequest<Product[]>("/products/all", { signal: controller.signal }), controlRequest<Bundle[]>("/bundles", { signal: controller.signal })]).then(([customers, products, bundles]) => { if (!controller.signal.aborted) setCatalog({ customers, products, bundles }); }).catch(err => { if (!controller.signal.aborted) setError(message(err)); });
    return () => controller.abort();
  }, [revision]);
  const update = (key: number, change: Partial<Line>) => setLines(current => current.map(line => line.key === key ? { ...line, ...change } : line));
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (saving || saved) return;
    if (!customer || lines.some(line => !line.itemId || !Number.isSafeInteger(Number(line.quantity)) || Number(line.quantity) < 1)) return setError("Selecciona un cliente, artículos y cantidades enteras mayores a cero.");
    setSaving(true); setError("");
    try {
      const sale = await controlRequest<Sale>("/sales", { method: "POST", body: JSON.stringify({ customerId: Number(customer), saleDate: date, productsSold: lines.filter(l => l.kind === "product").map(l => ({ productId: Number(l.itemId), quantity: Number(l.quantity) })), bundlesSold: lines.filter(l => l.kind === "bundle").map(l => ({ bundleId: Number(l.itemId), quantity: Number(l.quantity) })) }) });
      setSaved(sale);
    } catch (err) { setError(message(err)); } finally { setSaving(false); }
  };
  if (saved) return <div className={styles.section} role="status"><h3>Venta #{saved.id} registrada</h3><p>Inventario actualizado. Total mercancía: <strong>{money(saved.subtotal)}</strong></p><button type="button" onClick={() => onRegistered(date)}>Ver ventas</button></div>;
  return <form className={styles.section} onSubmit={save}><h3>Registrar venta manual</h3><p>Registra únicamente ventas confirmadas. Al guardar se descuentan las existencias y se aplican tus reglas de precio.</p>
    {error && <p className={styles.error} role="alert">{error} {!catalog && <button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar carga</button>}</p>}
    {!catalog ? <p>Cargando clientes y catálogo…</p> : <><div className={styles.filters}><label>Cliente<select required value={customer} disabled={saving} onChange={e => setCustomer(e.target.value)}><option value="">Selecciona cliente</option>{catalog.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Fecha de venta<input type="date" required max={salesToday()} value={date} disabled={saving} onChange={e => setDate(e.target.value)} /></label></div>
      {!catalog.customers.length && <p>Primero registra un cliente en Control de ventas → Clientes.</p>}
      <div className={styles.manualLines}>{lines.map((line, index) => <div className={styles.manualLine} key={line.key}><label>Artículo {index + 1}<select disabled={saving} value={line.kind} onChange={e => update(line.key, { kind: e.target.value as Line["kind"], itemId: "" })}><option value="product">Producto individual</option><option value="bundle">Paquete</option></select></label><label>{line.kind === "bundle" ? "Paquete" : "Producto"}<select required disabled={saving} value={line.itemId} onChange={e => update(line.key, { itemId: e.target.value })}><option value="">Selecciona</option>{line.kind === "product" ? catalog.products.map(p => <option value={p.id} key={p.id}>{saleProductName(p)} · {p.currentStock} disponibles</option>) : catalog.bundles.filter(b => !b.items?.some(i => i.assorted)).map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label><label>{line.kind === "bundle" ? "Cajas" : "Unidades / pares"}<input type="number" required min="1" step="1" inputMode="numeric" disabled={saving} value={line.quantity} onChange={e => update(line.key, { quantity: e.target.value })} /></label><button type="button" disabled={saving || lines.length === 1} onClick={() => setLines(current => current.filter(l => l.key !== line.key))} aria-label={`Quitar artículo ${index + 1}`}>Quitar</button></div>)}</div>
      <button className={styles.secondary} type="button" disabled={saving} onClick={() => setLines(current => [...current, { key: Math.max(...current.map(l => l.key)) + 1, kind: "product", itemId: "", quantity: "" }])}>＋ Agregar artículo</button><p className={styles.caption}>Los paquetes con surtido se confirman desde Pedidos de E-commerce para asignar sus variantes. Cantidades de calcetines en pares, no en tripares.</p><button type="submit" disabled={saving || !catalog.customers.length}>{saving ? "Registrando…" : "Confirmar y registrar venta"}</button></>}
  </form>;
}

function AdvertisingPanel() {
  const [range, setRange] = useState(salesRange("week")); const [data, setData] = useState<Expense[] | null>(null);
  const [date, setDate] = useState(salesToday()); const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setData(null); setError(""); } });
    controlRequest<Expense[]>(`/sales/expenses?${new URLSearchParams(range)}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(err => { if (!controller.signal.aborted) setError(message(err)); });
    return () => controller.abort();
  }, [range, revision]);
  return <div className={styles.section}><h3>Gasto diario en anuncios</h3><p>Captura el total gastado ese día en MXN. Editar un día reemplaza su importe; no lo duplica.</p><DailyExpenseForm key={`${date}-${revision}`} date={date} onDate={setDate} onSaved={() => setRevision(r => r + 1)} />
    <h3>Historial de anuncios</h3><PeriodFilters value={range} onApply={setRange} initialPeriod="week" />{error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar</button></p>}
    {!data && !error && <p role="status">Cargando gastos…</p>}{data?.length === 0 && <p>No hay gastos capturados en este periodo.</p>}
    {data && <><div className={styles.total}><strong>Total registrado</strong><strong>{money(data.reduce((sum, entry) => sum + Number(entry.advertising), 0))}</strong></div><div className={styles.expenses}>{data.map(entry => <div key={entry.date}><span><strong>{dateLabel(entry.date)}</strong><small>{entry.notes}</small></span><strong>{money(entry.advertising)}</strong><button type="button" onClick={() => setDate(entry.date)}>Editar</button></div>)}</div></>}
  </div>;
}

function DailyExpenseForm({ date, onDate, onSaved }: { date: string; onDate: (date: string) => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(""); } });
    controlRequest<Expense[]>(`/sales/expenses?start=${date}&end=${date}`, { signal: controller.signal }).then(rows => { if (!controller.signal.aborted) { const entry = rows[0]; setAmount(entry?.advertising == null ? "" : String(entry.advertising)); setNotes(entry?.notes || ""); } }).catch(err => { if (!controller.signal.aborted) setError(message(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, revision]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (saving || loading || error) return;
    setSaving(true); setNotice("");
    try { await controlRequest<Expense>(`/sales/expenses/${date}`, { method: "PUT", body: JSON.stringify({ advertising: Number(amount), notes }) }); setNotice("Importe guardado."); onSaved(); }
    catch (err) { setError(message(err)); } finally { setSaving(false); }
  };
  return <form className={styles.expenseForm} onSubmit={save}><div className={styles.filters}><label>Fecha<input type="date" required value={date} max={salesToday()} disabled={saving} onChange={e => { if (e.target.value) onDate(e.target.value); }} /></label><label>Gasto en anuncios (MXN)<input type="number" step="0.01" min="0" max="999999999999.99" required inputMode="decimal" placeholder="0.00" value={amount} disabled={loading || saving} onChange={e => setAmount(e.target.value)} /></label><label>Notas (opcional)<input maxLength={500} value={notes} disabled={loading || saving} placeholder="Meta, Google u otra campaña" onChange={e => setNotes(e.target.value)} /></label><button type="submit" disabled={loading || saving || Boolean(error)}>{loading ? "Cargando…" : saving ? "Guardando…" : "Guardar importe"}</button></div>{error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar</button></p>}{notice && <p role="status">{notice}</p>}</form>;
}

function SalesReport() {
  const [range, setRange] = useState(salesRange("day")); const [data, setData] = useState<Summary | null>(null);
  const [revision, setRevision] = useState(0); const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setData(null); setError(""); } });
    controlRequest<Summary>(`/sales/report?${new URLSearchParams(range)}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(err => { if (!controller.signal.aborted) setError(message(err)); });
    return () => controller.abort();
  }, [range, revision]);
  return <div className={styles.section}><h3>Reporte de resultados</h3><p>Ingreso bruto − costo de mercancía vendida − anuncios − impuestos estimados = ganancia neta estimada.</p><PeriodFilters value={range} onApply={setRange} />
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar</button></p>}{!data && !error && <p role="status">Calculando el periodo completo…</p>}
    {data && <><p className={styles.caption}>{dateLabel(data.start)} — {dateLabel(data.end)} · {data.saleCount} ventas registradas</p><div className={styles.metrics}>
      {[["Ingreso bruto", data.grossIncome, "Importe de mercancía de ventas registradas"], ["Reinversión", data.reinvestment, "Costo histórico de las unidades vendidas"], ["Anuncios", data.advertising, "Gasto diario capturado"], ["Impuestos estimados", data.taxes, `ISR ${(Number(data.taxRate) * 100).toFixed(0)} % sobre ${money(data.taxBase)} sin IVA`]].map(([title, value, hint]) => <article key={String(title)}><span>{title}</span><strong>{money(Number(value))}</strong><small>{hint}</small></article>)}
      <article className={styles.net}><span>Ganancia neta estimada</span><strong>{data.netProfit == null ? "Pendiente" : money(data.netProfit)}</strong><small>{data.netProfit == null ? "Completa los costos faltantes para obtenerla" : "Resultado bajo la fórmula indicada"}</small></article>
    </div><div className={styles.result}><span>Resultado antes de impuestos estimados</span><strong>{money(data.profitBeforeTaxes)}</strong></div>
      {data.missingCostLines > 0 && <p role="alert" className={styles.error}>Hay {data.missingCostLines} partidas sin costo histórico. La reinversión mostrada es parcial; no se calcula ganancia neta.</p>}
      <p className={styles.caption}>Solo ventas registradas y no anuladas; no cotizaciones ni pedidos pendientes. Ingresos de mercancía sin sumar envío ni añadir IVA otra vez. Costos según los importes guardados en las adquisiciones. Estimación operativa: no calcula el IVA neto a pagar, comisiones de cobro ni otros gastos. No constituye una declaración fiscal.</p></>}
  </div>;
}
