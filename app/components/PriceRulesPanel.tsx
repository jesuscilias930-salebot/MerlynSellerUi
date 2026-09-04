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

type PriceRule = {
  id?: number;
  productId: number;
  productDTO?: Product;
  ruleName: string;
  minQuantity: number;
  maxQuantity: number;
  pricePerUnit: number;
};

type RangeDraft = { ruleName: string; minQuantity: string; maxQuantity: string; pricePerUnit: string };

const emptyRange = (): RangeDraft => ({ ruleName: "", minQuantity: "", maxQuantity: "", pricePerUnit: "" });
const productLabel = (product: Product) => `${product.name} - ${product.category?.name || "Sin categoría"} - ${product.gender || "Sin género"}`;
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value || 0);

export function PriceRulesPanel({ products }: { products: Product[] }) {
  const [groups, setGroups] = useState<Record<string, PriceRule[]>>({});
  const [productId, setProductId] = useState("");
  const [copyFromProductId, setCopyFromProductId] = useState("");
  const [ranges, setRanges] = useState<RangeDraft[]>([emptyRange()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setGroups((await controlRequest<Record<string, PriceRule[]>>("/price-rule")) || {}); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cargar las escalas."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const sortedGroups = useMemo(() => Object.entries(groups)
    .map(([id, rules]) => ({ productId: Number(id), rules: [...rules].sort((a, b) => a.minQuantity - b.minQuantity) }))
    .sort((a, b) => (a.rules[0]?.productDTO?.name || "").localeCompare(b.rules[0]?.productDTO?.name || "")), [groups]);

  const validationError = useMemo(() => {
    const complete = ranges.map((range) => ({ min: Number(range.minQuantity), max: Number(range.maxQuantity), price: Number(range.pricePerUnit) })).sort((a, b) => a.min - b.min);
    if (complete.some((range) => !range.min || !range.max || range.price < 0)) return "Completa todas las cantidades y precios.";
    if (complete.some((range) => range.max < range.min)) return "La cantidad final debe ser igual o mayor que la inicial.";
    if (complete.some((range, index) => index > 0 && range.min <= complete[index - 1].max)) return "Los rangos no pueden traslaparse.";
    return "";
  }, [ranges]);

  const changeRange = (index: number, change: Partial<RangeDraft>) => setRanges((current) => current.map((range, rangeIndex) => rangeIndex === index ? { ...range, ...change } : range));
  const toDrafts = (sourceRules: PriceRule[]) => sourceRules.map((rule) => ({ ruleName: rule.ruleName, minQuantity: String(rule.minQuantity), maxQuantity: String(rule.maxQuantity), pricePerUnit: String(rule.pricePerUnit) }));
  const openEditor = (nextProductId = "", sourceRules?: PriceRule[]) => { setProductId(nextProductId); setCopyFromProductId(""); setRanges(sourceRules?.length ? toDrafts(sourceRules) : [emptyRange()]); setNotice(""); };
  const copyRanges = () => {
    const source = groups[copyFromProductId] || [];
    if (!source.length) return setNotice("El producto origen todavía no tiene escalas configuradas.");
    setRanges(toDrafts([...source].sort((a, b) => a.minQuantity - b.minQuantity)));
    setNotice(`${source.length} escala${source.length === 1 ? "" : "s"} copiada${source.length === 1 ? "" : "s"}. Puedes modificarlas antes de guardar.`);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!productId) return setNotice("Selecciona el producto que recibirá las escalas.");
    if (validationError) return setNotice(validationError);
    setSaving(true); setNotice("");
    try {
      const payload: PriceRule[] = ranges.map((range, index) => ({ productId: Number(productId), ruleName: range.ruleName.trim() || `Escala ${index + 1}`, minQuantity: Number(range.minQuantity), maxQuantity: Number(range.maxQuantity), pricePerUnit: Number(range.pricePerUnit) }));
      await controlRequest<PriceRule[]>("/price-rule/batch", { method: "POST", body: JSON.stringify(payload) });
      await refresh();
      setNotice(`${payload.length} escala${payload.length === 1 ? "" : "s"} guardada${payload.length === 1 ? "" : "s"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar las escalas."); }
    finally { setSaving(false); }
  };
  const removeRule = async (rule: PriceRule) => {
    if (!rule.id || !window.confirm(`¿Eliminar la escala “${rule.ruleName}”?`)) return;
    try { await controlRequest<void>(`/price-rule/${rule.id}`, { method: "DELETE" }); await refresh(); setNotice("Escala eliminada."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar la escala."); }
  };
  const selectedProduct = products.find((product) => product.id === Number(productId));
  const copyProducts = products.filter((product) => product.id !== Number(productId));

  return <section className="price-rules-workspace">
    <header className="price-rules-header"><div><p>PRECIOS</p><h2>Escalas de precio</h2><span>Configura precios por cantidad para cada producto de tu catálogo.</span></div><button type="button" className="plain-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar"}</button></header>
    {notice && <div className="control-notice">{notice}</div>}
    <form className="price-rule-editor" onSubmit={save}>
      <header><div><p>CONFIGURACIÓN</p><h3>{selectedProduct ? `Escalas: ${selectedProduct.name}` : "Nueva configuración"}</h3></div><button type="button" className="plain-button" onClick={() => openEditor()}>Limpiar</button></header>
      <label>Producto afectado<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">Selecciona el producto</option>{products.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}</select></label>
      <div className="price-rule-copy"><label>Copiar rangos de otro producto<select value={copyFromProductId} onChange={(event) => setCopyFromProductId(event.target.value)} disabled={!productId}><option value="">Selecciona un producto origen</option>{copyProducts.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}</select></label><button type="button" className="plain-button" disabled={!copyFromProductId} onClick={copyRanges}>Copiar escalas</button></div>
      <div className="price-rule-ranges-heading"><div><b>Rangos de cantidades y precios</b><small>Los rangos del mismo producto no pueden traslaparse.</small></div><button type="button" className="plain-button" onClick={() => setRanges((current) => [...current, emptyRange()])}>＋ Agregar rango</button></div>
      <div className="price-rule-ranges">{ranges.map((range, index) => <fieldset key={index}><legend>Escala {index + 1}</legend><label>Nombre de la escala<input value={range.ruleName} onChange={(event) => changeRange(index, { ruleName: event.target.value })} placeholder="Ej. Menudeo" required /></label><label>Desde (pares)<input type="number" min="1" value={range.minQuantity} onChange={(event) => changeRange(index, { minQuantity: event.target.value })} required /></label><label>Hasta (pares)<input type="number" min="1" value={range.maxQuantity} onChange={(event) => changeRange(index, { maxQuantity: event.target.value })} required /></label><label>Precio por par<input type="number" min="0" step="0.01" value={range.pricePerUnit} onChange={(event) => changeRange(index, { pricePerUnit: event.target.value })} required /></label><button type="button" className="danger-link" disabled={ranges.length === 1} onClick={() => setRanges((current) => current.filter((_, rangeIndex) => rangeIndex !== index))}>Quitar</button></fieldset>)}</div>
      {validationError && <p className="price-rule-error">{validationError}</p>}
      <button disabled={saving || !products.length}>{saving ? "Guardando…" : "Guardar escalas"}</button>
    </form>
    <div className="price-rule-groups">{sortedGroups.map((group) => {
      const product = group.rules[0]?.productDTO || products.find((item) => item.id === group.productId);
      return <article key={group.productId}><header><div><p>{product?.category?.name || "Sin categoría"}{product?.gender ? ` · ${product.gender}` : ""}</p><h3>{product?.name || `Producto #${group.productId}`}</h3><small>Stock: {product?.currentStock ?? 0}{(product?.currentStock ?? 0) <= (product?.minStockAlert ?? 0) ? " · Stock bajo" : ""}</small></div><button type="button" className="plain-button" onClick={() => openEditor(String(group.productId), group.rules)}>Editar escalas</button></header><div className="price-rule-cards">{group.rules.map((rule) => <div key={rule.id || `${rule.minQuantity}-${rule.maxQuantity}`}><span>{rule.ruleName || "Escala"}</span><b>{rule.minQuantity} — {rule.maxQuantity} pares</b><strong>{money(rule.pricePerUnit)}</strong><button type="button" className="danger-link" onClick={() => void removeRule(rule)}>Eliminar</button></div>)}</div></article>;
    })}</div>
    {!loading && sortedGroups.length === 0 && <div className="price-rules-empty"><b>Aún no hay escalas configuradas.</b><span>Selecciona un producto y crea su primera configuración de precios.</span></div>}
  </section>;
}
