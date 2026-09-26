"use client";

import { useEffect, useState } from "react";
import { OrderOperations, type OperationalOrder } from "./OrderOperations";
import { controlApi, controlRequest, controlSession } from "../lib/control-api";
import styles from "./StoreOrdersPanel.module.css";
import { shippingDraftKey, type ShippingDraft } from "../lib/shipping-draft";

type Order = OperationalOrder & { id: string; folio: string; customerName: string; status: string; subtotal: number; createdAt: string;
  shippingAmount?:number|null;shippingCarrier?:string;shippingService?:string;shippingEnvironment?:string;total?:number;
  shippingAddress?: {recipient:string;phone:string;email:string;country:string;postalCode:string;state:string;city:string;district:string;street:string;exteriorNumber:string;interiorNumber?:string;references?:string}|null;
  lines: { kind: string; itemId: number; name: string; quantity: number; unitPrice: number; contents?: string }[] };
type Page = { content: Order[]; totalElements: number; totalPages: number };
const money = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const paymentLabels: Record<string,string> = { PAID: "Pagado", PENDING: "Pendiente de pago", PAYMENT_PENDING: "Esperando confirmación de Stripe", PAID_TEST: "Pagado · Prueba Stripe", PAYMENT_FAILED: "Pago fallido", PAYMENT_EXPIRED: "Sesión de pago expirada" };

export function PendingOrdersPanel({ onOpenShipping }: { onOpenShipping: () => void }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Page>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Conectando…");
  const [preparingOrder, setPreparingOrder] = useState<string | null>(null);
  const prepareShipping = async (order: Order) => {
    if (preparingOrder) return;
    setPreparingOrder(order.id); setError("");
    try {
      const result = await controlRequest<{orderId:string;folio:string;destination:NonNullable<Order["shippingAddress"]>;lines:Order["lines"];parcel:{pairs:number;weightKg:number;lengthCm:number;widthCm:number;heightCm:number;declaredValue:number}}>(`/pending-orders/${encodeURIComponent(order.id)}/shipping-draft`, { cache: "no-store" });
      const a=result.destination,p=result.parcel;
      if (!a || !p || [p.weightKg,p.lengthCm,p.widthCm,p.heightCm].some(n => !Number.isFinite(Number(n)) || Number(n)<=0)) throw new Error("El pedido no tiene un paquete válido. Revisa pesos y empaques.");
      const draft: ShippingDraft = { source:"order", orderId:result.orderId,orderFolio:result.folio,orderLines:result.lines.map(l=>({name:l.name,quantity:l.quantity})),pairs:p.pairs,
        destination:{name:a.recipient,phone:a.phone,email:a.email,street:a.street,number:a.exteriorNumber,interiorNumber:a.interiorNumber,references:a.references,city:a.city,state:a.state,country:a.country,postalCode:a.postalCode,district:a.district},
        package:{type:"box",content:`Calcetines · ${p.pairs} pares`,amount:1,declaredValue:Number(p.declaredValue),weight:Number(p.weightKg),dimensions:{length:Number(p.lengthCm),width:Number(p.widthCm),height:Number(p.heightCm)}} };
      sessionStorage.setItem(shippingDraftKey,JSON.stringify(draft));
      onOpenShipping();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo preparar el envío del pedido."); }
    finally { setPreparingOrder(null); }
  };

  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
    await Promise.resolve();
    if (abort.signal.aborted) return;
    if (!controlSession.get()) { setError("Inicia sesión en Control de ventas para consultar los pedidos."); return; }
    setBusy(true);
    controlRequest<Page>(`/pending-orders?page=${page}&size=20`, { signal: abort.signal, cache: "no-store" })
      .then(result => { if (!abort.signal.aborted) { setData(result); setError(""); } })
      .catch(() => { if (!abort.signal.aborted) setError("No se pudieron cargar los pedidos. Verifica tu sesión de Control de ventas y la conexión al servicio."); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    };
    void load();
    return () => abort.abort();
  }, [page, revision]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let lastActivity = Date.now();
    const connect = () => {
      if (stopped) return;
      const token = controlSession.get();
      if (!token) { setConnection("Sin sesión de Control de ventas"); return; }
      try {
        const url = new URL(controlApi);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/pending-orders`;
        url.search = ""; url.hash = "";
        const current = new WebSocket(url);
        socket = current;
        lastActivity = Date.now();
        current.onopen = () => { if (!stopped) current.send(`auth ${token}`); };
        current.onmessage = event => {
          if (stopped) return;
          lastActivity = Date.now();
          let type: string;
          try { type = JSON.parse(event.data).type; } catch { return; }
          if (type === "ready") { delay = 1000; setConnection("En vivo"); setRevision(r => r + 1); }
          if (type === "orders.changed") {
            clearTimeout(refresh);
            refresh = setTimeout(() => { setPage(0); setRevision(r => r + 1); }, 250);
          }
        };
        current.onerror = () => current.close();
        current.onclose = () => {
          if (stopped) return;
          setConnection("Reconectando · actualización de respaldo cada 30 s");
          retry = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30000);
        };
      } catch { setConnection("Revisa la URL de Control de ventas"); }
    };
    connect();
    // HTTP reconciliation also recovers missed notifications after sleep or restarts.
    const reconcile = setInterval(() => { if (controlSession.get()) setRevision(r => r + 1); }, 30000);
    const watchdog = setInterval(() => { if (socket && Date.now() - lastActivity > 45000) socket.close(); }, 5000);
    return () => { stopped = true; clearTimeout(retry); clearTimeout(refresh); clearInterval(reconcile); clearInterval(watchdog); socket?.close(); };
  }, []);

  return <div style={{ padding: 24, overflowY: "auto", minHeight: 0, height: "100%" }}>
    <section className={styles.panel} aria-label="Pedidos de E-commerce" aria-busy={busy}>
      <header className={styles.header}><div><h2>Pedidos de E-commerce {data && <small>({data.totalElements})</small>}</h2>
        <p>El inventario se descuenta al confirmar un pago real. Sigue aquí la preparación y entrega.</p>
        <small role="status">{connection}</small></div>
        <button disabled={busy} onClick={() => { setPage(0); setRevision(r => r + 1); }}>Actualizar</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {busy && !data && <p>Cargando pedidos…</p>}
      {data?.content.length === 0 && <p>Aún no hay pedidos para esta tienda.</p>}
      {data?.content.map(order => <details className={styles.order} key={order.id}>
        <summary><span><strong>{order.folio}</strong><small className={styles.folio}>{order.customerName || "Compra como invitado"} · {new Date(order.createdAt).toLocaleString("es-MX")}</small></span>
          <span className={styles.badge}>{paymentLabels[order.status] || order.status}</span>
          <strong>{money(Number(order.total ?? order.subtotal))}</strong><span>Ver pedido</span></summary>
        <div className={styles.details}>
          <OrderOperations order={order} onUpdated={()=>setRevision(r=>r+1)}/>
          <button type="button" disabled={preparingOrder!==null || !order.shippingAddress} onClick={()=>void prepareShipping(order)}>{preparingOrder===order.id ? "Preparando dirección y paquete…" : "Cotizar envío en Envia"}</button>
          {!order.shippingAddress && <small>Este pedido aún no tiene una dirección de entrega capturada.</small>}
          {order.shippingAddress ? <section aria-label="Dirección de entrega" style={{padding:16,border:'1px solid #DEDFD6',borderRadius:12,overflowWrap:'anywhere'}}>
            <h3>Dirección de entrega</h3><p><strong>{order.shippingAddress.recipient}</strong><br/>{order.shippingAddress.phone} · {order.shippingAddress.email}</p>
            <p>{order.shippingAddress.street} {order.shippingAddress.exteriorNumber}{order.shippingAddress.interiorNumber&&' · Interior '+order.shippingAddress.interiorNumber}<br/>{order.shippingAddress.district}, C.P. {order.shippingAddress.postalCode}<br/>{order.shippingAddress.city}, {order.shippingAddress.state}, {order.shippingAddress.country}</p>
            {order.shippingAddress.references&&<p>Referencias: {order.shippingAddress.references}</p>}
            <small>Dirección guardada para este pedido. La guía se genera internamente, no durante el pago.</small>
          </section> : <p>Dirección pendiente. Identifica al cliente con el folio que te enviará por WhatsApp.</p>}
          {order.lines.map((line, i) => <div className={styles.line} key={`${line.kind}-${line.itemId}-${i}`}>
            <div><strong>{line.name}</strong><small>{line.quantity} {line.kind === "BUNDLE" ? "cajas" : "unidades"} × {money(Number(line.unitPrice))}</small>{line.contents && <p>{line.contents}</p>}</div>
            <strong>{money(line.quantity * Number(line.unitPrice))}</strong>
          </div>)}
          <p>Productos: {money(Number(order.subtotal))}</p>
          {order.shippingAmount!=null ? <><p>Envío: {money(Number(order.shippingAmount))} · {order.shippingCarrier} · {order.shippingService}{order.shippingEnvironment==='sandbox'?' · Tarifa de prueba':''}</p><p><strong>Total del pedido: {money(Number(order.total ?? Number(order.subtotal)+Number(order.shippingAmount)))}</strong></p></> : <small>El envío se acuerda por separado.</small>}
        </div>
      </details>)}
      <footer className={styles.header}>
        <button disabled={busy || page === 0} onClick={() => { setData(undefined); setPage(p => p - 1); }}>Anterior</button>
        <span>Página {page + 1} de {Math.max(1, data?.totalPages || 1)}</span>
        <button disabled={busy || !data || page + 1 >= data.totalPages} onClick={() => { setData(undefined); setPage(p => p + 1); }}>Siguiente</button>
      </footer>
    </section>
  </div>;
}
