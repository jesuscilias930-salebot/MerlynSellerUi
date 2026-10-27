"use client";

import { ChangeEvent, useState, type DragEvent } from "react";
import { api, request } from "../lib/api";
import type { EntrepreneurPackage } from "../lib/types";

type Props = { packages: EntrepreneurPackage[]; onCreate: (name: string, imageCategory: string) => Promise<EntrepreneurPackage>; onUpload: (packageId: string, file: File) => Promise<void>; onSave: (item: EntrepreneurPackage, changes: { name: string; caption: string; imageCategory: string }) => Promise<void>; onDelete: (item: EntrepreneurPackage) => Promise<void>; onChanged: () => Promise<void> };

type SetImage = EntrepreneurPackage["images"][number];
const move = <T,>(list: T[], from: number, to: number) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

/** Imágenes del conjunto en el orden en que se envían: se reordenan arrastrando o con flechas y se pueden quitar. */
function ImageSetGallery({ item, onChanged }: { item: EntrepreneurPackage; onChanged: Props["onChanged"] }) {
  const [order, setOrder] = useState<SetImage[]>(item.images || []);
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saveOrder = async (next: SetImage[]) => {
    const previous = order; setOrder(next); setBusy(true); setError("");
    try { await request(`/settings/entrepreneur-packages/${item.id}/images/order`, { method: "PUT", body: JSON.stringify({ imageIds: next.map((image) => image.id) }) }); await onChanged(); }
    catch (reason) { setOrder(previous); setError(reason instanceof Error ? reason.message : "No se pudo guardar el orden."); }
    finally { setBusy(false); }
  };
  const remove = async (image: SetImage, index: number) => {
    if (!window.confirm(`¿Quitar la imagen ${index + 1} de «${item.name}»?`)) return;
    setBusy(true); setError("");
    try { await request(`/settings/entrepreneur-packages/images/${image.id}`, { method: "DELETE" }); setOrder((current) => current.filter((entry) => entry.id !== image.id)); await onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo quitar la imagen."); }
    finally { setBusy(false); }
  };
  const drop = (event: DragEvent, index: number) => { event.preventDefault(); if (dragging === null || dragging === index || busy) return; void saveOrder(move(order, dragging, index)); setDragging(null); };
  if (!order.length) return <div className="image-set-preview"><span>Este conjunto aún no tiene imágenes.</span></div>;
  return <div className="image-set-gallery">
    <small className="image-set-hint">Se envían en este orden. Arrastra una imagen o usa las flechas para cambiarlo.</small>
    <ol className="image-set-preview ordered" aria-busy={busy}>{order.map((image, index) => <li key={image.id} draggable={!busy} className={dragging === index ? "dragging" : ""}
      onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, index)}>
      <span className="image-set-order">{index + 1}</span>
      <img loading="lazy" src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={`Imagen ${index + 1} de ${item.name}`} draggable={false} />
      <div className="image-set-tile-actions">
        <button type="button" aria-label={`Mover imagen ${index + 1} antes`} disabled={busy || index === 0} onClick={() => void saveOrder(move(order, index, index - 1))}>◀</button>
        <button type="button" aria-label={`Mover imagen ${index + 1} después`} disabled={busy || index === order.length - 1} onClick={() => void saveOrder(move(order, index, index + 1))}>▶</button>
        <button type="button" className="danger" aria-label={`Quitar imagen ${index + 1}`} disabled={busy} onClick={() => void remove(image, index)}>✕</button>
      </div>
    </li>)}</ol>
    {error && <p className="image-set-error">{error}</p>}
  </div>;
}

function ImageSetCard({ item, onUpload, onSave, onDelete, onChanged }: { item: EntrepreneurPackage; onUpload: Props["onUpload"]; onSave: Props["onSave"]; onDelete: Props["onDelete"]; onChanged: Props["onChanged"] }) {
  const [name, setName] = useState(item.name); const [caption, setCaption] = useState(item.caption || ""); const [imageCategory, setImageCategory] = useState(item.imageCategory || "Sin categoría"); const [expanded, setExpanded] = useState(false); const [showImages, setShowImages] = useState(false); const [uploading, setUploading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    // Hasta 20 MB; el servidor reduce a 5 MB las que WhatsApp no acepta.
    if (files.some((file) => file.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return window.alert("Todas las imágenes deben ser JPEG, PNG o WebP de hasta 20 MB.");
    setUploading(true); setShowImages(true); setError(""); try { for (const file of files) await onUpload(item.id, file); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No fue posible subir las imágenes."); } finally { setUploading(false); }
  };
  const images = item.images || [];
  return <article className="image-set-card"><header><button type="button" className="image-set-title" aria-expanded={showImages || expanded} onClick={() => setShowImages((value) => !(value || expanded))}><p>{imageCategory || "Sin categoría"} · {images.length} IMAGEN{images.length === 1 ? "" : "ES"}</p><strong>{item.name}</strong><small>{showImages || expanded ? "⌃ Ocultar imágenes" : images.length ? "⌄ Ver imágenes" : "Sin imágenes"}</small></button><div className="image-set-header-actions"><label className="plain-button image-upload-button">{uploading ? "Subiendo…" : "＋ Agregar imágenes"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={chooseFiles} disabled={uploading} /></label><button className="collapse-toggle" type="button" onClick={() => { setExpanded((value) => !value); if (expanded) setShowImages(false); }}>{expanded ? "⌃ Ocultar" : "⌄ Administrar"}</button></div></header>{/* Las imágenes se descargan solo al abrir el conjunto. */}{(showImages || expanded) && <ImageSetGallery key={images.map((image) => image.id).join(",")} item={item} onChanged={onChanged} />}{error && <p className="image-set-error">{error}</p>}{expanded && <div className="image-set-editor"><label>Nombre del conjunto<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label>Categoría<input list="image-category-options" value={imageCategory} onChange={(event) => setImageCategory(event.target.value)} maxLength={120} placeholder="Ej. Paquetes o Productos" /></label><label>Texto opcional que acompañará cada imagen<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1024} placeholder="Opcional" /></label><div className="template-actions"><button type="button" onClick={async () => { setSaving(true); try { await onSave(item, { name, caption, imageCategory }); } finally { setSaving(false); } }} disabled={saving || !name.trim() || !imageCategory.trim()}>{saving ? "Guardando…" : "Guardar"}</button><button type="button" className="danger" onClick={() => void onDelete(item)} disabled={saving || uploading}>Eliminar conjunto</button></div></div>}</article>;
}

export function EntrepreneurPackagesPanel({ packages, onCreate, onUpload, onSave, onDelete, onChanged }: Props) {
  const [name, setName] = useState(""); const [imageCategory, setImageCategory] = useState("Paquetes"); const [creating, setCreating] = useState(false);
  const imagePackages = packages.filter((item) => item.controlBundleId == null);
  const create = async () => { if (!name.trim() || !imageCategory.trim()) return; setCreating(true); try { await onCreate(name.trim(), imageCategory.trim()); setName(""); } finally { setCreating(false); } };
  return <section className="entrepreneur-packages"><datalist id="image-category-options"><option value="Paquetes" /><option value="Productos" /></datalist><header className="packages-header"><div><p>IMÁGENES GUARDADAS</p><h1>Conjuntos reutilizables</h1><span>Clasifica los conjuntos por categoría, como “Paquetes” o “Productos”, para encontrarlos rápidamente en cada chat.</span></div></header><div className="image-set-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del conjunto, ej. Paquete emprendedor" maxLength={120} /><input list="image-category-options" value={imageCategory} onChange={(event) => setImageCategory(event.target.value)} placeholder="Categoría, ej. Paquetes" maxLength={120} /><button type="button" onClick={() => void create()} disabled={creating || !name.trim() || !imageCategory.trim()}>{creating ? "Creando…" : "＋ Crear conjunto"}</button></div><div className="image-set-list">{imagePackages.length === 0 ? <div className="automation-empty"><b>Aún no hay imágenes guardadas</b><span>Crea un conjunto, elige su categoría y sube una o varias fotos dentro de él.</span></div> : imagePackages.map((item) => <ImageSetCard key={item.id} item={item} onUpload={onUpload} onSave={onSave} onDelete={onDelete} onChanged={onChanged} />)}</div></section>;
}
