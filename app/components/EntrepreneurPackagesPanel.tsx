"use client";

import { ChangeEvent, useState } from "react";
import { api } from "../lib/api";
import type { EntrepreneurPackage } from "../lib/types";

type Props = { packages: EntrepreneurPackage[]; onCreate: (name: string) => Promise<EntrepreneurPackage>; onUpload: (packageId: string, file: File) => Promise<void>; onSave: (item: EntrepreneurPackage, changes: { name: string; caption: string }) => Promise<void>; onDelete: (item: EntrepreneurPackage) => Promise<void> };

function ImageSetCard({ item, onUpload, onSave, onDelete }: { item: EntrepreneurPackage; onUpload: Props["onUpload"]; onSave: Props["onSave"]; onDelete: Props["onDelete"] }) {
  const [name, setName] = useState(item.name); const [caption, setCaption] = useState(item.caption || ""); const [expanded, setExpanded] = useState(false); const [uploading, setUploading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return window.alert("Todas las imágenes deben ser JPEG, PNG o WebP de hasta 5 MB.");
    setUploading(true); setError(""); try { for (const file of files) await onUpload(item.id, file); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No fue posible subir las imágenes."); } finally { setUploading(false); }
  };
  const images = item.images || [];
  return <article className="image-set-card"><header><div><p>CONJUNTO · {images.length} IMAGEN{images.length === 1 ? "" : "ES"}</p><strong>{item.name}</strong></div><div className="image-set-header-actions"><label className="plain-button image-upload-button">{uploading ? "Subiendo…" : "＋ Agregar imágenes"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={chooseFiles} disabled={uploading} /></label><button className="collapse-toggle" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "⌃ Ocultar" : "⌄ Administrar"}</button></div></header><div className="image-set-preview">{images.length ? images.map((image) => <img key={image.id} src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt="" />) : <span>Este conjunto aún no tiene imágenes.</span>}</div>{error && <p className="image-set-error">{error}</p>}{expanded && <div className="image-set-editor"><label>Nombre del conjunto<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label>Texto opcional que acompañará cada imagen<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1024} placeholder="Opcional" /></label><div className="template-actions"><button type="button" onClick={async () => { setSaving(true); try { await onSave(item, { name, caption }); } finally { setSaving(false); } }} disabled={saving || !name.trim()}>{saving ? "Guardando…" : "Guardar"}</button><button type="button" className="danger" onClick={() => void onDelete(item)} disabled={saving || uploading}>Eliminar conjunto</button></div></div>}</article>;
}

export function EntrepreneurPackagesPanel({ packages, onCreate, onUpload, onSave, onDelete }: Props) {
  const [name, setName] = useState(""); const [creating, setCreating] = useState(false);
  const create = async () => { if (!name.trim()) return; setCreating(true); try { await onCreate(name.trim()); setName(""); } finally { setCreating(false); } };
  return <section className="entrepreneur-packages"><header className="packages-header"><div><p>IMÁGENES GUARDADAS</p><h1>Conjuntos reutilizables</h1><span>Crea un conjunto como “Paquete emprendedor” o “Referencias” y agrega todas sus imágenes para enviarlas seguidas desde un chat.</span></div></header><div className="image-set-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del conjunto, ej. Paquete emprendedor" maxLength={120} /><button type="button" onClick={() => void create()} disabled={creating || !name.trim()}>{creating ? "Creando…" : "＋ Crear conjunto"}</button></div><div className="image-set-list">{packages.length === 0 ? <div className="automation-empty"><b>Aún no hay imágenes guardadas</b><span>Crea un conjunto y sube una o varias fotos dentro de él.</span></div> : packages.map((item) => <ImageSetCard key={item.id} item={item} onUpload={onUpload} onSave={onSave} onDelete={onDelete} />)}</div></section>;
}
