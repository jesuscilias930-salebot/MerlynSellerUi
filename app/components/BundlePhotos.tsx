"use client";

import { useEffect, useRef, useState } from "react";
import type { EntrepreneurPackage } from "../lib/types";
import { api } from "../lib/api";
import styles from "./BundlePhotos.module.css";

export type PendingPhoto = { id: string; file: File };

function Preview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    if (image.current) image.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);
  // Local previews and authenticated CRM media do not use the image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={file.name} />;
}

export function BundlePhotos({ groups, pending, onChange, disabled, progress }: {
  groups: EntrepreneurPackage[];
  pending: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
  disabled: boolean;
  progress: string;
}) {
  const [error, setError] = useState("");
  const images = groups.flatMap(group => group.images);
  return <section className={styles.panel} aria-label="Fotografías del bundle">
    <div className={styles.heading}><div><h4>Fotografías del paquete</h4><p>Selecciona varias fotos. Se subirán al guardar el bundle.</p></div><span>{images.length} guardadas · {pending.length} pendientes</span></div>
    <label className={styles.picker}>＋ Seleccionar fotografías
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        setError("");
        if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024)) {
          setError("Selecciona imágenes JPEG, PNG o WebP de hasta 5 MB. No se añadieron los archivos de esta selección.");
          return;
        }
        const fresh = files.filter(file => !pending.some(photo => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified));
        if (pending.length + fresh.length > 20) { setError("Puedes subir hasta 20 fotos por guardado."); return; }
        onChange([...pending, ...fresh.map(file => ({ id: crypto.randomUUID(), file }))]);
      }} />
    </label>
    <small>JPEG, PNG o WebP · Máximo 5 MB por foto. Almacenamiento actual del CRM; aún no S3.</small>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {progress && <p role="status" aria-live="polite">{progress}</p>}
    {images.length > 0 && <><h5>Ya guardadas</h5><div className={styles.grid}>{images.map(image => <figure key={image.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={image.filename || "Fotografía del paquete"} loading="lazy" />
      <figcaption>{image.filename || "Fotografía guardada"}</figcaption>
    </figure>)}</div></>}
    {pending.length > 0 && <><div className={styles.heading}><h5>Pendientes de subir</h5><button className="plain-button" type="button" disabled={disabled} onClick={() => onChange([])}>Quitar pendientes</button></div>
      <div className={styles.grid}>{pending.map(photo => <figure key={photo.id}><Preview file={photo.file} /><figcaption>{photo.file.name}</figcaption><button type="button" className="plain-button" disabled={disabled} aria-label={`Quitar ${photo.file.name}`} onClick={() => onChange(pending.filter(item => item.id !== photo.id))}>Quitar</button></figure>)}</div>
    </>}
    {!images.length && !pending.length && <p className={styles.empty}>Este paquete todavía no tiene fotografías.</p>}
  </section>;
}
