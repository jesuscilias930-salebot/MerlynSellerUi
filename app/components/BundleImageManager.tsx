"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { controlRequest } from "../lib/control-api";
import type { EntrepreneurPackage } from "../lib/types";

type ControlBundle = { id?: number; name: string; fixedPrice?: number };

type Props = {
  active?: boolean;
  packages: EntrepreneurPackage[];
  onCreate: (name: string, bundleType: string, controlBundleId: number) => Promise<EntrepreneurPackage>;
  onUpload: (packageId: string, file: File) => Promise<void>;
};

export function BundleImageManager({ packages, onCreate, onUpload, active = true }: Props) {
  const [bundles, setBundles] = useState<ControlBundle[]>([]);
  const [bundleType, setBundleType] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void controlRequest<ControlBundle[]>("/bundles", { signal: controller.signal })
      .then(setBundles)
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No fue posible cargar los bundles."); });
    return () => controller.abort();
  }, [active]);

  const bundlePackages = useMemo(
    () => packages.filter((item) => item.controlBundleId),
    [packages],
  );
  const selectedPackages = bundlePackages.filter(item => String(item.controlBundleId) === bundleId);

  const create = async () => {
    const selected = bundles.find((bundle) => String(bundle.id) === bundleId);
    if (!selected?.id || !bundleType.trim()) return;
    setSaving(true); setNotice("");
    try {
      await onCreate(selected.name, bundleType.trim(), selected.id);
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
    <header><div><p>FOTOS PARA CHAT</p><h2>Imágenes de bundles</h2><span>Relaciona un bundle existente con una categoría, sube sus fotos y después envíalas desde cualquier conversación.</span></div></header>
    {notice && <div className="control-notice">{notice}</div>}
    <div className="bundle-media-create">
      <label>Bundle<select value={bundleId} disabled={saving} onChange={(event) => { setBundleId(event.target.value); setNotice(""); }}><option value="">Selecciona un bundle para administrar sus fotos</option>{bundles.map((bundle) => <option key={bundle.id} value={bundle.id}>{bundle.name}</option>)}</select></label>
      {!!bundleId && !selectedPackages.length && <><label>Categoría de fotos para chat<input value={bundleType} disabled={saving} onChange={(event) => setBundleType(event.target.value)} placeholder="Ej. Caja más vendida" maxLength={120} /></label>
      <button type="button" onClick={() => void create()} disabled={saving || !bundleType.trim()}>Preparar fotos para chat</button></>}
    </div>
    {!bundleId && <p className="bundles-empty">Selecciona un bundle arriba. Puedes ver todas sus fotografías en la pestaña Bundles.</p>}
    <div className="bundle-image-groups">{selectedPackages.map(item => <section key={item.id}><h3>{item.bundleType || "Fotos para chat"}</h3><div><article><header><div><b>{item.name}</b><small>{item.images.length} fotos guardadas</small></div><label className="plain-button image-upload-button">{saving ? "Subiendo…" : "＋ Subir fotos"}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={event => void upload(item, event)} /></label></header><div className="bundle-image-previews">{item.images.length ? item.images.map(image => <img key={image.id} src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={`Foto de ${item.name}`} loading="lazy" />) : <span>Sin fotografías todavía.</span>}</div></article></div></section>)}</div>
  </section>;
}
