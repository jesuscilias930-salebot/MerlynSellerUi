"use client";
import { useEffect, useRef, useState } from "react";
import { controlRequest, controlSession } from "../lib/control-api";
import { catalogProductName, groupCatalogProducts, groupSizeSiblings, type CatalogProductIdentity } from "../lib/catalog-product-groups";
import styles from "./EcommerceCatalogPanel.module.css";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
import { compositionLines } from "../lib/product-composition";
import { request } from "../lib/api";
import { colorSwatch } from "../lib/product-colors";
import { detailMaps, type ProductDetail } from "../lib/product-variants";
type Item = CatalogProductIdentity & { id: number; size?: string | null; composition?:string[]; storeCategory?:string|null; description?:string|null; currentStock?: number; fixedPrice?: number; items?: {quantity:number}[] };
const bundleCategory = (item: Item) => item.storeCategory?.trim() || "Sin categoría";
type SavedPhoto = {id:number;url:string};
function ProductCompositionEditor({item,siblings=[item]}:{item:Item;siblings?:Item[]}) {
  const [draft,setDraft]=useState((item.composition||[]).join("\n"));
  const [saved,setSaved]=useState(draft);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  async function save() {
    if(busy)return;
    setError("");setNotice("");
    let composition:string[];
    try { composition=compositionLines(draft); } catch(e) { setError(e instanceof Error?e.message:"Revisa la composición.");return; }
    setBusy(true);
    try {
      // Las tallas del mismo producto comparten composición.
      let result:Item|undefined;
      for(const sibling of siblings)result=await controlRequest<Item>(`/products/${sibling.id}/composition`,{method:"PATCH",body:JSON.stringify({composition})});
      const value=(result?.composition||[]).join("\n");setDraft(value);setSaved(value);setNotice(siblings.length>1?`Composición guardada en las ${siblings.length} tallas. Se mostrará en los detalles del producto en la tienda.`:"Composición guardada. Se mostrará en los detalles del producto en la tienda.");
    } catch(e) { setError(e instanceof Error?e.message:"No se pudo guardar la composición."); }
    finally {setBusy(false);}
  }
  return <details className={styles.compositionEditor}><summary>Composición del producto{saved?` · ${saved.split("\n").length} componentes`:" · Sin configurar"}</summary>
    <div className={styles.descriptionEditor}>
      <label htmlFor={`composition-${item.id}`}>Lista de composición<textarea id={`composition-${item.id}`} rows={4} maxLength={3020} value={draft} disabled={busy} onChange={e=>{setDraft(e.target.value);setError("");setNotice("");}} placeholder={"Una línea por material, por ejemplo:\nAlgodón\nPoliéster\nElastano"}/></label>
      <small>Hasta 20 materiales, 150 caracteres por línea. Añade porcentajes solo si están confirmados por el proveedor. Vacía la lista para retirarla de la tienda.</small>
      <button type="button" disabled={busy||draft===saved} onClick={()=>void save()}>{busy?"Guardando…":"Guardar composición"}</button>
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
    </div>
  </details>;
}
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
  return src||file ? <img ref={ref} src={file?undefined:src} alt={name} loading="lazy" /> : <div className={styles.placeholder}>Sin imagen de tienda</div>;
}
/** Color (de MerlynSeller) y talla para distinguir productos con el mismo nombre. */
function VariantLine({color,sizes}:{color?:string;sizes:string[]}) {
  if(!color&&!sizes.length)return null;
  const swatch=colorSwatch(color);
  return <p className={styles.variant}>
    {color&&<span className={styles.variantChip}><i className="product-color-dot" style={swatch?{background:swatch}:undefined} aria-hidden="true"/>{color}</span>}
    {sizes.map(size=><span key={size} className={styles.variantChip}>Talla {size}</span>)}
  </p>;
}
function CatalogCard({item,photos,kind,refresh,color,siblings=[item],sizes=[],ownPhotos=[]}:{item:Item;photos:SavedPhoto[];kind:string;refresh:()=>Promise<void>;color?:string;siblings?:Item[];sizes?:string[];ownPhotos?:{size:string;count:number}[]}) {
  const title = kind === "products" ? catalogProductName(item) : item.name;
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const lock=useRef(false);
  async function editGallery(action:()=>Promise<unknown>,message:string){
    if(lock.current)return;lock.current=true;setBusy(true);setNotice("");
    try{await action();setNotice(message);}catch(e){setNotice(e instanceof Error?e.message:"No se pudo modificar la galería");}
    finally{await refresh();setBusy(false);lock.current=false;}
  }
  function move(photoId:number,target:number){
    const ids=photos.map(p=>p.id);const from=ids.indexOf(photoId);
    if(from<0||target<0||target>=ids.length)return;
    ids.splice(from,1);ids.splice(target,0,photoId);
    void editGallery(()=>controlRequest(`/${kind}/${item.id}/store-gallery/order`,{method:"PUT",body:JSON.stringify(ids)}),"Orden guardado. La primera fotografía es la portada.");
  }
  function replace(photoId:number,file?:File){
    if(!file)return;
    if(!["image/jpeg","image/png"].includes(file.type)||!file.size||file.size>MAX_PHOTO_BYTES){setNotice("Usa JPG o PNG de hasta 20 MB.");return;}
    const body=new FormData();body.append("file",file);
    void editGallery(()=>controlRequest(`/${kind}/${item.id}/store-gallery/${photoId}`,{method:"PUT",body}),"Fotografía reemplazada, conservando su posición.");
  }
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
  const EditorContainer = kind === "bundles" ? "details" : "div";
  return <article className={`${styles.card} ${kind === "bundles" ? styles.compactCard : ""}`}>
    <Photo src={photos[0]?.url} file={null} name={title}/>
    <h3>{title}</h3>{kind==="products"&&<VariantLine color={color} sizes={sizes.length?sizes:item.size?[item.size]:[]}/>}<small>{siblings.length>1?siblings.map(sibling=>`#${sibling.id}`).join(", "):`#${item.id}`} · {kind==="products"?`${siblings.reduce((sum,sibling)=>sum+(sibling.currentStock||0),0)} piezas disponibles`:`${item.items?.reduce((n,i)=>n+i.quantity,0)||0} piezas por paquete`}</small>
    {kind==="bundles"&&<span className={styles.categoryBadge}>{bundleCategory(item)}</span>}
    {item.fixedPrice!=null&&<b>{new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(item.fixedPrice)}</b>}
    <small>{photos.length} fotos guardadas · La primera es la portada.</small>
    {siblings.length>1&&<small className={styles.shared}>📷 Estas fotos se usan en las {siblings.length} tallas en la tienda; no necesitas subirlas por talla.</small>}
    {ownPhotos.length>0&&<small className={styles.shared}>{ownPhotos.map(own=>`La talla ${own.size} tiene ${own.count} foto${own.count===1?"":"s"} propia${own.count===1?"":"s"}`).join(" · ")}; en la tienda esa talla sigue mostrando las suyas.</small>}
    {kind==="products"&&<ProductCompositionEditor key={`composition-${item.id}-${(item.composition||[]).join("\n")}`} item={item} siblings={siblings}/>}
    <EditorContainer className={styles.cardEditor}>
    {kind==="bundles"&&<summary>Administrar fotos y descripción</summary>}
    <div className={styles.editorBody}>
    {kind==="bundles"&&<BundleDescriptionEditor key={`${item.id}-${item.description||""}`} item={item}/>}
    <div className={styles.gallery}>{photos.map((photo,index)=><figure key={photo.id}>
      <a href={photo.url} target="_blank" rel="noopener noreferrer"><Photo src={photo.url} file={null} name={`${title}, foto ${index+1}`}/></a>
      <figcaption>{index===0?"★ Portada":`Foto ${index+1}`}</figcaption>
      <div className={styles.actions}>
        <button type="button" disabled={busy||index===0} onClick={()=>move(photo.id,0)}>Usar como portada</button>
        <button type="button" aria-label={`Mover foto ${index+1} antes`} disabled={busy||index===0} onClick={()=>move(photo.id,index-1)}>← Antes</button>
        <button type="button" aria-label={`Mover foto ${index+1} después`} disabled={busy||index===photos.length-1} onClick={()=>move(photo.id,index+1)}>Después →</button>
      </div>
      <label>Reemplazar foto {index+1}<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";replace(photo.id,file);}}/></label>
      <button type="button" className={styles.danger} disabled={busy} onClick={()=>{if(window.confirm(`¿Eliminar la foto ${index+1} de esta galería?${index===0?" La siguiente será la portada.":""}`))void editGallery(()=>controlRequest(`/${kind}/${item.id}/store-gallery/${photo.id}`,{method:"DELETE"}),"Foto retirada de la galería. El archivo privado se conserva en S3.");}}>Eliminar foto</button>
    </figure>)}</div>
    <label>Agregar fotografías<input type="file" multiple accept="image/jpeg,image/png" disabled={busy} onChange={e=>{
      const next=Array.from(e.target.files||[]);e.target.value="";
      if(next.some(file=>!["image/jpeg","image/png"].includes(file.type)||file.size>MAX_PHOTO_BYTES||!file.size)){setNotice("Usa JPG o PNG de hasta 20 MB por imagen.");return;}
      setFiles(current=>[...current,...next]);setNotice("");
    }}/></label>
    <div className={styles.photos}>{files.map((file,index)=><figure key={`${file.name}-${file.lastModified}-${index}`}><Photo file={file} name={`Vista previa de ${file.name}`}/><figcaption className={styles.filename}>{file.name}</figcaption><button type="button" disabled={busy} aria-label={`Quitar ${file.name} de las pendientes`} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>Quitar</button></figure>)}</div>
    <div className={styles.actions}><button type="button" disabled={!files.length||busy} onClick={()=>void upload()}>{busy?"Subiendo…":`Subir ${files.length||""} fotos`}</button>{files.length>0&&<button type="button" disabled={busy} onClick={()=>setFiles([])}>Cancelar</button>}</div>
    {photos.length>0&&files.length===1&&<button type="button" disabled={busy} onClick={()=>void upload(true)}>Usar la foto seleccionada para reemplazar la portada</button>}
    <p role="status">{notice}</p>
    </div>
    </EditorContainer>
  </article>;
}
export function EcommerceCatalogPanel({kind}:{kind:"products"|"bundles"}) {
  const [items,setItems]=useState<Item[]>([]);
  const [images,setImages]=useState<Record<string,SavedPhoto[]>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const [colors,setColors]=useState<Record<number,string>>({});
  // Productos: una pestaña por categoría; cada una se descarga solo al abrirla.
  const [tabs,setTabs]=useState<{id:number;name:string}[]|null>(null);
  const [tab,setTab]=useState<number|null>(null);
  const loaded=useRef(new Map<number,{items:Item[];images:Record<string,SavedPhoto[]>}>());
  const [counts,setCounts]=useState<Record<number,number>>({});
  useEffect(()=>{
    if(kind!=="products")return;
    let active=true;
    // El color vive en MerlynSeller; si no carga, el catálogo se muestra igual.
    request<ProductDetail[]>("/product-details").then(rows=>{if(active)setColors(detailMaps(rows).colors);}).catch(()=>undefined);
    return()=>{active=false;};
  },[kind]);
  async function fetchTab(id:number){
    const data=(await controlRequest<Item[]>(`/products/all?categoryId=${id}`)).filter(item=>item.category?.id===id);
    const ids=data.map(item=>item.id);
    const urls=ids.length?await controlRequest<Record<string,SavedPhoto[]>>(`/products/store-gallery?ids=${ids.join(",")}`):{};
    const entry={items:data,images:urls};loaded.current.set(id,entry);setCounts(current=>({...current,[id]:data.length}));return entry;
  }
  async function refresh(){setLoading(true);setError("");try{if(!controlSession.get())throw Error("Inicia sesión en Control de ventas y después vuelve a E-commerce.");
    if(kind==="products"){if(tab==null)return;const entry=await fetchTab(tab);setItems(entry.items);setImages(entry.images);return;}
    const [data,urls]=await Promise.all([controlRequest<Item[]>("/bundles"),controlRequest<Record<string,SavedPhoto[]>>(`/${kind}/store-gallery`)]);setItems(data);setImages(urls);}catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el catálogo");}finally{setLoading(false);}}
  const noSession="Inicia sesión en Control de ventas y después vuelve a E-commerce.";
  useEffect(()=>{if(kind!=="bundles")return;let active=true;Promise.all([controlRequest<Item[]>("/bundles"),controlRequest<Record<string,SavedPhoto[]>>(`/${kind}/store-gallery`)]).then(([data,urls])=>{if(active){setItems(data);setImages(urls);}}).catch(e=>{if(active)setError(controlSession.get()?(e instanceof Error?e.message:"No se pudo cargar el catálogo"):noSession);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
  // Solo la lista de categorías para las pestañas; los productos esperan a que elijas una.
  useEffect(()=>{if(kind!=="products")return;let active=true;
    controlRequest<{id:number;name:string}[]>("/category").then(rows=>{if(!active)return;const list=(Array.isArray(rows)?rows:[]).filter(row=>row&&row.id!=null).map(row=>({id:row.id,name:row.name?.trim()||`Categoría ${row.id}`})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
      setTabs(list);let saved:number|null=null;try{saved=Number(localStorage.getItem("merlyn-ecommerce-products-tab"))||null;}catch{}
      setTab(list.some(row=>row.id===saved)?saved:list[0]?.id??null);if(!list.length)setLoading(false);})
      .catch(e=>{if(active){setTabs([]);setLoading(false);setError(controlSession.get()?(e instanceof Error?e.message:"No se pudieron cargar las categorías"):noSession);}});
    return()=>{active=false;};},[kind]);
  useEffect(()=>{if(kind!=="products"||tab==null)return;let active=true;
    try{localStorage.setItem("merlyn-ecommerce-products-tab",String(tab));}catch{}
    const cached=loaded.current.get(tab);
    void Promise.resolve().then(()=>{if(!active)return;setError("");
      if(cached){setItems(cached.items);setImages(cached.images);setLoading(false);return;}
      setItems([]);setImages({});setLoading(true);
      fetchTab(tab).then(entry=>{if(active){setItems(entry.items);setImages(entry.images);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"No se pudo cargar la categoría");}).finally(()=>{if(active)setLoading(false);});});
    return()=>{active=false;};
  },[kind,tab]);
  const categories = [...new Set(items.map(bundleCategory))].sort((a,b)=>a.localeCompare(b,"es"));
  const visible=items.filter(i=>(kind === "products" ? `${catalogProductName(i)} ${colors[i.id]||""} ${i.size||""}` : i.name).toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")) && (kind!=="bundles" || !category || bundleCategory(i)===category));
  const productGroups = kind === "products" ? groupCatalogProducts(visible) : [];
  return <section className={styles.panel}><header><div><small>E-COMMERCE</small><h1>{kind==="bundles"?"Bundles":"Productos"}</h1><p>{kind==="products"?"Administra las fotografías y la lista de composición de cada producto para la tienda.":"Galería de cada artículo para la tienda. Agrega varias fotos sin reemplazar las existentes."} No modifica las fotos para chats.</p></div><button type="button" disabled={loading} onClick={()=>void refresh()}>Actualizar</button></header>
    {kind==="products"&&tabs&&tabs.length>0&&<div className={styles.tabs} role="tablist" aria-label="Categorías de productos">{tabs.map(row=><button key={row.id} type="button" role="tab" aria-selected={tab===row.id} className={tab===row.id?styles.tabActive:""} onClick={()=>{if(row.id!==tab){setSearch("");setTab(row.id);}}}>{row.name}{counts[row.id]!=null?<small>{counts[row.id]}</small>:null}</button>)}</div>}
    <p>JPG o PNG · Hasta 20 MB y 16 megapíxeles. Solo sube imágenes que quieras mostrar a los compradores.</p>
    <div className={styles.filters}>
      <label>Buscar<input aria-label="Buscar en catálogo" placeholder={kind === "products" ? "Nombre, género, color o talla en esta categoría…" : "Buscar por nombre…"} value={search} onChange={e=>setSearch(e.target.value)}/></label>
      {kind==="bundles"&&<label>Categoría de bundles<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      {(search||category)&&<button type="button" onClick={()=>{setSearch("");setCategory("");}}>Limpiar filtros</button>}
    </div>
    {!loading && <p>{visible.length} de {items.length} {kind==="bundles"?"bundles":"productos"}{kind==="bundles"?" · Abre una tarjeta para administrar sus fotografías y descripción.":""}</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{loading&&<p role="status">Cargando catálogo…</p>}
    {!loading&&!error&&!visible.length&&<p>No hay artículos para mostrar.</p>}
    {kind === "products" ? <div className={styles.categoryGroups}>{productGroups.map(group => <details key={group.key} className={styles.productCategory} open>
      <summary><span className={styles.categoryName}>{group.name}</span><span className={styles.categoryCount}>{group.products.length} {group.products.length === 1 ? "producto" : "productos"}{(()=>{const cards=groupSizeSiblings(group.products,colors).length;return cards<group.products.length?` · ${cards} ${cards===1?"tarjeta":"tarjetas"} (tallas juntas)`:"";})()}</span><span className={styles.categoryArrow} aria-hidden="true">⌄</span></summary>
      <div className={styles.grid}>{groupSizeSiblings(group.products,colors,id=>images[id]?.length||0).map(set => <CatalogCard key={`products-${set.key}`} item={set.primary} siblings={set.products} sizes={set.sizes} photos={images[set.primary.id]||[]} kind={kind} refresh={refresh} color={colors[set.primary.id]}
        ownPhotos={set.products.filter(other=>other.id!==set.primary.id&&(images[other.id]?.length||0)>0).map(other=>({size:other.size||`#${other.id}`,count:images[other.id].length}))}/>)}</div>
    </details>)}</div> : <div className={styles.grid}>{visible.map(item=><CatalogCard key={`${kind}-${item.id}`} item={item} photos={images[item.id]||[]} kind={kind} refresh={refresh}/>)}</div>}
  </section>;
}
