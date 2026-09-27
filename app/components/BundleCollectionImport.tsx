"use client";
import {useState} from "react";
import {controlRequest} from "../lib/control-api";
import {BundleEditorDialog} from "./BundleEditorDialog";

type Product={id:number;name:string;category?:{name?:string|null}|null;gender?:string|null};
const fields=[["tinDeportivoId","Tin deportivo / afelpado"],["calcetaDeportivaId","Calceta deportiva"],["tinLicraId","Tin de licra"],["caricaturaReferenceId","Referencia de caricatura (surtirá toda su categoría)"]] as const;
export function BundleCollectionImport({products,onImported}:{products:Product[];onImported:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [selected,setSelected]=useState<Record<string,string>>({});
 return <><button type="button" className="plain-button" onClick={()=>{setError("");setOpen(true);}}>Cargar paquetes acordados</button>
 {open&&<BundleEditorDialog title="Paquetes · septiembre 2026" saving={busy} onClose={()=>{if(!busy)setOpen(false);}}>
 <form className="bundle-editor" onSubmit={async e=>{
  e.preventDefault();if(busy)return;
  const ids=fields.map(([key])=>Number(selected[key]));if(ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==4){setError("Selecciona cuatro productos distintos.");return;}
  setBusy(true);setError("");
  try{await controlRequest("/bundles/september-collection",{method:"POST",body:JSON.stringify(Object.fromEntries(fields.map(([key])=>[key,Number(selected[key])])))});await onImported();setOpen(false);}
  catch(e){setError(e instanceof Error?e.message:"No se pudo importar.");}finally{setBusy(false);}
 }}>
 <fieldset disabled={busy} style={{border:0,padding:0,display:"grid",gap:16}}>
 <p>Confirma las referencias de tu catálogo. Se crearán 7 paquetes, 3 productos de shorts y sus escalas de venta, sin agregar inventario ni fotografías.</p>
 {fields.map(([key,label])=><label key={key}>{label}<select required value={selected[key]||""} onChange={e=>setSelected({...selected,[key]:e.target.value})}><option value="">Selecciona el producto correcto</option>{products.filter(p=>key!=="caricaturaReferenceId"||p.category?.name?.toLowerCase().includes("caricatura")).map(p=><option key={p.id} value={p.id}>{p.name} · {p.category?.name} · {p.gender} (#{p.id})</option>)}</select></label>)}
 <ul><li>Deportivo Arranque: 60 pares de cada deportivo (180).</li><li>Deportivo Plus: 75 de cada uno (225).</li><li>Deportivo Pro: 150 de cada uno (450).</li><li>Paquete Arranque / Plus / Pro: 30 / 75 / 150 pares de cada deportivo y de caricatura surtida (120 / 300 / 600).</li><li>Shorts y calcetines: 10 shorts de cada tipo y 60 pares de cada uno de los dos deportivos (120 pares + 30 shorts).</li></ul>
 <p>Caricatura: surtido niño a adulto y todos los géneros según existencia, con escalas iguales. Shorts caballero con/sin cierre comparten volumen; dama independiente. Los envíos con shorts requieren cotización personalizada.</p>
 <p>Si ya existe un paquete con igual nombre y contenido, se conserva. Si tiene otro contenido o reglas incompatibles, se cancela toda la importación sin sobrescribirlo.</p>
 <label><input type="checkbox" required/> Confirmo las referencias y la creación de este catálogo con precios automáticos.</label>
 {error&&<p role="alert">{error}</p>}
 <button type="submit">{busy?"Creando catálogo…":"Crear catálogo"}</button>
 </fieldset></form></BundleEditorDialog>}</>;
}
