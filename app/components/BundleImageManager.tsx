"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { controlRequest } from "../lib/control-api";
import type { EntrepreneurPackage } from "../lib/types";

type ControlBundle = { id?: number; name: string; fixedPrice?: number };

type Props = {
  packages: EntrepreneurPackage[];
  onCreate: (name: string, bundleType: string, controlBundleId: number) => Promise<EntrepreneurPackage>;
  onUpload: (packageId: string, file: File) => Promise<void>;
};

export function BundleImageManager({ packages, onCreate, onUpload }: Props) {
  const [bundles, setBundles] = useState<ControlBundle[]>([]);
  const [bundleType, setBundleType] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void controlRequest<ControlBundle[]>("/bundles")
      .then(setBundles)
      .catch((error) => setNotice(error instanceof Error ? error.message : "No fue posible cargar los bundles."));
  }, []);

  const bundlePackages = useMemo(
    () => packages.filter((item) => item.controlBundleId),
    [packages],
  );
  const availableBundles = useMemo(
    () => bundles.filter((bundle) => !bundlePackages.some((item) => item.controlBundleId === bundle.id)),
    [bundles, bundlePackages],
  );
  const groups = useMemo(() => {
    const next = new Map<string, EntrepreneurPackage[]>();
    bundlePackages.forEach((item) => {
      const key = item.bundleType || "Sin tipo";
      next.set(key, [...(next.get(key) || []), item]);
    });
    return [...next.entries()];
  }, [bundlePackages]);

  const create = async () => {
    const selected = bundles.find((bundle) => String(bundle.id) === bundleId);
    if (!selected?.id || !bundleType.trim()) return;
    setSaving(true); setNotice("");
    try {
      await onCreate(selected.name, bundleType.trim(), selected.id);
      setBundleId("");
      setNotice(`“${selected.name}” está listo para recibir fotografías.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible preparar el bundle."); }
    finally { setSaving(false); }
  };

  const upload = async (item: EntrepreneurPackage, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setNotice("Usa imágenes JPEG, PNG o WebP de hasta 5 MB."); return;
    }
    setSaving(true); setNotice("");
    try {
      for (const file of files) await onUpload(item.id, file);
      setNotice(`Fotografías agregadas a “${item.name}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible subir las fotografías."); }
    finally { setSaving(false); }
  };

  return <section className="bundle-image-manager">
    <header><div><p>FOTOS PARA CHAT</p><h2>Imágenes de bundles</h2><span>Relaciona un bundle existente con un tipo, sube sus fotos y después envíalas desde cualquier conversación.</span></div></header>
    {notice && <div className="control-notice">{notice}</div>}
    <div className="bundle-media-create">
      <label>Tipo de bundle<input value={bundleType} onChange={(event) => setBundleType(event.target.value)} placeholder="Ej. Caja más vendida" maxLength={120} /></label>
      <label>Bundle existente<select value={bundleId} onChange={(event) => setBundleId(event.target.value)}><option value="">Selecciona un bundle</option>{availableBundles.map((bundle) => <option key={bundle.id} value={bundle.id}>{bundle.name}</option>)}</select></label>
      <button type="button" onClick={() => void create()} disabled={saving || !bundleType.trim() || !bundleId}>＋ Agregar bundle</button>
    </div>
    {!groups.length ? <div className="bundles-empty">Aún no has preparado bundles con fotos para el chat.</div> : <div className="bundle-image-groups">{groups.map(([type, items]) => <section key={type}><h3>{type}</h3><div>{items.map((item) => <article key={item.id}><header><div><b>{item.name}</b><small>{item.images.length} foto{item.images.length === 1 ? "" : "s"}</small></div><label className="plain-button image-upload-button">{saving ? "Subiendo…" : "＋ Subir fotos"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => void upload(item, event)} /></label></header><div className="bundle-image-previews">{item.images.length ? item.images.map((image) => <img key={image.id} src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={`Foto de ${item.name}`} />) : <span>Sin fotografías todavía.</span>}</div></article>)}</div></section>)}</div>}
  </section>;
}
