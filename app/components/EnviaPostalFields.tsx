"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { request } from "../lib/api";

type Location = { postalCode: string; country: string; state: string; city: string; district?: string };
type Locality = { stateCode: string; stateName: string; city: string; districts: string[] };
const same = (a: string, b: string) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function EnviaPostalFields<T extends Location>({ value, onChange }: { value: T; onChange: Dispatch<SetStateAction<T>> }) {
  const [result, setResult] = useState<{ postalCode: string; localities: Locality[] } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const mexican = value.country === "MX";
  useEffect(() => {
    setResult(null); setError("");
    if (!mexican || !/^\d{5}$/.test(value.postalCode)) return;
    const controller = new AbortController();
    const postalCode = value.postalCode;
    const timer = setTimeout(() => {
      void request<{ postalCode: string; localities: Locality[] }>(`/shipping/postal-codes/${postalCode}`, { signal: controller.signal }).then(data => {
        if (controller.signal.aborted) return;
        setResult(data);
        onChange(current => {
          if (current.postalCode !== postalCode || current.country !== "MX") return current;
          const location = data.localities.find(x => same(x.city, current.city)) || (data.localities.length === 1 ? data.localities[0] : undefined);
          return { ...current, state: location?.stateCode || "", city: location?.city || "", district: location?.districts.find(x => same(x, current.district || "")) || "" };
        });
      }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudieron consultar las colonias."); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value.postalCode, mexican, retry, onChange]);
  const localities = result?.postalCode === value.postalCode ? result.localities : [];
  const selected = localities.find(x => x.city === value.city && x.stateCode === value.state);
  return <>
    <label>Código postal<input required value={value.postalCode} inputMode={mexican ? "numeric" : "text"} maxLength={mexican ? 5 : 12} pattern={mexican ? "[0-9]{5}" : undefined} onChange={e => { const postalCode = e.target.value; onChange(current => ({ ...current, postalCode, state: "", city: "", district: "" })); }} /></label>
    {mexican ? <>
      <label>Ciudad<select required value={selected ? `${selected.stateCode}|${selected.city}` : ""} onChange={e => { const location = localities.find(x => `${x.stateCode}|${x.city}` === e.target.value); onChange(current => ({ ...current, city: location?.city || "", state: location?.stateCode || "", district: "" })); }}><option value="">Selecciona ciudad</option>{localities.map(x => <option key={`${x.stateCode}|${x.city}`} value={`${x.stateCode}|${x.city}`}>{x.city}</option>)}</select></label>
      <label>Estado<input readOnly required value={selected?.stateName || ""} placeholder="Se obtiene del código postal" /></label>
      <label>Colonia<select required value={selected?.districts.includes(value.district || "") ? value.district : ""} onChange={e => { const district = e.target.value; onChange(current => ({ ...current, district })); }}><option value="">Selecciona colonia</option>{selected?.districts.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
      <div className="envia-field-wide" role="status">{error ? <>{error} <button type="button" onClick={() => setRetry(x => x + 1)}>Reintentar</button></> : /^\d{5}$/.test(value.postalCode) && !result ? "Consultando colonias…" : "Las localidades se obtienen de Envia.com."}</div>
    </> : ([['city', 'Ciudad'], ['state', 'Estado'], ['district', 'Colonia']] as const).map(([field, label]) => <label key={field}>{label}<input required={field !== "district"} value={value[field] || ""} onChange={e => { const next = e.target.value; onChange(current => ({ ...current, [field]: next })); }} /></label>)}
  </>;
}
