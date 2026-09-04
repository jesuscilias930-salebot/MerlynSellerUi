"use client";

import { useEffect, useMemo, useState } from "react";
import { controlRequest } from "../lib/control-api";

type Product = { id: number; name: string; category?: { name?: string | null } | null; gender?: string | null };
type Bundle = { id: number; name: string; fixedPrice: number };
type PriceRule = { minQuantity: number; maxQuantity: number | null; pricePerUnit: number };
type ProductLine = { productId: string; quantity: string };
type BundleLine = { bundleId: string; quantity: string };

const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value || 0);
const productLabel = (product: Product) => `${product.name}${product.category?.name ? ` - ${product.category.name}` : ""}${product.gender ? ` - ${product.gender}` : ""}`;
const blankProduct = (): ProductLine => ({ productId: "", quantity: "" });
const blankBundle = (): BundleLine => ({ bundleId: "", quantity: "1" });

export function QuoteNoteGenerator({ disabled, onUseNote }: { disabled: boolean; onUseNote: (note: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [priceRules, setPriceRules] = useState<Record<string, PriceRule[]>>({});
  const [productLines, setProductLines] = useState<ProductLine[]>([blankProduct()]);
  const [bundleLines, setBundleLines] = useState<BundleLine[]>([]);
  const [shipping, setShipping] = useState("");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [notice, setNotice] = useState("");

  const loadOptions = async () => {
    setLoading(true); setNotice("");
    try {
      const [nextProducts, nextBundles, rulesByProduct] = await Promise.all([controlRequest<Product[]>("/products/all"), controlRequest<Bundle[]>("/bundles"), controlRequest<Record<string, PriceRule[]>>("/price-rule")]);
      const nextRules = rulesByProduct || {};
      const pricedProductIds = new Set(Object.entries(nextRules).flatMap(([productId, rules]) => rules?.length ? [Number(productId)] : []));
      setPriceRules(nextRules); setProducts((nextProducts || []).filter((product) => pricedProductIds.has(product.id))); setBundles(nextBundles || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Inicia sesión en Control de ventas para cargar productos y paquetes."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadOptions(); }, []);

  const priceFor = (line: ProductLine) => {
    const quantity = Number(line.quantity);
    if (!line.productId || !Number.isFinite(quantity) || quantity <= 0) return undefined;
    return [...(priceRules[line.productId] || [])]
      .filter((rule) => quantity >= Number(rule.minQuantity) && (rule.maxQuantity === null || quantity <= Number(rule.maxQuantity)))
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity))[0]?.pricePerUnit;
  };
  const productSubtotal = useMemo(() => productLines.reduce((total, line) => total + Number(line.quantity || 0) * Number(priceFor(line) || 0), 0), [productLines, priceRules]);
  const bundleSubtotal = useMemo(() => bundleLines.reduce((total, line) => total + Number(line.quantity || 0) * Number(bundles.find((item) => item.id === Number(line.bundleId))?.fixedPrice || 0), 0), [bundleLines, bundles]);
  const shippingValue = Math.max(0, Number(shipping || 0));
  const updateProduct = (index: number, change: Partial<ProductLine>) => setProductLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...change } : line));
  const updateBundle = (index: number, change: Partial<BundleLine>) => setBundleLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...change } : line));

  const createNote = async () => {
    const selectedProducts = productLines.filter((line) => line.productId || line.quantity);
    const selectedBundles = bundleLines.filter((line) => line.bundleId || line.quantity);
    if (!selectedProducts.length && !selectedBundles.length) return setNotice("Agrega al menos un producto o paquete.");
    if (selectedProducts.some((line) => !line.productId || Number(line.quantity) <= 0)) return setNotice("Completa el producto y la cantidad de cada renglón de calcetas.");
    if (selectedBundles.some((line) => !line.bundleId || Number(line.quantity) <= 0)) return setNotice("Completa el paquete y la cantidad de cada renglón.");
    setCalculating(true); setNotice("");
    try {
      const pricedLines = selectedProducts.map((line) => ({ ...line, unitPrice: priceFor(line) }));
      if (pricedLines.some((line) => line.unitPrice === undefined)) return setNotice("No existe una escala de precio para una de las cantidades capturadas. Revísala en Control de ventas > Precios.");
      const entries = ["🧾 NOTA DE COMPRA", ""];
      let calculatedProductSubtotal = 0;
      pricedLines.forEach((line) => {
        const product = products.find((item) => item.id === Number(line.productId));
        const lineTotal = Number(line.quantity) * Number(line.unitPrice); calculatedProductSubtotal += lineTotal;
        entries.push(`${product?.name || "Producto"} — ${line.quantity} pares`, `${line.quantity} × ${money(Number(line.unitPrice))} = ${money(lineTotal)}`, "");
      });
      let calculatedBundleSubtotal = 0;
      selectedBundles.forEach((line) => {
        const bundle = bundles.find((item) => item.id === Number(line.bundleId));
        const lineTotal = Number(line.quantity) * Number(bundle?.fixedPrice || 0); calculatedBundleSubtotal += lineTotal;
        entries.push(`${bundle?.name || "Paquete"} — ${line.quantity} paquete${Number(line.quantity) === 1 ? "" : "s"}`, `${line.quantity} × ${money(Number(bundle?.fixedPrice || 0))} = ${money(lineTotal)}`, "");
      });
      entries.push(`Envío: ${money(shippingValue)}`, `TOTAL: ${money(calculatedProductSubtotal + calculatedBundleSubtotal + shippingValue)}`);
      onUseNote(entries.join("\n"));
      setNotice("Nota creada en el mensaje. Puedes revisarla y enviarla cuando quieras.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible crear la nota."); }
    finally { setCalculating(false); }
  };

  return <details className="quote-note-generator">
    <summary>🧾 Generar nota final</summary>
    <p>Calcula el precio por par con tus escalas, suma paquetes y agrega el envío. La nota se coloca en el mensaje para que la revises antes de enviarla.</p>
    {notice && <div className="quote-note-notice">{notice}</div>}
    <section><header><b>Calcetas</b><button type="button" className="plain-button" onClick={() => setProductLines((current) => [...current, blankProduct()])}>＋ Producto</button></header>{productLines.map((line, index) => { const unitPrice = priceFor(line); const quantity = Number(line.quantity || 0); return <div className="quote-note-line" key={index}><select value={line.productId} onChange={(event) => updateProduct(index, { productId: event.target.value })} disabled={loading}><option value="">Selecciona Producto afectado</option>{products.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}</select><input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateProduct(index, { quantity: event.target.value })} placeholder="Pares" /><span>{unitPrice === undefined ? "Sin escala para esta cantidad" : `${money(unitPrice)} c/u · ${money(quantity * unitPrice)}`}</span><button type="button" className="danger-link" onClick={() => setProductLines((current) => current.length === 1 ? [blankProduct()] : current.filter((_, lineIndex) => lineIndex !== index))}>Quitar</button></div>; })}</section>
    <section><header><b>Paquetes emprendedores</b><button type="button" className="plain-button" onClick={() => setBundleLines((current) => [...current, blankBundle()])}>＋ Paquete</button></header>{bundleLines.map((line, index) => <div className="quote-note-line" key={index}><select value={line.bundleId} onChange={(event) => updateBundle(index, { bundleId: event.target.value })} disabled={loading}><option value="">Selecciona paquete</option>{bundles.map((bundle) => <option key={bundle.id} value={bundle.id}>{bundle.name} · {money(bundle.fixedPrice)}</option>)}</select><input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateBundle(index, { quantity: event.target.value })} placeholder="Cantidad" /><span>{line.bundleId ? money(Number(bundles.find((bundle) => bundle.id === Number(line.bundleId))?.fixedPrice || 0)) : "Precio configurado"}</span><button type="button" className="danger-link" onClick={() => setBundleLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Quitar</button></div>)}</section>
    <div className="quote-note-totals"><label>Envío<input type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} placeholder="$0.00" /></label><div><span>Subtotal calculado</span><b>{money(productSubtotal + bundleSubtotal + shippingValue)}</b></div><button type="button" onClick={() => void createNote()} disabled={disabled || calculating || loading}>{calculating ? "Calculando…" : "Crear nota"}</button></div>
  </details>;
}
