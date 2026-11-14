"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { api, request } from "../lib/api";
import { filterFamilies, itemStatus, previewCaption, type ProductFamily } from "../lib/product-stock";
import type { ScenarioProductImage } from "../lib/types";

// Catálogo compartido entre el chat y el editor de escenarios (las existencias cambian poco en un minuto).
let cache: { at: number; data: ProductFamily[] } | null = null;
const FRESH_MS = 45_000;

export function useProductCatalog() {
  const [families, setFamilies] = useState<ProductFamily[] | null>(() => cache?.data || null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const fresh = cache && Date.now() - cache.at < FRESH_MS && !revision ? cache.data : null;
    void Promise.resolve().then(async () => {
      if (fresh) { if (active) setFamilies(fresh); return; }
      if (active) setError("");
      try {
        const data = await request<ProductFamily[]>("/product-stock/catalog");
        cache = { at: Date.now(), data: Array.isArray(data) ? data : [] };
        if (active) setFamilies(cache.data);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el inventario."); }
    });
    return () => { active = false; };
  }, [revision]);
  const findFamily = (productId: number) => families?.find(family => family.productIds.includes(productId));
  return { families, error, reload: () => setRevision(value => value + 1), findFamily };
}

async function uploadImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Selecciona una imagen JPEG, PNG o WebP.");
  const response = await fetch(`${api}/scenarios/evidence/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "X-Upload-Filename": encodeURIComponent(file.name) }, body: file });
  const uploaded = (await response.json().catch(() => ({}))) as { error?: string; mediaId?: string };
  if (!response.ok || !uploaded.mediaId) throw new Error(uploaded.error || "No fue posible subir la imagen.");
  return uploaded.mediaId;
}

/** Lista para elegir productos: foto, nombre y tallas disponibles. */
export function ProductStockPicker({ families, error, onReload, chosen, onPick }: { families: ProductFamily[] | null; error: string; onReload: () => void; chosen: number[]; onPick: (family: ProductFamily) => void }) {
  const [query, setQuery] = useState("");
  const [showSoldOut, setShowSoldOut] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const visible = useMemo(() => families ? filterFamilies(families, query, !showSoldOut).slice(0, 60) : [], [families, query, showSoldOut]);
  return <div className="product-stock-picker">
    <div className="product-stock-search">
      <input ref={input} type="search" value={query} placeholder="Busca el producto: nombre, color, talla…" aria-label="Buscar producto" onChange={event => setQuery(event.target.value)} />
      <label><input type="checkbox" checked={showSoldOut} onChange={event => setShowSoldOut(event.target.checked)} /> Ver agotados</label>
    </div>
    {error && <p className="product-stock-error" role="alert">{error} <button type="button" onClick={onReload}>Reintentar</button></p>}
    {!families && !error && <p className="product-stock-muted" role="status">Cargando productos…</p>}
    {families && !visible.length && <p className="product-stock-muted">No hay productos que coincidan.</p>}
    <ul>{visible.map(family => {
      const picked = family.productIds.some(id => chosen.includes(id));
      return <li key={family.productId}><button type="button" aria-pressed={picked} onClick={() => onPick(family)}>
        {family.photos[0] ? <img src={family.photos[0].url} alt="" loading="lazy" /> : <span className="product-stock-nophoto" aria-hidden="true">👕</span>}
        <span><b>{family.title}</b><small>{family.sizes.length ? family.sizes.filter(Boolean).join(" · ") || "Disponible" : "Agotado"}{family.photos.length ? "" : " · Sin foto en el E-commerce"}</small></span>
        <em>{picked ? "✓ Agregado" : "Agregar"}</em>
      </button></li>;
    })}</ul>
  </div>;
}

/** Un producto elegido: imagen (E-commerce o propia), mensaje opcional y vista previa del texto. */
export function ProductImageItem({ item, family, onChange, onRemove }: { item: ScenarioProductImage; family: ProductFamily | undefined; onChange: (item: ScenarioProductImage) => void; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const status = itemStatus(family, Boolean(item.mediaId));
  const caption = previewCaption(item.caption, family);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try { onChange({ ...item, mediaId: await uploadImage(file) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible subir la imagen."); }
    finally { setUploading(false); }
  };
  return <article className={`product-stock-item ${status}`}>
    {item.mediaId ? <span className="product-stock-own" aria-label="Imagen propia">IMG</span> : family?.photos[0] ? <img src={family.photos[0].url} alt="" /> : <span className="product-stock-nophoto" aria-hidden="true">👕</span>}
    <div>
      <strong>{family?.title || item.label || `Producto #${item.productId}`}</strong>
      <div className="product-stock-source">
        <span>{item.mediaId ? "Imagen propia" : "Foto del E-commerce"}</span>
        <label className={uploading ? "busy" : ""}>{uploading ? "Subiendo…" : item.mediaId ? "Cambiar imagen" : "Usar otra imagen"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload} /></label>
        {item.mediaId && <button type="button" onClick={() => onChange({ ...item, mediaId: undefined })}>Usar foto del E-commerce</button>}
      </div>
      <textarea rows={2} maxLength={800} value={item.caption || ""} placeholder="Mensaje antes de las tallas (opcional)" aria-label={`Mensaje para ${family?.title || "el producto"}`} onChange={event => onChange({ ...item, caption: event.target.value || undefined })} />
      {caption ? <p className="product-stock-preview">{caption}</p> : null}
      {status === "soldOut" && <p className="product-stock-warn">Agotado por ahora: no se envía hasta que vuelva a haber existencias.</p>}
      {status === "noPhoto" && <p className="product-stock-warn">Este producto no tiene foto en el E-commerce. Sube una imagen para enviarlo.</p>}
      {status === "missing" && family === undefined && <p className="product-stock-warn">No se encontró el producto en el inventario actual.</p>}
      {error && <p className="product-stock-warn" role="alert">{error}</p>}
    </div>
    <button type="button" className="danger-link" onClick={onRemove}>Quitar</button>
  </article>;
}

/** Editor del paso «Enviar imágenes»: productos con sus tallas disponibles al momento de enviar. */
export function ScenarioProductImages({ value, onChange }: { value: ScenarioProductImage[]; onChange: (value: ScenarioProductImage[]) => void }) {
  const catalog = useProductCatalog();
  const [picking, setPicking] = useState(false);
  const pick = (family: ProductFamily) => {
    if (value.some(item => family.productIds.includes(item.productId))) onChange(value.filter(item => !family.productIds.includes(item.productId)));
    else onChange([...value, { productId: family.productId, label: family.title }]);
  };
  return <div className="product-stock-section">
    <div className="product-stock-head"><strong>Productos con tallas</strong><button type="button" onClick={() => setPicking(current => !current)}>{picking ? "Listo" : "＋ Agregar producto"}</button></div>
    <small>Cada imagen se envía con «Tallas disponibles: …» según el inventario del momento. Las tallas agotadas no aparecen y si todo está agotado la imagen no se envía.</small>
    {picking && <ProductStockPicker families={catalog.families} error={catalog.error} onReload={catalog.reload} chosen={value.map(item => item.productId)} onPick={pick} />}
    {value.map((item, index) => <ProductImageItem key={`${item.productId}-${index}`} item={item} family={catalog.findFamily(item.productId)}
      onChange={next => onChange(value.map((current, position) => position === index ? next : current))}
      onRemove={() => onChange(value.filter((_, position) => position !== index))} />)}
  </div>;
}

/** Herramienta del chat: elige productos y envía sus imágenes con las tallas disponibles. */
export function ProductStockSender({ chatId, disabled }: { chatId: string | undefined; disabled?: boolean }) {
  const catalog = useProductCatalog();
  const [items, setItems] = useState<ScenarioProductImage[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const pick = (family: ProductFamily) => setItems(current => current.some(item => family.productIds.includes(item.productId)) ? current.filter(item => !family.productIds.includes(item.productId)) : [...current, { productId: family.productId, label: family.title }]);
  const ready = items.filter(item => itemStatus(catalog.findFamily(item.productId), Boolean(item.mediaId)) === "ready");
  const send = async () => {
    if (!chatId || !ready.length) return;
    setSending(true); setNotice("");
    try {
      const result = await request<{ queued: number; skipped: string[] }>(`/conversations/${chatId}/messages/product-images`, { method: "POST", body: JSON.stringify({ products: ready.map(({ productId, mediaId, caption }) => ({ productId, ...(mediaId ? { mediaId } : {}), ...(caption?.trim() ? { caption } : {}) })) }) });
      setNotice(`${result.queued} ${result.queued === 1 ? "imagen enviada" : "imágenes enviadas"}${result.skipped.length ? ` · Omitidas: ${result.skipped.join("; ")}` : ""}.`);
      // Quedan los que no se enviaron (sin foto o agotados) para que se puedan corregir.
      if (result.queued) setItems(current => current.filter(item => !ready.includes(item)));
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se pudieron enviar las imágenes."); }
    finally { setSending(false); }
  };
  return <div className="product-stock-section">
    <ProductStockPicker families={catalog.families} error={catalog.error} onReload={catalog.reload} chosen={items.map(item => item.productId)} onPick={pick} />
    {items.map((item, index) => <ProductImageItem key={`${item.productId}-${index}`} item={item} family={catalog.findFamily(item.productId)}
      onChange={next => setItems(current => current.map((value, position) => position === index ? next : value))}
      onRemove={() => setItems(current => current.filter((_, position) => position !== index))} />)}
    {notice && <p className="product-stock-muted" role="status">{notice}</p>}
    {items.length > 0 && <button type="button" className="product-stock-send" disabled={disabled || sending || !ready.length} onClick={() => void send()}>{sending ? "Enviando…" : `Enviar ${ready.length} ${ready.length === 1 ? "imagen" : "imágenes"}`}</button>}
  </div>;
}
