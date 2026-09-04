"use client";
import { ChangeEvent, useState } from "react";
import { api } from "../lib/api";
import type { SavedSticker } from "../lib/types";

export function StickersPanel({ stickers, onUpload, onDelete }: { stickers: SavedSticker[]; onUpload: (file: File, name: string) => Promise<void>; onDelete: (sticker: SavedSticker) => Promise<void> }) {
  const [name, setName] = useState(""); const [uploading, setUploading] = useState(false);
  const choose = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.type !== "image/webp" || file.size > 500 * 1024) return window.alert("Selecciona un sticker WEBP de máximo 500 KB."); setUploading(true); try { await onUpload(file, name.trim() || file.name.replace(/\.[^.]+$/, "")); setName(""); } finally { setUploading(false); } };
  return <section className="stickers-panel"><header><div><p>STICKERS</p><h2>Stickers guardados</h2><span>Sube stickers WEBP y envíalos desde cualquier chat.</span></div></header><div className="sticker-upload"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre opcional del sticker" /><label className="primary-action">{uploading ? "Subiendo…" : "＋ Subir sticker"}<input type="file" accept="image/webp,.webp" onChange={choose} disabled={uploading} /></label></div><div className="sticker-library">{stickers.length === 0 && <span>Aún no hay stickers guardados.</span>}{stickers.map((sticker) => <article key={sticker.id}><img src={`${api}/settings/stickers/${sticker.id}/media`} alt={sticker.name} /><small>{sticker.name}</small><button type="button" className="danger-link" onClick={() => void onDelete(sticker)}>Eliminar</button></article>)}</div></section>;
}
