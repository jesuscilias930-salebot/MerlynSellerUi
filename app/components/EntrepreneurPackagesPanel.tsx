"use client";

import { ChangeEvent, useState } from "react";
import { api } from "../lib/api";
import type { EntrepreneurPackage } from "../lib/types";

type Props = {
  packages: EntrepreneurPackage[];
  onUpload: (file: File) => Promise<void>;
  onSave: (item: EntrepreneurPackage, changes: { name: string; caption: string }) => Promise<void>;
  onDelete: (item: EntrepreneurPackage) => Promise<void>;
};

function PackageCard({ item, onSave, onDelete }: { item: EntrepreneurPackage; onSave: Props["onSave"]; onDelete: Props["onDelete"] }) {
  const [name, setName] = useState(item.name);
  const [caption, setCaption] = useState(item.caption || "");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await onSave(item, { name, caption }); } finally { setSaving(false); } };
  return <article className="package-template-card"><img src={`${api}/settings/entrepreneur-packages/${item.id}/media`} alt={item.name} /><div><header><strong>{item.name}</strong><button className="collapse-toggle" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "⌃ Ocultar" : "⌄ Editar"}</button></header>{expanded && <div className="package-template-editor"><label>Nombre del paquete<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label>Texto que acompaña la imagen<textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1024} placeholder="Opcional" /></label><div className="template-actions"><button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? "Guardando…" : "Guardar"}</button><button type="button" className="danger" onClick={() => void onDelete(item)} disabled={saving}>Eliminar</button></div></div>}</div></article>;
}

export function EntrepreneurPackagesPanel({ packages, onUpload, onSave, onDelete }: Props) {
  const [uploading, setUploading] = useState(false);
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return window.alert("Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.");
    setUploading(true); try { await onUpload(file); } finally { setUploading(false); }
  };
  return <section className="entrepreneur-packages"><header><div><p>PAQUETES EMPRENDEDORES</p><h1>Imágenes reutilizables</h1><span>Guarda las imágenes de cada paquete una vez y selecciónalas rápido desde cualquier chat.</span></div><label className="primary-action">{uploading ? "Subiendo…" : "＋ Agregar imagen"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={uploading} /></label></header><div className="package-template-list">{packages.length === 0 ? <div className="automation-empty"><b>Aún no hay paquetes guardados</b><span>Sube la imagen de cada paquete emprendedor para enviarla en segundos.</span></div> : packages.map((item) => <PackageCard key={item.id} item={item} onSave={onSave} onDelete={onDelete} />)}</div></section>;
}
