"use client";

import { useEffect, useRef, useState } from "react";
import { controlApi, controlRequest, controlSession } from "../lib/control-api";
import { emptyBoardPages, fulfillmentLabel, orderBoardPath, orderDateError, orderDateLabel, orderMoney, orderStages, paymentLabel, type BoardPages, type OrderCard, type OrderDates, type OrdersBoard } from "../lib/order-board";
import { OrderDetailsModal } from "./OrderDetailsModal";
import styles from "./OrdersBoard.module.css";

const message = (error: unknown) => error instanceof Error ? error.message : "No se pudieron cargar los pedidos.";

export function PendingOrdersPanel({ onOpenShipping }: { onOpenShipping: () => void }) {
  const [pages, setPages] = useState<BoardPages>(emptyBoardPages);
  const [dates, setDates] = useState<OrderDates>({ startDate: "", endDate: "" });
  const [draftDates, setDraftDates] = useState<OrderDates>(dates);
  const [filterError, setFilterError] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ path: string; key: string; data?: OrdersBoard; error?: string }>();
  const [selected, setSelected] = useState<OrderCard | null>(null);
  const [connection, setConnection] = useState("Conectando…");
  const boardRef = useRef<HTMLDivElement>(null);
  const path = orderBoardPath(dates, pages), key = `${path}:${revision}`;
  const current = result?.path === path ? result : undefined;
  const busy = current?.key !== key;
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!controlSession.get()) throw new Error("Inicia sesión en Control de ventas para consultar los pedidos.");
      return controlRequest<OrdersBoard>(path, { signal: controller.signal, cache: "no-store" });
    };
    load().then(data => { if (!controller.signal.aborted) setResult({ path, key, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ path, key, data: previous?.path === path ? previous.data : undefined, error: message(error) })); });
    return () => controller.abort();
  }, [path, key]);

  useEffect(() => {
    let stopped = false, socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined, refresh: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000, lastActivity = Date.now();
    const connect = () => {
      if (stopped) return;
      const token = controlSession.get();
      if (!token) { setConnection("Sin sesión de Control de ventas"); return; }
      try {
        const url = new URL(controlApi);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/pending-orders`;
        url.search = ""; url.hash = "";
        const currentSocket = new WebSocket(url); socket = currentSocket; lastActivity = Date.now();
        currentSocket.onopen = () => { if (!stopped) currentSocket.send(`auth ${token}`); };
        currentSocket.onmessage = event => {
          if (stopped) return;
          lastActivity = Date.now();
          let type: string; try { type = JSON.parse(event.data).type; } catch { return; }
          if (type === "ready") { delay = 1000; setConnection("En vivo"); setRevision(value => value + 1); }
          if (type === "orders.changed") { clearTimeout(refresh); refresh = setTimeout(() => setRevision(value => value + 1), 250); }
        };
        currentSocket.onerror = () => currentSocket.close();
        currentSocket.onclose = () => { if (stopped) return; setConnection("Reconectando · respaldo cada 30 s"); retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000); };
      } catch { setConnection("Revisa la conexión de Control de ventas"); }
    };
    void Promise.resolve().then(connect);
    const reconcile = setInterval(() => { if (controlSession.get() && document.visibilityState === "visible") setRevision(value => value + 1); }, 30000);
    const watchdog = setInterval(() => { if (socket && Date.now() - lastActivity > 45000) socket.close(); }, 5000);
    return () => { stopped = true; clearTimeout(retry); clearTimeout(refresh); clearInterval(reconcile); clearInterval(watchdog); socket?.close(); };
  }, []);

  function changed() { setPages(emptyBoardPages()); setRevision(value => value + 1); }
  return <div className="orders-workspace"><section className={styles.workspace} aria-label="Pedidos de E-commerce">
    <header className={styles.header}><div><small>E-COMMERCE</small><h2>Pedidos <span>{current?.data?.totalElements ?? "—"}</span></h2><p>Organiza cada pedido desde que llega hasta que lo entregas a paquetería.</p></div>
      <div className={styles.connection}><small role="status">{connection}</small><button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
    </header>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); const selectedDates = { startDate: String(values.get("startDate") || ""), endDate: String(values.get("endDate") || "") }; const error = orderDateError(selectedDates); setDraftDates(selectedDates); setFilterError(error); if (!error) { setDates(selectedDates); setPages(emptyBoardPages()); setRevision(value => value + 1); } }}>
      <div><strong>Fecha del pedido</strong><small>Zona horaria: Ciudad de México</small></div>
      <label>Desde<input name="startDate" type="date" min="1900-01-01" max="9998-12-31" value={draftDates.startDate} onChange={event => setDraftDates(value => ({ ...value, startDate: event.target.value }))}/></label>
      <label>Hasta<input name="endDate" type="date" min="1900-01-01" max="9998-12-31" value={draftDates.endDate} onChange={event => setDraftDates(value => ({ ...value, endDate: event.target.value }))}/></label>
      <button className={styles.primary} type="submit">Filtrar</button>
      <button type="button" onClick={() => { const empty = { startDate: "", endDate: "" }; setDraftDates(empty); setDates(empty); setFilterError(""); setPages(emptyBoardPages()); }}>Ver todos</button>
    </form>
    {filterError && <p role="alert" className={styles.error}>{filterError}</p>}
    {current?.error && <div className={styles.error} role="alert"><span>{current.error}{current.data && " Se muestran los últimos datos cargados."}</span><button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
    <div className={styles.boardHeading}><p role="status">{busy ? "Actualizando pedidos…" : dates.startDate || dates.endDate ? "Pedidos dentro del periodo seleccionado · ambos días incluidos" : "Todos los pedidos · más recientes primero"}</p><small>El pago y el seguimiento se muestran por separado.</small></div>
    <nav className={styles.stageNav} aria-label="Ir a una columna de pedidos">{orderStages.map(stage => <button type="button" key={stage.key} onClick={() => { const column = boardRef.current?.querySelector<HTMLElement>(`[data-stage="${stage.key}"]`); column?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "start" }); }}>{stage.label}<span>{current?.data?.columns.find(column => column.stage === stage.key)?.totalElements ?? "—"}</span></button>)}</nav>
    <div className={styles.board} ref={boardRef} aria-busy={busy}>
      {orderStages.map((stage, index) => {
        const column = current?.data?.columns.find(column => column.stage === stage.key);
        return <section className={styles.column} data-stage={stage.key} key={stage.key} aria-labelledby={`orders-${stage.key}`}>
          <header className={styles.columnHeading}><div><span className={styles.step}>{index + 1}</span><h3 id={`orders-${stage.key}`}>{stage.label}</h3><b>{column?.totalElements ?? "—"}</b></div><p>{stage.hint}</p></header>
          <div className={styles.cards}>
            {!column && <p className={styles.empty}>{current?.error ? "No se pudo consultar esta columna." : "Cargando…"}</p>}
            {column?.totalElements === 0 && <div className={styles.empty}><span aria-hidden="true">○</span><p>Sin pedidos en {stage.label.toLowerCase()}</p><small>{dates.startDate || dates.endDate ? "Prueba otro periodo." : "Los pedidos aparecerán aquí al avanzar."}</small></div>}
            {column?.content.map(order => <button type="button" key={order.id} className={styles.card} aria-label={`Ver pedido ${order.folio} de ${order.customerName || "invitado"}`} onClick={() => setSelected(order)}>
              <div className={styles.cardTop}><span title={order.folio}>#{order.id.slice(0, 8).toUpperCase()}</span><time dateTime={order.createdAt}>{orderDateLabel(order.createdAt)}</time></div>
              <strong className={styles.customer}>{order.customerName || "Compra como invitado"}</strong>
              <div className={styles.badges}><span className={order.status === "PAID" ? styles.paid : styles.badge}>{paymentLabel(order.status)}</span>
                {(stage.key === "PENDING" || order.fulfillmentStatus === "DELIVERED") && <span className={styles.badge}>{fulfillmentLabel(order.fulfillmentStatus)}</span>}</div>
              {order.inventoryIssue && <p className={styles.issue}>Requiere atención de inventario</p>}
              {order.trackingNumber && <p className={styles.tracking}>Guía: {order.trackingNumber}<small>{order.dispatchCarrier}</small></p>}
              <div className={styles.cardBottom}><b>{orderMoney(Number(order.total))}</b><span>Ver detalle ↗</span></div>
            </button>)}
          </div>
          {!!column?.totalElements && <footer className={styles.pagination}><button type="button" aria-label={`Página anterior de ${stage.label}`} disabled={busy || column.page === 0} onClick={() => setPages(value => ({ ...value, [stage.key]: column.page - 1 }))}>‹</button><span>{column.page + 1} / {Math.max(1, column.totalPages)}</span><button type="button" aria-label={`Página siguiente de ${stage.label}`} disabled={busy || column.page + 1 >= column.totalPages} onClick={() => setPages(value => ({ ...value, [stage.key]: column.page + 1 }))}>›</button></footer>}
        </section>;
      })}
    </div>
    <p className={styles.footnote}>Los pedidos nuevos llegan a Pendiente. Cancelaciones, pruebas y pedidos con incidencias conservan su indicador para que puedas revisarlos.</p>
    {selected && <OrderDetailsModal key={selected.id} card={selected} revision={revision} onClose={() => setSelected(null)} onUpdated={changed} onOpenShipping={onOpenShipping}/>}</section></div>;
}
