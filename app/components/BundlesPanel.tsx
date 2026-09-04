"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { controlRequest } from "../lib/control-api";

type Product = {
  id: number;
  name: string;
  currentStock: number;
  minStockAlert: number;
  category?: { name?: string | null } | null;
  gender?: string | null;
};
type PriceRule = { id: number; ruleName: string; minQuantity: number; maxQuantity: number; pricePerUnit: number };
type BundleItem = { id?: number; productId: number; productName?: string; quantity: number; assignedUnitPrice: number };
type Bundle = { id?: number; name: string; fixedPrice: number; items: BundleItem[] };
type DraftItem = { id?: number; productId: string; quantity: string; assignedUnitPrice: string };
type FinancialReport = { totalOrderSale?: number; totalOrderProfit?: number; totalOrderTax?: number; totalIsr?: number };

const blankItem = (): DraftItem => ({ productId: "", quantity: "", assignedUnitPrice: "" });
const money = (value?: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
const productLabel = (product: Product) => `${product.name} - ${product.category?.name || "Sin categoría"} - ${product.gender || "Sin género"}`;

export function BundlesPanel({ products }: { products: Product[] }) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [rulesByItem, setRulesByItem] = useState<Record<number, PriceRule[]>>({});
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setBundles(await controlRequest<Bundle[]>("/bundles")); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cargar los bundles."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const fixedPrice = useMemo(() => items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.assignedUnitPrice || 0), 0), [items]);
  const validItems = useMemo(() => items.every((item) => Number(item.productId) > 0 && Number(item.quantity) > 0 && item.assignedUnitPrice !== "" && Number(item.assignedUnitPrice) >= 0), [items]);

  const loadRules = async (productId: string, index: number) => {
    if (!productId) return setRulesByItem((current) => ({ ...current, [index]: [] }));
    try {
      const rules = await controlRequest<PriceRule[]>(`/price-rule/product/${productId}`);
      setRulesByItem((current) => ({ ...current, [index]: [...rules].sort((a, b) => a.minQuantity - b.minQuantity) }));
    } catch { setRulesByItem((current) => ({ ...current, [index]: [] })); }
  };
  const changeItem = (index: number, change: Partial<DraftItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
    if (change.productId !== undefined) void loadRules(change.productId, index);
    setReport(null);
  };
  const resetEditor = () => { setEditingId(null); setName(""); setItems([blankItem()]); setRulesByItem({}); setReport(null); setNotice(""); };
  const editBundle = (bundle: Bundle) => {
    setEditingId(bundle.id || null);
    setName(bundle.name);
    const nextItems = bundle.items.map((item) => ({ id: item.id, productId: String(item.productId), quantity: String(item.quantity), assignedUnitPrice: String(item.assignedUnitPrice) }));
    setItems(nextItems.length ? nextItems : [blankItem()]);
    setRulesByItem({}); setReport(null); setNotice("");
    nextItems.forEach((item, index) => void loadRules(item.productId, index));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) return setNotice("Escribe un nombre de al menos 3 caracteres.");
    if (!validItems) return setNotice("Completa producto, cantidad y precio unitario de cada renglón.");
    setSaving(true); setNotice("");
    const payload = {
      name: name.trim(), fixedPrice,
      items: items.map((item) => ({ ...(item.id ? { id: item.id } : {}), product: { id: Number(item.productId) }, quantity: Number(item.quantity), assignedUnitPrice: Number(item.assignedUnitPrice) })),
    };
    try {
      await controlRequest<Bundle>(editingId ? `/bundles/${editingId}` : "/bundles", { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      await refresh(); resetEditor(); setNotice(editingId ? "Bundle actualizado." : "Bundle creado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el bundle."); }
    finally { setSaving(false); }
  };
  const preview = async () => {
    if (!validItems) return setNotice("Completa los productos antes de calcular la ganancia.");
    setAnalyzing(true); setReport(null);
    try {
      const payload = items.map((item) => ({ product: { id: Number(item.productId) }, quantity: Number(item.quantity), assignedUnitPrice: Number(item.assignedUnitPrice) }));
      setReport(await controlRequest<FinancialReport>("/financial/calculate/bundle-profit", { method: "POST", body: JSON.stringify(payload) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible calcular la ganancia."); }
    finally { setAnalyzing(false); }
  };
  const deleteBundle = async (bundle: Bundle) => {
    if (!bundle.id || !window.confirm(`¿Eliminar el bundle “${bundle.name}”?`)) return;
    try { await controlRequest<void>(`/bundles/${bundle.id}`, { method: "DELETE" }); await refresh(); setNotice("Bundle eliminado."); if (editingId === bundle.id) resetEditor(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el bundle."); }
  };

  return <section className="bundles-workspace">
    <header className="bundles-header"><div><p>BUNDLES</p><h2>Paquetes especiales</h2><span>Combina productos, asigna su precio de venta y consulta la ganancia estimada.</span></div><button type="button" className="plain-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar"}</button></header>
    {notice && <div className="control-notice">{notice}</div>}
    <div className="bundles-layout">
      <form className="bundle-editor" onSubmit={save}>
        <header><div><p>CONFIGURACIÓN</p><h3>{editingId ? "Editar bundle" : "Nuevo bundle"}</h3></div>{editingId && <button type="button" className="plain-button" onClick={resetEditor}>Cancelar edición</button>}</header>
        <label>Nombre del paquete<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Pack Mayorista Platinum" minLength={3} required /></label>
        <div className="bundle-items-heading"><div><b>Productos en el paquete</b><small>El precio final se calcula con los precios unitarios asignados.</small></div><button type="button" className="plain-button" onClick={() => { setItems((current) => [...current, blankItem()]); setReport(null); }}>＋ Agregar producto</button></div>
        <div className="bundle-items">{items.map((item, index) => <fieldset key={`${item.id || "new"}-${index}`}><legend>Producto {index + 1}</legend><label>Producto<select value={item.productId} onChange={(event) => changeItem(index, { productId: event.target.value })} required><option value="">Selecciona un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}</select></label><label>Cantidad<input type="number" min="1" value={item.quantity} onChange={(event) => changeItem(index, { quantity: event.target.value })} required /></label><label>Precio unitario asignado<input type="number" min="0" step="0.01" value={item.assignedUnitPrice} onChange={(event) => changeItem(index, { assignedUnitPrice: event.target.value })} required /></label><button type="button" className="danger-link" disabled={items.length === 1} onClick={() => { setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); setReport(null); }}>Quitar</button>{rulesByItem[index]?.length > 0 && <div className="bundle-rules-hint"><b>Escalas de mayoreo disponibles</b>{rulesByItem[index].map((rule) => <span key={rule.id}>{rule.ruleName}: {rule.minQuantity}–{rule.maxQuantity} pzas · {money(rule.pricePerUnit)}</span>)}</div>}</fieldset>)}</div>
        <div className="bundle-summary"><span>Precio final de venta</span><b>{money(fixedPrice)}</b><small>Subtotal de productos: {money(fixedPrice)}</small></div>
        {report && <div className="bundle-financial-report"><b>Ganancia estimada</b><span>Venta: {money(report.totalOrderSale)}</span><span>IVA neto: {money(report.totalOrderTax)}</span><span>ISR estimado: {money(report.totalIsr)}</span><strong className={(report.totalOrderProfit || 0) <= 0 ? "negative" : ""}>Ganancia neta: {money(report.totalOrderProfit)}</strong></div>}
        <div className="bundle-editor-actions"><button type="button" className="plain-button" onClick={() => void preview()} disabled={analyzing || !validItems}>{analyzing ? "Analizando…" : "Ver ganancia estimada"}</button><button disabled={saving || !products.length}>{saving ? "Guardando…" : "Guardar bundle"}</button></div>
      </form>
      <section className="bundle-list"><header><div><p>CATÁLOGO</p><h3>Bundles guardados</h3></div><b>{bundles.length}</b></header>{!loading && bundles.length === 0 && <div className="bundles-empty">Aún no hay paquetes. Crea tu primer bundle.</div>}{bundles.map((bundle) => <article key={bundle.id}><header><div><small>Bundle #{bundle.id}</small><h3>{bundle.name}</h3></div><strong>{money(bundle.fixedPrice)}</strong></header><ul>{bundle.items.map((item) => <li key={item.id || `${item.productId}-${item.quantity}`}><span>{item.quantity}× {item.productName || `Producto #${item.productId}`}</span><b>{money(item.assignedUnitPrice)} c/u</b></li>)}</ul><footer><span>{bundle.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} piezas · {bundle.items.length} productos</span><div><button type="button" className="plain-button" onClick={() => editBundle(bundle)}>Editar</button><button type="button" className="danger-link" onClick={() => void deleteBundle(bundle)}>Eliminar</button></div></footer></article>)}</section>
    </div>
  </section>;
}
