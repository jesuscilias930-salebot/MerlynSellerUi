"use client";
import { useEffect, useRef, useState } from "react";
import { controlRequest, controlSession } from "../lib/control-api";
import styles from "./EcommerceCatalogPanel.module.css";
type Item = { id: number; name: string; description?:string|null; currentStock?: number; fixedPrice?: number; items?: {quantity:number}[] };
type SavedPhoto = {id:number;url:string};
function BundleDescriptionEditor({item}:{item:Item}) {
  const [description,setDescription]=useState(item.description||"");
  const [saved,setSaved]=useState(item.description||"");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function save() {
    setBusy(true);setNotice("");
    try {
      const result=await controlRequest<Item>(`/bundles/${item.id}/description`,{method:"PATCH",body:JSON.stringify({description})});
      setDescription(result.description||"");setSaved(result.description||"");setNotice("Descripción guardada. Se mostrará debajo del título en la tienda.");
    } catch(e){setNotice(e instanceof Error?e.message:"No se pudo guardar la descripción.");}
    finally{setBusy(false);}
  }
  return <div className={styles.descriptionEditor}>
    <label>Descripción del paquete<textarea value={description} maxLength={4000} rows={5} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="Explica cómo está armado: surtido, tallas, colores y otros detalles…"/></label>
    <small>{description.length}/4000 caracteres · Visible en la tienda</small>
    <button type="button" disabled={busy||description===saved} onClick={()=>void save()}>{busy?"Guardando…":"Guardar descripción"}</button>
    <p role="status">{notice}</p>
  </div>;
}
function Photo({ src, file, name }: {src?:string;file:File|null;name:string}) {
  const ref=useRef<HTMLImageElement>(null);
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);if(ref.current)ref.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  // eslint-disable-next-line @next/next/no-img-element
  return src||file ? <img ref={ref} src={file?undefined:src} alt={name} /> : <div className={styles.placeholder}>Sin imagen de tienda</div>;
}
function CatalogCard({item,photos,kind,refresh}:{item:Item;photos:SavedPhoto[];kind:string;refresh:()=>Promise<void>}) {
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const lock=useRef(false);
  const upload=async(replaceCover=false)=>{
    if(!files.length||lock.current)return;
    lock.current=true;setBusy(true);setNotice("");
    let uploaded=0;
    try {
      for(const file of files){
        const body=new FormData();body.append("file",file);
        await controlRequest(`/${kind}/${item.id}/${replaceCover?'store-image':'store-gallery'}`,{method:"POST",body});
        uploaded++; setFiles(current=>current.slice(1));setNotice(`Subiendo ${uploaded} de ${files.length}…`);
      }
      setNotice(replaceCover?"Portada actualizada. Las demás fotos se conservaron.":`${uploaded} fotos guardadas. Actualiza la tienda para verlas.`);
    }
    catch(e){setNotice(`${uploaded} fotos guardadas. ${e instanceof Error?e.message:"No se pudo subir la imagen."} Las pendientes permanecen seleccionadas.`);}
    finally{await refresh();setBusy(false);lock.current=false;}
  };
  return <article className={styles.card}>
    <Photo src={photos[0]?.url} file={null} name={item.name}/>
    <h3>{item.name}</h3><small>#{item.id} · {kind==="products"?`${item.currentStock||0} piezas disponibles`:`${item.items?.reduce((n,i)=>n+i.quantity,0)||0} piezas por paquete`}</small>
    {kind==="bundles"&&<BundleDescriptionEditor key={`${item.id}-${item.description||""}`} item={item}/>}
    {item.fixedPrice!=null&&<b>{new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(item.fixedPrice)}</b>}
    <small>{photos.length} fotos guardadas · La primera es la portada.</small>
    <div className={styles.photos}>{photos.map((photo,index)=><figure key={photo.id}><Photo src={photo.url} file={null} name={`${item.name}, foto ${index+1}`}/><figcaption>{index===0?"Portada":`Foto ${index+1}`}</figcaption></figure>)}</div>
    <label>Agregar fotografías<input type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={e=>{
      const next=Array.from(e.target.files||[]);e.target.value="";
      if(next.some(file=>!["image/jpeg","image/png"].includes(file.type)||file.size>5*1024*1024||!file.size)){setNotice("Usa JPG o PNG de hasta 5 MB por imagen.");return;}
      setFiles(current=>[...current,...next]);setNotice("");
    }}/></label>
    <div className={styles.photos}>{files.map((file,index)=><figure key={`${file.name}-${file.lastModified}-${index}`}><Photo file={file} name={`Vista previa de ${file.name}`}/><figcaption className={styles.filename}>{file.name}</figcaption><button type="button" disabled={busy} aria-label={`Quitar ${file.name} de las pendientes`} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>Quitar</button></figure>)}</div>
    <div className={styles.actions}><button type="button" disabled={!files.length||busy} onClick={()=>void upload()}>{busy?"Subiendo…":`Subir ${files.length||""} fotos`}</button>{files.length>0&&<button type="button" disabled={busy} onClick={()=>setFiles([])}>Cancelar</button>}</div>
    {photos.length>0&&files.length===1&&<button type="button" disabled={busy} onClick={()=>void upload(true)}>Usar la foto seleccionada para reemplazar la portada</button>}
    <p role="status">{notice}</p>
  </article>;
}
export function EcommerceCatalogPanel({kind}:{kind:"products"|"bundles"}) {
  const [items,setItems]=useState<Item[]>([]);
  const [images,setImages]=useState<Record<string,SavedPhoto[]>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  async function refresh(){setLoading(true);setError("");try{if(!controlSession.get())throw Error("Inicia sesión en Control de ventas y después vuelve a E-commerce.");const [data,urls]=await Promise.all([controlRequest<Item[]>(kind==="products"?"/products/all":"/bundles"),controlRequest<Record<string,SavedPhoto[]>>(`/${kind}/store-gallery`)]);setItems(data);setImages(urls);}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el catálogo");}finally{setLoading(false);}}
  useEffect(()=>{let active=true;Promise.all([controlRequest<Item[]>(kind==="products"?"/products/all":"/bundles"),controlRequest<Record<string,SavedPhoto[]>>(`/${kind}/store-gallery`)]).then(([data,urls])=>{if(active){setItems(data);setImages(urls);}}).catch(e=>{if(active)setError(controlSession.get()?(e instanceof Error?e.message:"No se pudo cargar el catálogo"):"Inicia sesión en Control de ventas y después vuelve a E-commerce.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
  const visible=items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));
  return <section className={styles.panel}><header><div><small>E-COMMERCE</small><h1>{kind==="bundles"?"Bundles":"Productos"}</h1><p>Galería de cada artículo para la tienda. Agrega varias fotos sin reemplazar las existentes. No modifica las fotos para chats.</p></div><button type="button" disabled={loading} onClick={()=>void refresh()}>Actualizar</button></header>
    <p>JPG o PNG · Hasta 5 MB y 16 megapíxeles. Solo sube imágenes que quieras mostrar a los compradores.</p>
    <input aria-label="Buscar en catálogo" placeholder="Buscar por nombre…" value={search} onChange={e=>setSearch(e.target.value)}/>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{loading&&<p role="status">Cargando catálogo…</p>}
    {!loading&&!error&&!visible.length&&<p>No hay artículos para mostrar.</p>}
    <div className={styles.grid}>{visible.map(item=><CatalogCard key={`${kind}-${item.id}`} item={item} photos={images[item.id]||[]} kind={kind} refresh={refresh}/>)}</div>
  </section>;
}
