"use client";

import { FormEvent, useEffect, useState } from "react";
import { request } from "../lib/api";
import { EnviaPostalFields } from "./EnviaPostalFields";

type Address = { name: string; phone: string; street: string; number: string; email: string; country: string; postalCode: string; state: string; city: string; district: string };
type Settings = { origin: Partial<Address>; environment: "sandbox" | "production"; configured: boolean; isCheckoutOrganization: boolean };
const empty: Address = { name: "", phone: "", street: "", number: "", email: "", country: "MX", postalCode: "", state: "", city: "", district: "" };

export function StoreShippingOrigin() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [address, setAddress] = useState<Address>(empty);
  const [environment, setEnvironment] = useState<Settings["environment"]>("sandbox");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<Settings>("/shipping/store-origin", { signal: controller.signal }).then(data => {
      setSaved(data); setAddress({ ...empty, ...data.origin }); setEnvironment(data.environment); setEditing(!data.configured); setNotice("");
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se pudo cargar el origen de la tienda."); });
    return () => controller.abort();
  }, [retry]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const data = await request<Settings>("/shipping/store-origin", { method: "PUT", body: JSON.stringify({ environment, origin: { ...address, email: address.email.trim() || undefined } }) });
      setSaved(data); setAddress({ ...empty, ...data.origin }); setEditing(false);
      setNotice("Origen guardado. Se usará en las siguientes cotizaciones del carrito.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el origen."); }
    finally { setBusy(false); }
  };
  return <section className="envia-card" aria-label="Origen de la tienda online">
    <div className="envia-card-heading"><div><h2>Origen de la tienda online</h2><p>Dirección desde la que salen los pedidos del carrito. Las cotizaciones manuales de abajo no modifican este origen.</p></div>
      {saved && !editing && <button type="button" onClick={() => setEditing(true)}>Editar origen de la tienda</button>}
    </div>
    {notice && <p role="status" className="envia-notice">{notice}</p>}
    {!saved && (notice ? <button type="button" onClick={() => setRetry(n => n + 1)}>Reintentar carga</button> : <p role="status">Cargando origen de la tienda…</p>)}
    {saved && !saved.isCheckoutOrganization && <p role="alert" className="envia-notice">Esta organización no está vinculada al carrito mediante STORE_ORGANIZATION_ID. Guardar aquí no cambiará el origen usado por la tienda actual.</p>}
    {saved && !editing && <div><strong>{saved.origin.name}</strong><p>{[saved.origin.street, saved.origin.number, saved.origin.district, saved.origin.city, saved.origin.state, saved.origin.postalCode, saved.origin.country].filter(Boolean).join(", ")}</p><small>{saved.environment === "production" ? "Producción" : "Sandbox · pruebas"}</small></div>}
    {saved && editing && <form onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="envia-address-fields">
          <p className="envia-field-wide">Ambiente: {environment === "production" ? "Producción" : "Desarrollo"} · Se administra en Feature.</p>
          {([['name', 'Nombre del remitente'], ['phone', 'Teléfono'], ['email', 'Correo (opcional)'], ['street', 'Calle'], ['number', 'Número'], ['country', 'País (código)']] as const).map(([field, label]) => <label key={field}>{label}<input value={address[field]} type={field === "email" ? "email" : "text"} maxLength={field === "country" ? 2 : 160} required={field !== "email" && field !== "number"} onChange={e => { const value = field === "country" ? e.target.value.toUpperCase() : e.target.value; setAddress(current => ({ ...current, [field]: value })); }} /></label>)}
          <EnviaPostalFields value={address} onChange={setAddress} />
        </div>
        <div className="envia-quote-actions"><span>Solo propietarios y administradores pueden guardar cambios. El token debe corresponder al ambiente elegido.</span><button className="envia-primary" type="submit">{busy ? "Guardando…" : "Guardar origen de la tienda"}</button>
          {saved.configured && <button type="button" onClick={() => { setAddress({ ...empty, ...saved.origin }); setEnvironment(saved.environment); setEditing(false); }}>Cancelar</button>}
        </div>
      </fieldset>
    </form>}
  </section>;
}
