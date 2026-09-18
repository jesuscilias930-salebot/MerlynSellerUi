"use client";

import { useEffect, useState } from "react";
import { controlRequest } from "../lib/control-api";
import styles from "./StoreOrdersPanel.module.css";

type Order = {
  id: string; folio: string; customerName: string; customerPhone: string;
  status: string; saleId: number | null; subtotal: number;
  lines: { kind: string; itemId: number; name: string; quantity: number; unitPrice: number; contents?: string }[];
};
type OrdersPage = { content: Order[]; totalElements: number; totalPages: number };
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function StoreOrdersPanel() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<OrdersPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true); setError(""); setData(null);
    controlRequest<OrdersPage>(`/store/orders?page=${page}&size=10`)
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [page, revision]);

  return <section className={styles.panel} aria-label="Pedidos de la tienda" aria-busy={busy}>
    <header className={styles.header}>
      <div><h2>Pedidos de la tienda {data && <small>({data.totalElements})</small>}</h2>
        <p>Solicitudes de compra del ecommerce. Un pedido pendiente no es una venta pagada.</p></div>
      <button type="button" disabled={busy} onClick={() => { setPage(0); setRevision(r => r + 1); }}>Actualizar pedidos</button>
    </header>
    {busy && <p role="status">Cargando pedidos…</p>}
    {error && <p role="alert">{error} Usa «Actualizar pedidos» para reintentar.</p>}
    {data && !data.content.length && <p>No hay pedidos de la tienda para mostrar.</p>}
    {data?.content.map(order => <details className={styles.order} key={order.id}>
      <summary>
        <span><strong>{order.customerName}</strong><small className={styles.folio}>{order.folio}</small></span>
        <span className={styles.badge}>{order.status === "PENDING" ? "Pendiente de confirmación" : order.status === "CONFIRMED" ? "Convertido en venta" : order.status}</span>
        <strong>{money(Number(order.subtotal))}</strong>
        <span>Ver desglose</span>
      </summary>
      <div className={styles.details}>
        <p>WhatsApp del cliente: {order.customerPhone}</p>
        {order.saleId != null && <p>Venta relacionada: #{order.saleId}</p>}
        {order.lines.map((line, index) => <div className={styles.line} key={`${line.kind}-${line.itemId}-${index}`}>
          <div><strong>{line.name}</strong><small>{line.quantity} × {money(Number(line.unitPrice))}{line.kind === "BUNDLE" ? " por caja" : " por unidad"}</small>
            {line.contents && <p>Contenido por caja: {line.contents}</p>}</div>
          <strong>{money(line.quantity * Number(line.unitPrice))}</strong>
        </div>)}
        <p><strong>Subtotal del pedido: {money(Number(order.subtotal))} MXN</strong></p>
        <small>El envío se acuerda por separado. Este listado no confirma pagos ni modifica inventario.</small>
      </div>
    </details>)}
    <footer className={styles.header}>
      <button type="button" disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
      <span>Página {page + 1}{data ? ` de ${Math.max(1, data.totalPages)}` : ""}</span>
      <button type="button" disabled={busy || !data || page + 1 >= data.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
    </footer>
  </section>;
}
