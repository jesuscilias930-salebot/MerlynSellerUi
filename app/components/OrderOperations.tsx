"use client";
import { useState } from "react";
import { controlRequest } from "../lib/control-api";
import { fulfillmentLabel } from "../lib/order-board";

export type OperationalOrder = {
  id: string; status: string; fulfillmentStatus?: string | null; inventoryDeductedAt?: string; manualPaymentAllowed?: boolean;
  inventoryIssue?: string; trackingNumber?: string; dispatchCarrier?: string;
  fulfillmentItems?: { productId: number; name: string; quantity: number }[];
  history?: { occurredAt: string; actor: string; action: string; note: string }[];
};
export function OrderOperations({order,onUpdated,onBusyChange,disabled=false}:{order:OperationalOrder;onUpdated:()=>void;onBusyChange?:(busy:boolean)=>void;disabled?:boolean}) {
  const [action,setAction]=useState(""); const [note,setNote]=useState("");
  const [tracking,setTracking]=useState(""); const [carrier,setCarrier]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const state=order.fulfillmentStatus || "AWAITING_PAYMENT";
  const options: [string,string][]=[];
  if(order.manualPaymentAllowed && order.status==="PENDING" && state==="AWAITING_PAYMENT") options.push(["CONFIRM_PAYMENT","Confirmar pago recibido por WhatsApp"]);
  if(order.status==="PAID" && state==="STOCK_ISSUE") options.push(["RETRY_STOCK","Reintentar descuento de inventario"]);
  if(order.status==="PAID" && order.inventoryDeductedAt) {
    if(state==="READY") options.push(["PREPARE","Marcar como armado"]);
    if(state==="PREPARING") options.push(["CREATE_LABEL","Registrar guía creada"]);
    if(state==="LABEL_CREATED") options.push(["SHIP","Marcar como despachado"]);
    if(state==="SHIPPED") options.push(["DELIVER","Confirmar entrega al cliente"]);
  }
  if(order.status!=="PAID_TEST" && !["CANCELLED","REFUND_REQUESTED","SHIPPED","DELIVERED"].includes(state)) options.push(["CANCEL",order.status==="PAID"?"Solicitar cancelación y reembolso":"Cancelar pedido"]);
  return <section style={{padding:16,border:"1px solid var(--line)",borderRadius:12}} aria-label="Seguimiento del pedido">
    <h3>{fulfillmentLabel(state)}</h3>
    <p>{order.inventoryDeductedAt?"Inventario descontado después del pago.":"Sin descuento de inventario registrado."}</p>
    {order.inventoryIssue && <p role="alert">{order.inventoryIssue}</p>}
    {!!order.fulfillmentItems?.length && <details open><summary>Contenido asignado para preparar</summary><ul>{order.fulfillmentItems.map(item=><li key={item.productId}>{item.quantity} × {item.name}</li>)}</ul><small>Cantidades descontadas de inventario; en calcetines son pares y en shorts son piezas.</small></details>}
    {order.trackingNumber && <p>Guía: {order.trackingNumber} · {order.dispatchCarrier}</p>}
    {state==="REFUND_REQUESTED" && <p>Solicitud registrada. El reembolso debe gestionarse y verificarse manualmente; este botón no devuelve dinero ni repone existencias.</p>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{options.map(([key,label])=><button type="button" key={key} disabled={busy || disabled} onClick={()=>{setAction(key);setError("");setNote("");}}>{label}</button>)}</div>
    {action && options.some(([key])=>key===action) && <form style={{display:"grid",gap:12,marginTop:16}} onSubmit={async e=>{
      e.preventDefault();if(busy||disabled)return;setBusy(true);onBusyChange?.(true);setError("");
      try {await controlRequest(`/pending-orders/${encodeURIComponent(order.id)}/actions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,note,trackingNumber:tracking,carrier})});setAction("");onUpdated();}
      catch(e){setError(e instanceof Error?e.message:"No se pudo actualizar el pedido");} finally {setBusy(false);onBusyChange?.(false);}
    }}>
      <strong>{options.find(([key])=>key===action)?.[1]}</strong>
      {action==="CONFIRM_PAYMENT" && <p>Confirma únicamente si ya verificaste la recepción del dinero. Descontará inventario. Los pagos de Stripe solo se confirman automáticamente por webhook.</p>}
      <label>Referencia o motivo<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} required={["CONFIRM_PAYMENT","CANCEL"].includes(action)}/></label>
      {action==="CREATE_LABEL" && <><p>Registra una guía ya generada. Este paso no compra una guía ni marca el paquete como despachado.</p><label>Paquetería<input required maxLength={120} value={carrier} onChange={e=>setCarrier(e.target.value)}/></label><label>Número de guía<input required maxLength={120} value={tracking} onChange={e=>setTracking(e.target.value)}/></label></>}
      {action==="PREPARE" && <p>Confirma cuando el contenido del pedido ya esté armado. Después podrás registrar su guía.</p>}
      {action==="SHIP" && <p>Confirma únicamente cuando el paquete haya sido entregado a la paquetería.</p>}
      <label><input type="checkbox" required key={action}/> Confirmo que la información es correcta.</label>
      <div><button disabled={busy || disabled} type="submit">{busy?"Guardando…":"Confirmar cambio"}</button> <button type="button" disabled={busy} onClick={()=>setAction("")}>Volver</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    {!!order.history?.length && <details><summary>Historial del pedido</summary><ol>{order.history.map((entry,index)=><li key={index}>{new Date(entry.occurredAt).toLocaleString("es-MX")} · {entry.action} · {entry.actor}<p>{entry.note}</p></li>)}</ol></details>}
  </section>;
}
