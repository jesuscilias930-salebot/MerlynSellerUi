"use client";

import { useEffect, useMemo, useState } from "react";
import { controlRequest } from "../lib/control-api";
import { request } from "../lib/api";
import type { Chat } from "../lib/types";

type Product = { id: number; name: string; currentStock: number; category?: { name?: string | null } | null; gender?: string | null };
type Bundle = { id: number; name: string; fixedPrice: number; items: { productId: number; quantity: number }[] };
type SaleSummary = { id: number; grandTotal?: number | null; subtotal?: number | null; saleItemDtoList?: unknown[]; customer?: { externalId?: string | null; name?: string | null } | null };
type Line = { id: string; kind: "product" | "bundle"; itemId: string; quantity: string };
const blankLine = (kind: Line["kind"] = "product"): Line => ({ id: crypto.randomUUID(), kind, itemId: "", quantity: "1" });
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));

export function ChatSaleModal({ chat, onClose, onSaved }: { chat: Chat; onClose: () => void; onSaved: () => Promise<void> }) {
  const [products, setProducts] = useState<Product[]>([]); const [bundles, setBundles] = useState<Bundle[]>([]); const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [history, setHistory] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  useEffect(() => { void Promise.all([controlRequest<Product[]>("/products/all"), controlRequest<Bundle[]>("/bundles"), controlRequest<{ content: SaleSummary[] }>("/sales?page=0&size=100")]).then(([nextProducts, nextBundles, sales]) => { setProducts(nextProducts); setBundles(nextBundles); setHistory((sales.content || []).filter((sale) => sale.customer?.externalId === chat.id)); }).catch((error) => setNotice(error instanceof Error ? error.message : "Inicia sesión en Control de ventas para registrar una venta.")).finally(() => setLoading(false)); }, [chat.id]);
  const update = (id: string, change: Partial<Line>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...change } : line));
  const total = useMemo(() => lines.reduce((sum, line) => { const item = line.kind === "product" ? products.find((product) => product.id === Number(line.itemId)) : bundles.find((bundle) => bundle.id === Number(line.itemId)); return sum + Number(line.quantity || 0) * Number(line.kind === "bundle" ? (item as Bundle | undefined)?.fixedPrice || 0 : 0); }, 0), [lines, products, bundles]);
  const save = async () => {
    const filled = lines.filter((line) => line.itemId);
    if (!filled.length || filled.some((line) => Number(line.quantity) <= 0)) return setNotice("Selecciona cada artículo y captura una cantidad válida.");
    setSaving(true); setNotice("");
    try {
      const sale = await controlRequest<SaleSummary>("/sales", { method: "POST", body: JSON.stringify({ customerExternalId: chat.id, customerName: chat.name || chat.phone_number, customerPhone: chat.phone_number, productsSold: filled.filter((line) => line.kind === "product").map((line) => ({ productId: Number(line.itemId), quantity: Number(line.quantity) })), bundlesSold: filled.filter((line) => line.kind === "bundle").map((line) => ({ bundleId: Number(line.itemId), quantity: Number(line.quantity) })) }) });
      // Recording the sale must never depend on an advertising provider. The
      // conversion report is a best-effort, idempotent notification afterwards.
      const value = Number(sale.grandTotal ?? sale.subtotal ?? 0);
      if (sale.id && value > 0) {
        try {
          await request(`/conversations/${chat.id}/meta/purchase`, {
            method: "POST",
            body: JSON.stringify({ saleId: sale.id, value, currency: "MXN", itemCount: filled.reduce((sum, line) => sum + Number(line.quantity || 0), 0) }),
          });
        } catch (reportError) {
          setNotice(reportError instanceof Error ? `La venta se registró, pero Meta no recibió la conversión: ${reportError.message}` : "La venta se registró, pero Meta no recibió la conversión.");
        }
      }
      await onSaved(); onClose();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible registrar la venta."); }
    finally { setSaving(false); }
  };
  return <div className="chat-sale-backdrop" role="presentation" onMouseDown={onClose}><section className="chat-sale-modal" role="dialog" aria-modal="true" aria-label="Registrar venta" onMouseDown={(event) => event.stopPropagation()}><header><div><p>VENTA DEL CHAT</p><h2>Registrar venta</h2><span>{chat.name || chat.phone_number} · {chat.phone_number}</span></div><button type="button" onClick={onClose}>×</button></header>{!loading && <p className="chat-sale-history">{history.length ? `${history.length} venta${history.length === 1 ? "" : "s"} registrada${history.length === 1 ? "" : "s"} para este chat. Última: #${history[0].id}.` : "Aún no hay ventas registradas para este chat."}</p>}{notice && <p className="tool-notice">{notice}</p>}{loading ? <p>Cargando inventario…</p> : <><div className="sale-lines">{lines.map((line) => <div key={line.id}><select value={line.kind} onChange={(event) => update(line.id, { kind: event.target.value as Line["kind"], itemId: "" })}><option value="product">Producto</option><option value="bundle">Bundle</option></select><select value={line.itemId} onChange={(event) => update(line.id, { itemId: event.target.value })}><option value="">Selecciona {line.kind === "product" ? "producto" : "bundle"}</option>{line.kind === "product" ? products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.currentStock} disponibles</option>) : bundles.map((bundle) => <option key={bundle.id} value={bundle.id}>{bundle.name} · {money(bundle.fixedPrice)}</option>)}</select><input type="number" min="1" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} /><button type="button" className="danger-link" onClick={() => setLines((current) => current.length === 1 ? [blankLine()] : current.filter((item) => item.id !== line.id))}>×</button></div>)}</div><div className="chat-sale-actions"><button type="button" className="plain-button" onClick={() => setLines((current) => [...current, blankLine()])}>＋ Producto</button><button type="button" className="plain-button" onClick={() => setLines((current) => [...current, blankLine("bundle")])}>＋ Bundle</button></div><p className="chat-sale-hint">El precio final de productos se calcula por sus reglas de precio. Los bundles descuentan automáticamente todos sus componentes con FIFO.</p><footer><span>{total ? `Bundles seleccionados: ${money(total)}` : ""}</span><button type="button" className="plain-button" onClick={onClose}>Cancelar</button><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Confirmar venta"}</button></footer></>}</section></div>;
}
