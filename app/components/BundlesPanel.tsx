"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { controlRequest } from "../lib/control-api";
import type { EntrepreneurPackage } from "../lib/types";
import { BundlePhotos, type PendingPhoto } from "./BundlePhotos";
import { BundlePriceRules } from "./BundlePriceRules";

type Product = {
  id: number;
  name: string;
  currentStock: number;
  minStockAlert: number;
  category?: { name?: string | null } | null;
  gender?: string | null;
};
type PriceQuote = { lines: { productId: number; quantity: number; groupQuantity: number; unitPrice: number; subtotal: number }[]; subtotal: number };
type BundleItem = { id?: number; productId: number; productName?: string; quantity: number; assignedUnitPrice: number };
type Bundle = { id?: number; name: string; fixedPrice: number; boxLengthCm?: number | null; boxWidthCm?: number | null; boxHeightCm?: number | null; boxWeightKg?: number | null; items: BundleItem[] };
type DraftItem = { id?: number; productId: string; quantity: string };
type FinancialReport = { totalOrderSale?: number; totalOrderProfit?: number; totalOrderTax?: number; totalIsr?: number };

const blankItem = (): DraftItem => ({ productId: "", quantity: "" });
const money = (value?: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
const productLabel = (product: Product) => `${product.name} - ${product.category?.name || "Sin categoría"} - ${product.gender || "Sin género"}`;

export function BundlesPanel({ products, packages, onCreateImageSet, onUploadImage }: {
  products: Product[];
  packages: EntrepreneurPackage[];
  onCreateImageSet: (name: string, category: string, bundleId: number) => Promise<EntrepreneurPackage>;
  onUploadImage: (packageId: string, file: File) => Promise<void>;
}) {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const imageSetId = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [boxLengthCm, setBoxLengthCm] = useState("");
  const [boxWidthCm, setBoxWidthCm] = useState("");
  const [boxHeightCm, setBoxHeightCm] = useState("");
  const [boxWeightKg, setBoxWeightKg] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [pricingResult, setPricingResult] = useState<{ key: string; quote?: PriceQuote; error?: string } | null>(null);
  const [reportResult, setReport] = useState<{ key: string; value: FinancialReport } | null>(null);
  const [pricingRevision, setPricingRevision] = useState(0);
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
  useEffect(() => {
    let active = true;
    void controlRequest<Bundle[]>("/bundles")
      .then(data => { if (active) setBundles(data); })
      .catch(error => { if (active) setNotice(error instanceof Error ? error.message : "No fue posible cargar los bundles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const completeItems = items.length > 0 && items.length <= 200 && items.every(item => Number.isSafeInteger(Number(item.productId)) && Number(item.productId) > 0 && Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0 && Number(item.quantity) <= 100000);
  const pricingKey = useMemo(() => JSON.stringify(items.map(item => ({ productId: Number(item.productId), quantity: Number(item.quantity) }))), [items]);
  const requestKey = `${pricingRevision}:${pricingKey}`;
  const report = reportResult?.key === requestKey ? reportResult.value : null;
  const quote = completeItems && pricingResult?.key === requestKey ? pricingResult.quote : undefined;
  const pricingError = completeItems && pricingResult?.key === requestKey ? pricingResult.error : undefined;
  const pricingPending = completeItems && pricingResult?.key !== requestKey;
  const fixedPrice = quote ? Number(quote.subtotal) : 0;
  const validItems = !!quote;
  useEffect(() => {
    if (!completeItems) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      void controlRequest<PriceQuote>("/bundles/price-quote", { method: "POST", body: pricingKey, signal: controller.signal })
        .then(data => {
          if (data?.subtotal == null || !Array.isArray(data?.lines) || !Number.isFinite(Number(data.subtotal)) || data.lines.some(line => line.unitPrice == null || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) || (JSON.parse(pricingKey) as { productId: number }[]).some(item => !data.lines.some(line => line.productId === item.productId))) throw new Error("La respuesta de precios no es válida.");
          if (active) setPricingResult({ key: requestKey, quote: data });
        })
        .catch(error => { if (active) setPricingResult({ key: requestKey, error: error instanceof Error ? error.message : "No fue posible consultar las reglas de precio." }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [pricingKey, requestKey, completeItems]);
  const changeItem = (index: number, change: Partial<DraftItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
    setReport(null);
  };
  const resetEditor = () => { setPricingRevision(value => value + 1); setPhotos([]); setUploadProgress(""); imageSetId.current = null; setEditingId(null); setName(""); setBoxLengthCm(""); setBoxWidthCm(""); setBoxHeightCm(""); setBoxWeightKg(""); setItems([blankItem()]); setReport(null); setNotice(""); };
  const editBundle = (bundle: Bundle) => {
    if (saveInFlight.current) return;
    if (photos.length && !window.confirm("¿Descartar las fotos pendientes y editar otro bundle?")) return;
    setPricingRevision(value => value + 1);
    setPhotos([]); setUploadProgress(""); imageSetId.current = null;
    setEditingId(bundle.id || null);
    setName(bundle.name);
    setBoxLengthCm(bundle.boxLengthCm == null ? "" : String(bundle.boxLengthCm));
    setBoxWidthCm(bundle.boxWidthCm == null ? "" : String(bundle.boxWidthCm));
    setBoxHeightCm(bundle.boxHeightCm == null ? "" : String(bundle.boxHeightCm));
    setBoxWeightKg(bundle.boxWeightKg == null ? "" : String(bundle.boxWeightKg));
    const nextItems = bundle.items.map((item) => ({ id: item.id, productId: String(item.productId), quantity: String(item.quantity) }));
    setItems(nextItems.length ? nextItems : [blankItem()]);
    setReport(null); setNotice("Al guardar se aplicarán las reglas vigentes a las cantidades de esta caja.");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saveInFlight.current) return;
    if (name.trim().length < 3) return setNotice("Escribe un nombre de al menos 3 caracteres.");
    if (!validItems) return setNotice("Completa los productos y cantidades y espera una cotización válida de las reglas de precio.");
    saveInFlight.current = true;
    setSaving(true); setNotice("");
    const payload = {
      name: name.trim(),
      boxLengthCm: boxLengthCm === "" ? null : Number(boxLengthCm),
      boxWidthCm: boxWidthCm === "" ? null : Number(boxWidthCm),
      boxHeightCm: boxHeightCm === "" ? null : Number(boxHeightCm),
      boxWeightKg: boxWeightKg === "" ? null : Number(boxWeightKg),
      items: items.map((item) => ({ ...(item.id ? { id: item.id } : {}), product: { id: Number(item.productId) }, quantity: Number(item.quantity) })),
    };
    try {
      const saved = await controlRequest<Bundle>(editingId ? `/bundles/${editingId}` : "/bundles", { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      // Keep the persisted ID and item IDs if an upload fails: retry must not create another bundle.
      const savedId = saved.id || editingId;
      if (!savedId) throw new Error("El servicio no devolvió el ID del bundle. Actualiza la lista antes de volver a guardar.");
      setEditingId(savedId);
      setItems(saved.items.map(item => ({ id: item.id, productId: String(item.productId), quantity: String(item.quantity) })));
      if (photos.length) {
        try {
          const existing = packages.find(group => group.controlBundleId === savedId);
          if (!imageSetId.current) imageSetId.current = existing?.id || (await onCreateImageSet(name.trim(), "Bundles", savedId)).id;
          for (const [index, photo] of photos.entries()) {
            setUploadProgress(`Subiendo foto ${index + 1} de ${photos.length}…`);
            await onUploadImage(imageSetId.current, photo.file);
            setPhotos(current => current.filter(item => item.id !== photo.id));
          }
        } catch (error) {
          await refresh();
          setNotice(`Bundle guardado, pero faltan fotografías por subir. ${error instanceof Error ? error.message : "Falló la carga."} Pulsa Guardar bundle para reintentar las pendientes.`);
          return;
        }
      }
      await refresh(); resetEditor(); setNotice(photos.length ? "Bundle y fotografías guardados." : editingId ? "Bundle actualizado." : "Bundle creado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el bundle."); }
    finally { setSaving(false); setUploadProgress(""); saveInFlight.current = false; }
  };
  const preview = async () => {
    if (!validItems) return setNotice("Completa los productos antes de calcular la ganancia.");
    setAnalyzing(true); setReport(null);
    try {
      const payload = items.map((item) => ({ product: { id: Number(item.productId) }, quantity: Number(item.quantity), assignedUnitPrice: Number(quote!.lines.find(line => line.productId === Number(item.productId))!.unitPrice) }));
      setReport({ key: requestKey, value: await controlRequest<FinancialReport>("/financial/calculate/bundle-profit", { method: "POST", body: JSON.stringify(payload) }) });
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible calcular la ganancia."); }
    finally { setAnalyzing(false); }
  };
  const deleteBundle = async (bundle: Bundle) => {
    if (saveInFlight.current) return;
    if (!bundle.id || !window.confirm(`¿Eliminar el bundle “${bundle.name}”?`)) return;
    try { await controlRequest<void>(`/bundles/${bundle.id}`, { method: "DELETE" }); await refresh(); setNotice("Bundle eliminado."); if (editingId === bundle.id) resetEditor(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el bundle."); }
  };

  return <section className="bundles-workspace">
    <header className="bundles-header"><div><p>BUNDLES</p><h2>Paquetes especiales</h2><span>Combina productos y calcula su precio automáticamente con tus reglas de mayoreo.</span></div><button type="button" className="plain-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar"}</button></header>
    {notice && <div className="control-notice">{notice}</div>}
    <div className="bundles-layout">
      <form className="bundle-editor" onSubmit={save}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
        <header><div><p>CONFIGURACIÓN</p><h3>{editingId ? "Editar bundle" : "Nuevo bundle"}</h3></div>{editingId && <button type="button" className="plain-button" onClick={resetEditor}>Cancelar edición</button>}</header>
        <label>Nombre del paquete<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Pack Mayorista Platinum" minLength={3} required /></label>
        <BundlePhotos key={editingId || "new"} groups={packages.filter(group => editingId !== null && group.controlBundleId === editingId)} pending={photos} onChange={setPhotos} disabled={saving} progress={uploadProgress} />
        <fieldset className="bundle-shipping-data"><legend>Medidas para cotizar envío</legend><small>Esta información aplica a cualquier caja de este bundle; no se repite por fotografía.</small><div><label>Largo (cm)<input type="number" min="0" step="0.1" value={boxLengthCm} onChange={(event) => setBoxLengthCm(event.target.value)} placeholder="Ej. 40" /></label><label>Ancho (cm)<input type="number" min="0" step="0.1" value={boxWidthCm} onChange={(event) => setBoxWidthCm(event.target.value)} placeholder="Ej. 30" /></label><label>Alto (cm)<input type="number" min="0" step="0.1" value={boxHeightCm} onChange={(event) => setBoxHeightCm(event.target.value)} placeholder="Ej. 25" /></label><label>Peso (kg)<input type="number" min="0" step="0.01" value={boxWeightKg} onChange={(event) => setBoxWeightKg(event.target.value)} placeholder="Ej. 8.5" /></label></div></fieldset>
        <div className="bundle-items-heading"><div><b>Productos en el paquete</b><small>Sumamos los pares de la misma categoría dentro de esta caja. Por ejemplo, 25 de caricatura dama + 25 de caballero aplican el rango de 50 pares a ambos productos.</small></div><button type="button" className="plain-button" onClick={() => { setItems((current) => [...current, blankItem()]); setReport(null); }}>＋ Agregar producto</button></div>
        <div className="bundle-items">{items.map((item, index) => {
          const line = quote?.lines.find(line => line.productId === Number(item.productId));
          const product = products.find(product => product.id === Number(item.productId));
          return <fieldset key={`${item.id || "new"}-${index}`}>
            <legend>Producto {index + 1}</legend>
            <label>Producto<select value={item.productId} onChange={event => changeItem(index, { productId: event.target.value })} required><option value="">Selecciona un producto</option>{products.map(product => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}</select></label>
            <label>Cantidad por caja<input type="number" min="1" max="100000" step="1" value={item.quantity} onChange={event => changeItem(index, { quantity: event.target.value })} required /></label>
            <label>Precio unitario automático<input readOnly value={line ? money(Number(line.unitPrice)) : pricingPending ? "Consultando…" : "Por calcular"} aria-label={`Precio automático del producto ${index + 1}`} /></label>
            <button type="button" className="danger-link" disabled={items.length === 1} onClick={() => { setItems(current => current.filter((_, itemIndex) => itemIndex !== index)); setReport(null); }}>Quitar</button>
            {line && <div className="bundle-rules-hint"><b>{line.groupQuantity} pares acumulados · {products.find(product => product.id === Number(item.productId))?.category?.name || "Solo este producto (sin categoría)"}</b><span>{item.quantity} × {money(Number(line.unitPrice))} = {money(Number(item.quantity) * Number(line.unitPrice))}</span></div>}
            {Number(item.productId) > 0 && <BundlePriceRules productId={Number(item.productId)} productName={product ? productLabel(product) : `Producto #${item.productId}`} revision={pricingRevision} applied={line} onRefresh={() => { setPricingRevision(value => value + 1); setReport(null); }} />}
          </fieldset>;
        })}</div>
        {pricingError && <div className="control-notice" role="alert">{pricingError} Revisa las reglas de precios de los productos del paquete. <button type="button" className="plain-button" onClick={() => { setPricingRevision(value => value + 1); setReport(null); }}>Reintentar cálculo</button></div>}
        <div className="bundle-summary"><span>Precio final de venta</span><b aria-live="polite">{quote ? money(fixedPrice) : pricingPending ? "Calculando…" : "Por calcular"}</b><small>{!completeItems ? "Completa todos los productos y sus cantidades." : "Total de una caja. Los precios se verifican nuevamente al guardar."}</small></div>
        {report && <div className="bundle-financial-report"><b>Ganancia estimada</b><span>Venta: {money(report.totalOrderSale)}</span><span>IVA neto: {money(report.totalOrderTax)}</span><span>ISR estimado: {money(report.totalIsr)}</span><strong className={(report.totalOrderProfit || 0) <= 0 ? "negative" : ""}>Ganancia neta: {money(report.totalOrderProfit)}</strong></div>}
        <div className="bundle-editor-actions"><button type="button" className="plain-button" onClick={() => void preview()} disabled={analyzing || !validItems}>{analyzing ? "Analizando…" : "Ver ganancia estimada"}</button><button disabled={saving || !products.length || !validItems}>{saving ? "Guardando…" : "Guardar bundle"}</button></div>
        </fieldset>
      </form>
      <section className="bundle-list"><header><div><p>CATÁLOGO</p><h3>Bundles guardados</h3></div><b>{bundles.length}</b></header>{!loading && bundles.length === 0 && <div className="bundles-empty">Aún no hay paquetes. Crea tu primer bundle.</div>}{bundles.map((bundle) => <article key={bundle.id}><header><div><small>Bundle #{bundle.id}</small><h3>{bundle.name}</h3></div><strong>{money(bundle.fixedPrice)}</strong></header>{[bundle.boxLengthCm, bundle.boxWidthCm, bundle.boxHeightCm, bundle.boxWeightKg].some((value) => value != null) && <p className="bundle-shipping-summary">Caja: {[bundle.boxLengthCm, bundle.boxWidthCm, bundle.boxHeightCm].every((value) => value != null) ? `${bundle.boxLengthCm} × ${bundle.boxWidthCm} × ${bundle.boxHeightCm} cm` : "medidas incompletas"}{bundle.boxWeightKg != null ? ` · ${bundle.boxWeightKg} kg` : ""}</p>}<ul>{bundle.items.map((item) => <li key={item.id || `${item.productId}-${item.quantity}`}><span>{item.quantity}× {item.productName || `Producto #${item.productId}`}</span><b>{money(item.assignedUnitPrice)} c/u</b></li>)}</ul><footer><span>{bundle.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} piezas · {bundle.items.length} productos</span><div><button type="button" className="plain-button" onClick={() => editBundle(bundle)}>Editar</button><button type="button" className="danger-link" onClick={() => void deleteBundle(bundle)}>Eliminar</button></div></footer></article>)}</section>
    </div>
  </section>;
}
