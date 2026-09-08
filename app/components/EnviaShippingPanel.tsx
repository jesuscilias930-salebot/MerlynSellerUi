"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";

type Address = { name: string; phone: string; street: string; city: string; state: string; country: string; postalCode: string; district?: string; number?: string; email?: string };
type Parcel = { type: string; content: string; amount: string; declaredValue: string; weight: string; length: string; width: string; height: string };
type StoredPackage = { type?: string; content?: string; amount?: string | number; declaredValue?: string | number; weight?: string | number; dimensions?: { length?: string | number; width?: string | number; height?: string | number } };
type Settings = { environment: "sandbox" | "production"; origin: Partial<Address>; defaultPackage: StoredPackage; tokenConfigured: boolean };
type Rate = { carrier: string; service: string; serviceDescription?: string; deliveryEstimate?: string; deliveryDays?: string | number; totalPrice?: string | number; currency?: string };
type Shipment = { id: string; carrier: string; service: string; trackingNumber?: string | null; labelUrl?: string | null; status: string; price?: string | number | null; currency?: string | null; createdAt: string };

const emptyAddress = (): Address => ({ name: "", phone: "", street: "", city: "", state: "", country: "MX", postalCode: "", district: "", number: "", email: "" });
const emptyParcel = (): Parcel => ({ type: "box", content: "Productos", amount: "1", declaredValue: "0", weight: "1", length: "20", width: "20", height: "20" });
const asParcel = (value?: StoredPackage): Parcel => ({ ...emptyParcel(), type: value?.type || "box", content: value?.content || "Productos", amount: String(value?.amount ?? "1"), declaredValue: String(value?.declaredValue ?? "0"), weight: String(value?.weight ?? "1"), length: String(value?.dimensions?.length ?? "20"), width: String(value?.dimensions?.width ?? "20"), height: String(value?.dimensions?.height ?? "20") });
const asAddress = (value?: Partial<Address>): Address => ({ ...emptyAddress(), ...value });
const mexicoStates = [
  ["AG", "Aguascalientes"], ["BC", "Baja California"], ["BS", "Baja California Sur"], ["CM", "Campeche"], ["CS", "Chiapas"], ["CH", "Chihuahua"], ["CX", "Ciudad de México"], ["CL", "Coahuila"], ["CO", "Colima"], ["DG", "Durango"], ["GT", "Guanajuato"], ["GR", "Guerrero"], ["HG", "Hidalgo"], ["JC", "Jalisco"], ["ME", "Estado de México"], ["MI", "Michoacán"], ["MO", "Morelos"], ["NA", "Nayarit"], ["NL", "Nuevo León"], ["OA", "Oaxaca"], ["PU", "Puebla"], ["QT", "Querétaro"], ["QR", "Quintana Roo"], ["SL", "San Luis Potosí"], ["SI", "Sinaloa"], ["SO", "Sonora"], ["TB", "Tabasco"], ["TL", "Tlaxcala"], ["VE", "Veracruz"], ["YU", "Yucatán"], ["ZA", "Zacatecas"],
] as const;

export function EnviaShippingPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [origin, setOrigin] = useState<Address>(emptyAddress());
  const [destination, setDestination] = useState<Address>(emptyAddress());
  const [parcel, setParcel] = useState<Parcel>(emptyParcel());
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateFilter, setRateFilter] = useState<"all" | "cheapest" | "fastest">("all");

  const load = async () => {
    try {
      const [nextSettings, nextShipments] = await Promise.all([request<Settings>("/shipping/settings"), request<Shipment[]>("/shipping/shipments")]);
      setSettings(nextSettings); setOrigin(asAddress(nextSettings.origin)); setParcel(asParcel(nextSettings.defaultPackage)); setShipments(nextShipments);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cargar Envia."); }
  };
  useEffect(() => { void load(); }, []);

  const packagePayload = useMemo(() => ({ type: parcel.type, content: parcel.content, amount: Number(parcel.amount), declaredValue: Number(parcel.declaredValue), lengthUnit: "CM" as const, weightUnit: "KG" as const, weight: Number(parcel.weight), dimensions: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) } }), [parcel]);
  const quotePayload = (rate?: Rate) => ({ destination, packages: [packagePayload], ...(rate ? { carrier: rate.carrier, service: rate.service } : {}) });
  const setAddressField = (target: "origin" | "destination", field: keyof Address, value: string) => target === "origin" ? setOrigin(current => ({ ...current, [field]: value })) : setDestination(current => ({ ...current, [field]: value }));
  const saveSettings = async () => request<Settings>("/shipping/settings", { method: "PUT", body: JSON.stringify({ environment: settings?.environment || "sandbox", origin, defaultPackage: packagePayload }) });

  const quote = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(""); setRates([]); setSelectedRate(null);
    try {
      const saved = await saveSettings(); setSettings(saved);
      const result = await request<{ rates: Rate[]; unavailableCarriers?: string[] }>("/shipping/quote", { method: "POST", body: JSON.stringify(quotePayload()) });
      const nextRates = result.rates || [];
      setRates(nextRates);
      if (!nextRates.length) setNotice("No hubo tarifas disponibles para esta ruta y paquete.");
      else if (result.unavailableCarriers?.length) setNotice(`Mostramos las tarifas disponibles. ${result.unavailableCarriers.length} paquetería(s) no respondió(ieron) para esta ruta.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cotizar."); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    if (!selectedRate || !window.confirm(`¿Generar guía con ${selectedRate.carrier} ${selectedRate.service}? Esta acción puede generar un cargo.`)) return;
    setBusy(true); setNotice("");
    try {
      const shipment = await request<Shipment>("/shipping/generate", { method: "POST", body: JSON.stringify({ ...quotePayload(selectedRate), settings: { printFormat: "PDF", printSize: "STOCK_4X6" } }) });
      setShipments(current => [shipment, ...current]); setNotice(`Guía generada${shipment.trackingNumber ? `: ${shipment.trackingNumber}` : ""}.`); setRates([]); setSelectedRate(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar la guía."); }
    finally { setBusy(false); }
  };

  const addressFields = (target: "origin" | "destination", value: Address) => <div className="envia-address-fields">
    {([['name', 'Nombre completo'], ['email', 'Correo'], ['phone', 'Teléfono'], ['street', 'Calle'], ['number', 'Número'], ['postalCode', 'Código postal'], ['district', 'Colonia'], ['city', 'Ciudad'], ['state', 'Estado'], ['country', 'País']] as [keyof Address, string][]).map(([field, label]) => <label key={field} className={field === "street" ? "envia-field-wide" : ""}>{label}
      {field === "state" && value.country === "MX" ? <select value={value.state || ""} onChange={event => setAddressField(target, field, event.target.value)} required><option value="">Selecciona tu estado</option>{mexicoStates.map(([code, name]) => <option value={code} key={code}>{name} ({code})</option>)}</select> : <input value={value[field] || ""} maxLength={field === "country" ? 2 : undefined} placeholder={field === "country" ? "MX" : label} onChange={event => setAddressField(target, field, field === "country" ? event.target.value.toUpperCase() : event.target.value)} required={!['district', 'email', 'number'].includes(field)} />}
    </label>)}
  </div>;
  const orderedRates = useMemo(() => [...rates].sort((a, b) => {
    if (rateFilter === "cheapest") return Number(a.totalPrice || Number.MAX_SAFE_INTEGER) - Number(b.totalPrice || Number.MAX_SAFE_INTEGER);
    if (rateFilter === "fastest") return Number(a.deliveryDays || Number.MAX_SAFE_INTEGER) - Number(b.deliveryDays || Number.MAX_SAFE_INTEGER);
    return 0;
  }), [rates, rateFilter]);

  return <section className="envia-panel"><header><div><p>LOGÍSTICA</p><h1>Cotizar y generar envío</h1><span>Compara automáticamente las paqueterías disponibles para tu ruta.</span></div><b className={settings?.tokenConfigured ? "envia-status ready" : "envia-status"}>{settings?.tokenConfigured ? "● API conectada" : "○ Falta ENVIA_TOKEN"}</b></header>{notice && <div className="envia-notice">{notice}</div>}
    <form className="envia-quote-form" onSubmit={quote}>
      <div className="envia-quote-columns">
        <section className="envia-form-column"><div className="envia-column-title"><span>▣</span><div><b>Origen</b><small>Remitente</small></div></div><div className="envia-environment"><label>Ambiente<select value={settings?.environment || "sandbox"} onChange={event => setSettings(current => ({ ...(current || { origin: {}, defaultPackage: {}, tokenConfigured: false }), environment: event.target.value as Settings["environment"] }))}><option value="sandbox">Sandbox · pruebas</option><option value="production">Producción · guías reales</option></select></label></div>{addressFields("origin", origin)}</section>
        <section className="envia-form-column"><div className="envia-column-title"><span>⌖</span><div><b>Destino</b><small>Datos del cliente</small></div></div>{addressFields("destination", destination)}</section>
        <section className="envia-form-column envia-package-column"><div className="envia-column-title"><span>▣</span><div><b>Paquete</b><small>Caja #1</small></div></div><div className="envia-package-fields"><label className="envia-field-wide">Contenido<input value={parcel.content} onChange={event => setParcel(current => ({ ...current, content: event.target.value }))} required /></label><label>Largo <span>cm</span><input value={parcel.length} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, length: event.target.value }))} required /></label><label>Ancho <span>cm</span><input value={parcel.width} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, width: event.target.value }))} required /></label><label>Alto <span>cm</span><input value={parcel.height} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, height: event.target.value }))} required /></label><label>Peso <span>kg</span><input value={parcel.weight} type="number" min="0.01" step="any" onChange={event => setParcel(current => ({ ...current, weight: event.target.value }))} required /></label><label>Valor declarado<input value={parcel.declaredValue} type="number" min="0" step="any" onChange={event => setParcel(current => ({ ...current, declaredValue: event.target.value }))} required /></label></div><p className="envia-package-help">Las tarifas se consultarán con todas las paqueterías activas.</p></section>
      </div>
      <div className="envia-quote-actions"><span>Las direcciones y el paquete predeterminado se guardarán antes de cotizar.</span><button className="envia-primary" disabled={busy || !settings?.tokenConfigured}>{busy ? "Consultando paqueterías…" : "Cotizar todas las paqueterías"}</button></div>
    </form>
    {rates.length > 0 && <section className="envia-card envia-results"><div className="envia-results-header"><div><p>RESULTADOS</p><h2>Elige el servicio para generar la guía</h2><span>{rates.length} tarifa(s) encontrada(s) entre las paqueterías disponibles.</span></div><div className="envia-rate-filters"><button type="button" className={rateFilter === "all" ? "active" : ""} onClick={() => setRateFilter("all")}>Todos</button><button type="button" className={rateFilter === "cheapest" ? "active" : ""} onClick={() => setRateFilter("cheapest")}>Más económico</button><button type="button" className={rateFilter === "fastest" ? "active" : ""} onClick={() => setRateFilter("fastest")}>Más rápido</button></div></div><div className="envia-rate-list">{orderedRates.map((rate, index) => <button className={selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "selected" : ""} type="button" key={`${rate.carrier}-${rate.service}-${index}`} onClick={() => setSelectedRate(rate)}><span className="envia-rate-carrier">{rate.carrier}</span><div><b>{rate.serviceDescription || rate.service}</b><small>{rate.service}</small></div><span>{rate.deliveryEstimate || (rate.deliveryDays ? `${rate.deliveryDays} días estimados` : "Tiempo por confirmar")}</span><strong>{rate.currency || "MXN"} {rate.totalPrice ?? "—"}</strong><span className="envia-rate-choose">{selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "Seleccionado" : "Elegir"}</span></button>)}</div><button type="button" className="envia-primary" disabled={!selectedRate || busy} onClick={() => void generate()}>Generar guía seleccionada</button></section>}
    <section className="envia-card"><div className="envia-card-heading"><div><h2>Guías generadas</h2><p>Consulta su rastreo y descarga la etiqueta cuando esté disponible.</p></div></div>{shipments.length ? <div className="envia-shipments">{shipments.map(shipment => <article key={shipment.id}><div><b>{shipment.carrier} · {shipment.service}</b><span>{shipment.trackingNumber || "Rastreo pendiente"} · {shipment.status}</span></div>{shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer">Abrir guía PDF ↗</a>}</article>)}</div> : <p className="envia-empty">Aún no hay guías generadas.</p>}</section>
  </section>;
}
