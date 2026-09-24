"use client";
import {useEffect,useState} from "react";
import {controlRequest} from "../lib/control-api";
import styles from "./EcommerceCatalogPanel.module.css";
type Photo={id:number;url:string};
function Preview({file}:{file:File}) {
 const [url,setUrl]=useState("");
 useEffect(()=>{const value=URL.createObjectURL(file);setUrl(value);return()=>URL.revokeObjectURL(value);},[file]);
 return url?<img src={url} alt={`Vista previa: ${file.name}`}/>:null;
}
export function TestimonialsPanel(){
 const [photos,setPhotos]=useState<Photo[]>([]),[files,setFiles]=useState<File[]>([]);
 const [approved,setApproved]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function refresh(){setPhotos(await controlRequest<Photo[]>("/store/testimonials"));}
 useEffect(()=>{let active=true;controlRequest<Photo[]>("/store/testimonials").then(p=>{if(active)setPhotos(p);}).catch(e=>{if(active)setError(e.message+". Verifica tu sesión de Control de ventas.");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 async function upload(){
  if(busy||!approved||!files.length)return;
  setBusy(true);setError("");setNotice("");let count=0;
  try{for(const file of files){const body=new FormData();body.append("file",file);body.append("publicationApproved","true");await controlRequest("/store/testimonials",{method:"POST",body});count++;setFiles(current=>current.slice(1));}setApproved(false);}
  catch(e){setError(e instanceof Error?e.message:"No se pudo publicar. Las fotos pendientes permanecen seleccionadas.");}
  finally{setNotice(`${count} fotografías publicadas.`);try{await refresh();}catch{setError("No se pudo actualizar la lista. Pulsa Actualizar.");}setBusy(false);}
 }
 async function remove(id:number){if(!window.confirm("¿Retirar esta fotografía de la tienda?"))return;setBusy(true);setError("");try{await controlRequest(`/store/testimonials/${id}`,{method:"DELETE"});setPhotos(current=>current.filter(p=>p.id!==id));setNotice("Fotografía retirada. Las páginas ya abiertas y los enlaces previos pueden conservarla temporalmente.");}catch(e){setError(e instanceof Error?e.message:"No se pudo retirar");}finally{setBusy(false);}}
 return <section className={styles.panel}><header><div><small>E-COMMERCE</small><h1>Testimonios</h1><p>Fotografías visibles en el inicio y en Referencias de la tienda.</p></div><button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await refresh();}catch{setError("No se pudo cargar la lista");}finally{setBusy(false);}}}>Actualizar</button></header>
 <p>JPG o PNG · Hasta 5 MB y 16 megapíxeles por foto. Oculta teléfonos, domicilios, números de guía, códigos QR y datos de pago antes de subirlas.</p>
 <label>Seleccionar fotografías <input type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={e=>{const next=Array.from(e.target.files||[]);e.target.value="";if(next.some(f=>!['image/jpeg','image/png'].includes(f.type)||!f.size||f.size>5*1024*1024)){setError("Usa JPG o PNG de hasta 5 MB.");return;}setFiles(current=>[...current,...next]);setApproved(false);setError("");}}/></label>
 <div className={styles.grid}>{files.map((file,i)=><article className={styles.card} key={`${file.name}-${i}`}><Preview file={file}/><span className={styles.filename}>{file.name}</span><button disabled={busy} onClick={()=>setFiles(current=>current.filter((_,index)=>index!==i))}>Quitar selección</button></article>)}</div>
 <p><label><input type="checkbox" checked={approved} disabled={busy} onChange={e=>setApproved(e.target.checked)}/> Tengo autorización para publicar estas fotografías y he ocultado los datos personales.</label></p>
 <button disabled={busy||!approved||!files.length} onClick={()=>void upload()}>{busy?"Procesando…":`Publicar fotografías (${files.length})`}</button>
 {error&&<p role="alert" className={styles.error}>{error}</p>}<p role="status">{notice}</p>
 <h2>Fotografías publicadas ({photos.length})</h2>{!busy&&!photos.length&&<p>Aún no hay fotografías publicadas.</p>}
 <div className={styles.grid}>{photos.map((p,i)=><article className={styles.card} key={p.id}><a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={`Testimonio ${i+1}`}/></a><button disabled={busy} onClick={()=>void remove(p.id)}>Retirar de la tienda</button></article>)}</div>
 </section>;
}
