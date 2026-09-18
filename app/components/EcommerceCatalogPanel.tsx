"use client";
import { useEffect, useRef, useState } from "react";
import { controlRequest, controlSession } from "../lib/control-api";
import styles from "./EcommerceCatalogPanel.module.css";
type Item = { id: number; name: string; currentStock?: number; fixedPrice?: number; items?: {quantity:number}[] };
function Photo({ src, file, name }: {src?:string;file:File|null;name:string}) {
  const ref=useRef<HTMLImageElement>(null);
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);if(ref.current)ref.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  // eslint-disable-next-line @next/next/no-img-element
  return src||file ? <img ref={ref} src={file?undefined:src} alt={name} /> : <div className={styles.placeholder}>Sin imagen de tienda</div>;
}
function CatalogCard({item,src,kind,refresh}:{item:Item;src?:string;kind:string;refresh:()=>Promise<void>}) {
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const lock=useRef(false);
  const upload=async()=>{
    if(!file||lock.current)return;
    lock.current=true;setBusy(true);setNotice("");
    try {const body=new FormData();body.append("file",file);await controlRequest(`/${kind}/${item.id}/store-image`,{method:"POST",body});setFile(null);setNotice("Imagen guardada en S3. Actualiza la tienda para verla.");await refresh();}
    catch(e){setNotice(e instanceof Error?e.message:"No se pudo subir la imagen.");}
    finally{setBusy(false);lock.current=false;}
  };
  return <article className={styles.card}>
    <Photo key={file?`${file.name}-${file.lastModified}`:src||"empty"} src={src} file={file} name={item.name}/>
    <h3>{item.name}</h3><small>#{item.id} · {kind==="products"?`${item.currentStock||0} piezas disponibles`:`${item.items?.reduce((n,i)=>n+i.quantity,0)||0} piezas por paquete`}</small>
    {item.fixedPrice!=null&&<b>{new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(item.fixedPrice)}</b>}
    <label>Imagen principal<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{const next=e.target.files?.[0];e.target.value="";if(!next)return;if(!["image/jpeg","image/png"].includes(next.type)||next.size>5*1024*1024||!next.size){setNotice("Usa JPG o PNG de hasta 5 MB.");return;}setFile(next);setNotice("");}}/></label>
    {file&&<span className={styles.filename}>{file.name}</span>}
    <div className={styles.actions}><button type="button" disabled={!file||busy} onClick={()=>void upload()}>{busy?"Subiendo…":src?"Reemplazar en S3":"Subir a S3"}</button>{file&&<button type="button" disabled={busy} onClick={()=>setFile(null)}>Cancelar</button>}</div>
    <p role="status">{notice}</p>
  </article>;
}
export function EcommerceCatalogPanel({kind}:{kind:"products"|"bundles"}) {
  const [items,setItems]=useState<Item[]>([]);
  const [images,setImages]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  async function refresh(){setLoading(true);setError("");try{if(!controlSession.get())throw Error("Inicia sesión en Control de ventas y después vuelve a E-commerce.");const [data,urls]=await Promise.all([controlRequest<Item[]>(kind==="products"?"/products/all":"/bundles"),controlRequest<Record<string,string>>(`/${kind}/store-images`)]);setItems(data);setImages(urls);}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el catálogo");}finally{setLoading(false);}}
  useEffect(()=>{let active=true;Promise.all([controlRequest<Item[]>(kind==="products"?"/products/all":"/bundles"),controlRequest<Record<string,string>>(`/${kind}/store-images`)]).then(([data,urls])=>{if(active){setItems(data);setImages(urls);}}).catch(e=>{if(active)setError(controlSession.get()?(e instanceof Error?e.message:"No se pudo cargar el catálogo"):"Inicia sesión en Control de ventas y después vuelve a E-commerce.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
  const visible=items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));
  return <section className={styles.panel}><header><div><small>E-COMMERCE</small><h1>{kind==="bundles"?"Bundles":"Productos"}</h1><p>Fotografía principal de cada artículo para la tienda. No modifica las fotos para chats.</p></div><button type="button" disabled={loading} onClick={()=>void refresh()}>Actualizar</button></header>
    <p>JPG o PNG · Hasta 5 MB y 16 megapíxeles. Solo sube imágenes que quieras mostrar a los compradores.</p>
    <input aria-label="Buscar en catálogo" placeholder="Buscar por nombre…" value={search} onChange={e=>setSearch(e.target.value)}/>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{loading&&<p role="status">Cargando catálogo…</p>}
    {!loading&&!error&&!visible.length&&<p>No hay artículos para mostrar.</p>}
    <div className={styles.grid}>{visible.map(item=><CatalogCard key={item.id} item={item} src={images[item.id]} kind={kind} refresh={refresh}/>)}</div>
  </section>;
}
