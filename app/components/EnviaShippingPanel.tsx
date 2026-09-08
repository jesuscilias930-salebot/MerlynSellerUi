"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";

type Address = { name: string; phone: string; street: string; city: string; state: string; country: string; postalCode: string; district?: string; number?: string; email?: string };
type Parcel = { type: string; content: string; amount: string; declaredValue: string; weight: string; length: string; width: string; height: string };
type StoredPackage = { type?: string; content?: string; amount?: string | number; declaredValue?: string | number; weight?: string | number; dimensions?: { length?: string | number; width?: string | number; height?: string | number } };
type Settings = { environment: "sandbox" | "production"; origin: Partial<Address>; defaultPackage: StoredPackage; tokenConfigured: boolean };
type Rate = { carrier: string; service: string; serviceDescription?: string; deliveryEstimate?: string; totalPrice?: string | number; currency?: string };
type Shipment = { id: string; carrier: string; service: string; trackingNumber?: string | null; labelUrl?: string | null; status: string; price?: string | number | null; currency?: string | null; createdAt: string };

const emptyAddress = (): Address => ({ name: "", phone: "", street: "", city: "", state: "", country: "MX", postalCode: "", district: "", number: "", email: "" });
const emptyParcel = (): Parcel => ({ type: "box", content: "Productos", amount: "1", declaredValue: "0", weight: "1", length: "20", width: "20", height: "20" });
const asParcel = (value?: StoredPackage): Parcel => ({ ...emptyParcel(), type: value?.type || "box", content: value?.content || "Productos", amount: String(value?.amount ?? "1"), declaredValue: String(value?.declaredValue ?? "0"), weight: String(value?.weight ?? "1"), length: String(value?.dimensions?.length ?? "20"), width: String(value?.dimensions?.width ?? "20"), height: String(value?.dimensions?.height ?? "20") });
const asAddress = (value?: Partial<Address>): Address => ({ ...emptyAddress(), ...value });

export function EnviaShippingPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [origin, setOrigin] = useState<Address>(emptyAddress());
  const [destination, setDestination] = useState<Address>(emptyAddress());
  const [parcel, setParcel] = useState<Parcel>(emptyParcel());
  const [carrier, setCarrier] = useState("dhl");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [nextSettings, nextShipments] = await Promise.all([request<Settings>("/shipping/settings"), request<Shipment[]>("/shipping/shipments")]);
      setSettings(nextSettings); setOrigin(asAddress(nextSettings.origin)); setParcel(asParcel(nextSettings.defaultPackage)); setShipments(nextShipments);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cargar Envia."); }
  };
  useEffect(() => { void load(); }, []);

  const packagePayload = useMemo(() => ({ type: parcel.type, content: parcel.content, amount: Number(parcel.amount), declaredValue: Number(parcel.declaredValue), lengthUnit: "CM" as const, weightUnit: "KG" as const, weight: Number(parcel.weight), dimensions: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) } }), [parcel]);
  const quotePayload = (service?: string) => ({ destination, packages: [packagePayload], carrier, ...(service ? { service } : {}) });
  const setAddressField = (target: "origin" | "destination", field: keyof Address, value: string) => target === "origin" ? setOrigin(current => ({ ...current, [field]: value })) : setDestination(current => ({ ...current, [field]: value }));

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const saved = await request<Settings>("/shipping/settings", { method: "PUT", body: JSON.stringify({ environment: settings?.environment || "sandbox", origin, defaultPackage: packagePayload }) });
      setSettings(saved); setNotice("Configuración de Envia guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar la configuración."); }
    finally { setBusy(false); }
  };
  const quote = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(""); setRates([]); setSelectedRate(null);
    try { const result = await request<{ rates: Rate[] }>("/shipping/quote", { method: "POST", body: JSON.stringify(quotePayload()) }); setRates(result.rates || []); if (!(result.rates || []).length) setNotice("No hubo tarifas disponibles para esta ruta y paquete."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cotizar."); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    if (!selectedRate || !window.confirm(`¿Generar guía con ${selectedRate.carrier} ${selectedRate.service}? Esta acción puede generar un cargo.`)) return;
    setBusy(true); setNotice("");
    try {
      const shipment = await request<Shipment>("/shipping/generate", { method: "POST", body: JSON.stringify({ ...quotePayload(selectedRate.service), carrier: selectedRate.carrier, settings: { printFormat: "PDF", printSize: "STOCK_4X6" } }) });
      setShipments(current => [shipment, ...current]); setNotice(`Guía generada${shipment.trackingNumber ? `: ${shipment.trackingNumber}` : ""}.`); setRates([]); setSelectedRate(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar la guía."); }
    finally { setBusy(false); }
  };
  const addressFields = (target: "origin" | "destination", value: Address) => <div className="envia-address-fields">{([['name', 'Nombre'], ['phone', 'Teléfono'], ['street', 'Calle y número'], ['district', 'Colonia'], ['postalCode', 'Código postal'], ['city', 'Ciudad'], ['state', 'Estado'], ['country', 'País (MX)'], ['email', 'Correo (opcional)']] as [keyof Address, string][]).map(([field, label]) => <label key={field}>{label}<input value={value[field] || ""} maxLength={field === "country" ? 2 : undefined} onChange={event => setAddressField(target, field, field === "country" ? event.target.value.toUpperCase() : event.target.value)} required={!['district', 'email'].includes(field)} /></label>)}</div>;

  return <section className="envia-panel"><header><div><p>LOGÍSTICA</p><h1>Envíos con Envia</h1><span>Cotiza, genera guías y consulta rastreos desde MerlynSeller.</span></div><b className={settings?.tokenConfigured ? "envia-status ready" : "envia-status"}>{settings?.tokenConfigured ? "● API conectada" : "○ Falta ENVIA_TOKEN"}</b></header>{notice && <div className="envia-notice">{notice}</div>}
    <form className="envia-card" onSubmit={saveSettings}><div className="envia-card-heading"><div><h2>1. Origen de los envíos</h2><p>Esta dirección se usará como remitente en cada cotización.</p></div><select value={settings?.environment || "sandbox"} onChange={event => setSettings(current => ({ ...(current || { origin: {}, defaultPackage: {}, tokenConfigured: false }), environment: event.target.value as Settings["environment"] }))}><option value="sandbox">Sandbox · pruebas</option><option value="production">Producción · guías reales</option></select></div>{addressFields("origin", origin)}<h3>Paquete predeterminado</h3><div className="envia-package-fields">{([['content', 'Contenido'], ['weight', 'Peso kg'], ['length', 'Largo cm'], ['width', 'Ancho cm'], ['height', 'Alto cm'], ['declaredValue', 'Valor declarado']] as [keyof Parcel, string][]).map(([field, label]) => <label key={field}>{label}<input value={parcel[field]} type={field === 'content' ? 'text' : 'number'} min="0" step="any" onChange={event => setParcel(current => ({ ...current, [field]: event.target.value }))} required /></label>)}</div><button className="envia-primary" disabled={busy}>Guardar origen</button></form>
    <form className="envia-card" onSubmit={quote}><div className="envia-card-heading"><div><h2>2. Cotizar envío</h2><p>Completa el destino y compara los servicios del transportista.</p></div><label className="envia-carrier">Transportista<input value={carrier} onChange={event => setCarrier(event.target.value.toLowerCase())} placeholder="dhl" required /></label></div>{addressFields("destination", destination)}<button className="envia-primary" disabled={busy || !settings?.tokenConfigured}>{busy ? "Consultando…" : "Cotizar envío"}</button></form>
    {rates.length > 0 && <section className="envia-card"><div className="envia-card-heading"><div><h2>3. Elige una tarifa</h2><p>Confirma antes de comprar una guía.</p></div></div><div className="envia-rates">{rates.map((rate, index) => <button className={selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "selected" : ""} type="button" key={`${rate.carrier}-${rate.service}-${index}`} onClick={() => setSelectedRate(rate)}><b>{rate.serviceDescription || rate.service}</b><span>{rate.carrier} · {rate.deliveryEstimate || "Sin estimado"}</span><strong>{rate.currency || "MXN"} {rate.totalPrice ?? "—"}</strong></button>)}</div><button type="button" className="envia-primary" disabled={!selectedRate || busy} onClick={() => void generate()}>Generar guía seleccionada</button></section>}
    <section className="envia-card"><div className="envia-card-heading"><div><h2>Guías generadas</h2><p>Consulta su rastreo y descarga la etiqueta cuando esté disponible.</p></div></div>{shipments.length ? <div className="envia-shipments">{shipments.map(shipment => <article key={shipment.id}><div><b>{shipment.carrier} · {shipment.service}</b><span>{shipment.trackingNumber || "Rastreo pendiente"} · {shipment.status}</span></div>{shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer">Abrir guía PDF ↗</a>}</article>)}</div> : <p className="envia-empty">Aún no hay guías generadas.</p>}</section>
  </section>;
}
