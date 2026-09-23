"use client";
import { useState } from "react";
import { controlRequest } from "../lib/control-api";

export function InventoryQuantityEditor({id,name,stock,onSaved}:{id:number;name:string;stock:number;onSaved:()=>Promise<void>}) {
  const [mode,setMode]=useState<"edit"|"clear"|null>(null);
  const [quantity,setQuantity]=useState(String(stock));
  const [expected,setExpected]=useState(stock);
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  function open(next:"edit"|"clear") {
    setMode(next);setQuantity(next==="clear"?"0":String(stock));setExpected(stock);setReason("");setError("");
  }
  async function save() {
    const value=Number(quantity);
    if(!/^\d+$/.test(quantity)||!Number.isSafeInteger(value)||value>1_000_000_000||!reason.trim()) {setError("Indica una cantidad entera no negativa y el motivo del ajuste.");return;}
    if(!window.confirm(`¿Cambiar las existencias de ${name} de ${expected} a ${value} pares? No se eliminarán compras ni ventas.`))return;
    setBusy(true);setError("");
    try {
      await controlRequest(`/products/${id}/inventory`,{method:"PATCH",body:JSON.stringify({quantity:value,expectedStock:expected,reason:reason.trim()})});
      setMode(null);await onSaved();
    } catch(e) {setError(e instanceof Error?e.message:"No se pudo ajustar el inventario. Actualiza antes de reintentar.");}
    finally {setBusy(false);}
  }
  return <section aria-label={`Ajustar existencias de ${name}`} style={{gridColumn:"1 / -1",width:"100%"}}>
    {!mode?<div className="category-actions">
      <button type="button" className="plain-button" onClick={()=>open("edit")}>Modificar cantidad</button>
      <button type="button" className="danger-link" disabled={stock===0} onClick={()=>open("clear")}>Eliminar existencias</button>
    </div>:<div style={{display:"grid",gap:12,padding:16,background:"#f5f8f5",borderRadius:12}}>
      <strong>{mode==="clear"?"Dejar existencias en cero":"Ajustar cantidad disponible"}</strong>
      <p>Actual: {expected} pares. Se conserva el historial de compras y ventas. Para mercancía nueva utiliza Adquisición de mercancía; un aumento manual conserva el costo del último lote.</p>
      <label>Nueva cantidad (pares)<input type="number" min="0" max="1000000000" step="1" value={quantity} disabled={busy||mode==="clear"} onChange={e=>setQuantity(e.target.value)}/></label>
      <label>Motivo del ajuste<textarea maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder="Ej. Corrección por conteo físico o mercancía dañada"/></label>
      {stock!==expected&&<p role="alert">El inventario cambió. Cancela y vuelve a abrir el ajuste.</p>}
      {error&&<p role="alert">{error}</p>}
      <div className="category-actions"><button type="button" disabled={busy||stock!==expected||!reason.trim()} onClick={()=>void save()}>{busy?"Guardando…":"Confirmar ajuste"}</button><button type="button" className="plain-button" disabled={busy} onClick={()=>setMode(null)}>Cancelar</button></div>
    </div>}
  </section>;
}
