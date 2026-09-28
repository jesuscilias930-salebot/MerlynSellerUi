"use client";
import {useEffect,useState} from 'react';
import {controlRequest} from '../lib/control-api';
import styles from './EcommerceCatalogPanel.module.css';
type Photo={id:number;url:string};
export function PresentationPanel(){
 const [photo,setPhoto]=useState<Photo>(),[file,setFile]=useState<File>(),[preview,setPreview]=useState('');
 const [busy,setBusy]=useState(true),[approved,setApproved]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){setPhoto((await controlRequest<Photo[]>('/store/presentation'))[0]);}
 useEffect(()=>{let active=true;controlRequest<Photo[]>('/store/presentation').then(p=>{if(active)setPhoto(p[0]);}).catch(()=>{if(active)setError('No se pudo cargar la foto. Verifica tu sesión de Control de ventas.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function save(){if(!file||!approved||busy)return;setBusy(true);setError('');setNotice('');try{const body=new FormData();body.append('file',file);body.append('publicationApproved','true');await controlRequest('/store/presentation',{method:'PUT',body});setFile(undefined);setApproved(false);setNotice('Foto publicada. Aparecerá al recargar el inicio de la tienda.');try{await refresh();}catch{setError('La foto se guardó, pero no se pudo actualizar la vista previa. Pulsa Actualizar.');}}catch(e){setError(e instanceof Error?e.message:'No se pudo publicar la foto.');}finally{setBusy(false);}}
 async function remove(){if(!photo||!window.confirm('¿Retirar tu foto de presentación de la tienda?'))return;setBusy(true);setError('');setNotice('');try{await controlRequest(`/store/presentation/${photo.id}`,{method:'DELETE'});setPhoto(undefined);setNotice('Foto retirada. Los enlaces anteriores pueden seguir activos temporalmente.');}catch(e){setError(e instanceof Error?e.message:'No se pudo retirar la foto.');}finally{setBusy(false);}}
 return <section className={styles.panel}><header><div><small>E-COMMERCE</small><h1>Imagen de presentación</h1><p>Tu fotografía en “Conoce a quien está detrás de Merlyn”. Se guarda en S3 y no modifica las fotos de productos ni testimonios.</p></div><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await refresh();}catch{setError('No se pudo cargar la foto.');}finally{setBusy(false);}}}>Actualizar</button></header>
 <p>JPG o PNG · Hasta 5 MB y 16 megapíxeles. Evita datos personales de terceros en la fotografía.</p>
 <label>Seleccionar foto <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(!next)return;if(!['image/jpeg','image/png'].includes(next.type)||!next.size||next.size>5*1024*1024){setError('Usa JPG o PNG de hasta 5 MB.');return;}setFile(next);setApproved(false);setError('');setNotice('');}}/></label>
 {preview&&<div><h2>Vista previa antes de publicar</h2><img src={preview} alt="Foto seleccionada de presentación" style={{maxWidth:'100%',width:320,maxHeight:400,objectFit:'contain'}}/><p><button disabled={busy} onClick={()=>setFile(undefined)}>Cancelar selección</button></p></div>}
 <p><label><input type="checkbox" checked={approved} disabled={busy||!file} onChange={e=>setApproved(e.target.checked)}/> Autorizo publicar esta fotografía en la tienda.</label></p>
 <button disabled={busy||!file||!approved} onClick={()=>void save()}>{busy?'Procesando…':photo?'Reemplazar foto':'Publicar foto'}</button>
 {error&&<p role="alert" className={styles.error}>{error}</p>}<p role="status">{notice}</p>
 <h2>Foto publicada</h2>{photo?<div><img src={photo.url} alt="Presentación de Merlyn publicada" style={{maxWidth:'100%',width:320,maxHeight:400,objectFit:'contain'}}/><p><button disabled={busy} onClick={()=>void remove()}>Retirar foto</button></p></div>:!busy&&<p>Aún no hay una foto de presentación. La tienda utiliza su imagen temporal.</p>}
 </section>;
}
