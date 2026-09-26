"use client";
import { useState } from "react";
import { controlRequest } from "../lib/control-api";

export type OperationalOrder = {
  id: string; status: string; fulfillmentStatus?: string; inventoryDeductedAt?: string; manualPaymentAllowed?: boolean;
  inventoryIssue?: string; trackingNumber?: string; dispatchCarrier?: string;
  history?: { occurredAt: string; actor: string; action: string; note: string }[];
};
const labels: Record<string,string> = { AWAITING_PAYMENT:"Esperando pago", READY:"Listo para preparar", PREPARING:"En preparación", SHIPPED:"Enviado", DELIVERED:"Entregado", CANCELLED:"Cancelado", REFUND_REQUESTED:"Reembolso solicitado", STOCK_ISSUE:"Revisar existencias", REVIEW_REQUIRED:"Requiere conciliación", TEST:"Pedido de prueba" };
export function OrderOperations({order,onUpdated}:{order:OperationalOrder;onUpdated:()=>void}) {
  const [action,setAction]=useState(""); const [note,setNote]=useState("");
  const [tracking,setTracking]=useState(""); const [carrier,setCarrier]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const state=order.fulfillmentStatus || "AWAITING_PAYMENT";
  const options: [string,string][]=[];
  if(order.manualPaymentAllowed && order.status==="PENDING" && state==="AWAITING_PAYMENT") options.push(["CONFIRM_PAYMENT","Confirmar pago recibido por WhatsApp"]);
  if(order.status==="PAID" && state==="STOCK_ISSUE") options.push(["RETRY_STOCK","Reintentar descuento de inventario"]);
  if(order.status==="PAID" && order.inventoryDeductedAt) {
    if(state==="READY") options.push(["PREPARE","Comenzar preparación"]);
    if(state==="PREPARING") options.push(["SHIP","Registrar entrega a paquetería"]);
    if(state==="SHIPPED") options.push(["DELIVER","Confirmar entrega al cliente"]);
  }
  if(order.status!=="PAID_TEST" && !["CANCELLED","REFUND_REQUESTED","SHIPPED","DELIVERED"].includes(state)) options.push(["CANCEL",order.status==="PAID"?"Solicitar cancelación y reembolso":"Cancelar pedido"]);
  return <section style={{padding:16,border:"1px solid #DEDFD6",borderRadius:12}} aria-label="Seguimiento del pedido">
    <h3>{labels[state] || state}</h3>
    <p>{order.inventoryDeductedAt?"Inventario descontado después del pago.":"Sin descuento de inventario registrado."}</p>
    {order.inventoryIssue && <p role="alert">{order.inventoryIssue}</p>}
    {order.trackingNumber && <p>Guía: {order.trackingNumber} · {order.dispatchCarrier}</p>}
    {state==="REFUND_REQUESTED" && <p>Solicitud registrada. El reembolso debe gestionarse y verificarse manualmente; este botón no devuelve dinero ni repone existencias.</p>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{options.map(([key,label])=><button type="button" key={key} disabled={busy} onClick={()=>{setAction(key);setError("");setNote("");}}>{label}</button>)}</div>
    {action && <form style={{display:"grid",gap:12,marginTop:16}} onSubmit={async e=>{
      e.preventDefault();setBusy(true);setError("");
      try {await controlRequest(`/pending-orders/${encodeURIComponent(order.id)}/actions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,note,trackingNumber:tracking,carrier})});setAction("");onUpdated();}
      catch(e){setError(e instanceof Error?e.message:"No se pudo actualizar el pedido");} finally {setBusy(false);}
    }}>
      <strong>{options.find(([key])=>key===action)?.[1]}</strong>
      {action==="CONFIRM_PAYMENT" && <p>Confirma únicamente si ya verificaste la recepción del dinero. Descontará inventario. Los pagos de Stripe solo se confirman automáticamente por webhook.</p>}
      <label>Referencia o motivo<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} required={["CONFIRM_PAYMENT","CANCEL"].includes(action)}/></label>
      {action==="SHIP" && <><label>Paquetería<input required maxLength={120} value={carrier} onChange={e=>setCarrier(e.target.value)}/></label><label>Número de guía<input required maxLength={120} value={tracking} onChange={e=>setTracking(e.target.value)}/></label></>}
      <label><input type="checkbox" required key={action}/> Confirmo que la información es correcta.</label>
      <div><button disabled={busy} type="submit">{busy?"Guardando…":"Confirmar cambio"}</button> <button type="button" disabled={busy} onClick={()=>setAction("")}>Volver</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    {!!order.history?.length && <details><summary>Historial del pedido</summary><ol>{order.history.map((entry,index)=><li key={index}>{new Date(entry.occurredAt).toLocaleString("es-MX")} · {entry.action} · {entry.actor}<p>{entry.note}</p></li>)}</ol></details>}
  </section>;
}
