"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";
import { EnviaPostalFields } from "./EnviaPostalFields";
import { StoreShippingOrigin } from "./StoreShippingOrigin";
import { shippingDraftKey, type ShippingDraft } from "../lib/shipping-draft";

type Address = { name: string; phone: string; street: string; city: string; state: string; country: string; postalCode: string; district?: string; number?: string; email?: string; interiorNumber?: string; references?: string };
type Parcel = { type: string; content: string; amount: string; declaredValue: string; weight: string; length: string; width: string; height: string };
type StoredPackage = { type?: string; content?: string; amount?: string | number; declaredValue?: string | number; weight?: string | number; dimensions?: { length?: string | number; width?: string | number; height?: string | number } };
type Settings = { environment: "sandbox" | "production"; origin: Partial<Address>; defaultPackage: StoredPackage; tokenConfigured: boolean };
type Rate = { carrier: string; service: string; serviceDescription?: string; deliveryEstimate?: string; deliveryDays?: string | number; totalPrice?: string | number; currency?: string };
type Shipment = { id: string; conversationId?: string | null; customerName?: string | null; customerPhone?: string | null; carrier: string; service: string; trackingNumber?: string | null; labelUrl?: string | null; status: string; price?: string | number | null; currency?: string | null; createdAt: string };
type ShippingCustomer = { id: string; name: string | null; phoneNumber: string };
type SavedAddress = { id: string; kind: "origin" | "destination"; name: string; address: Address };
type SavedPackage = { id: string; name: string; package: StoredPackage };
type SavedPresets = { addresses: SavedAddress[]; packages: SavedPackage[] };

const emptyAddress = (): Address => ({ name: "", phone: "", street: "", city: "", state: "", country: "MX", postalCode: "", district: "", number: "", email: "" });
const emptyParcel = (): Parcel => ({ type: "box", content: "Productos", amount: "1", declaredValue: "0", weight: "1", length: "20", width: "20", height: "20" });
const asParcel = (value?: StoredPackage): Parcel => ({ ...emptyParcel(), type: value?.type || "box", content: value?.content || "Productos", amount: String(value?.amount ?? "1"), declaredValue: String(value?.declaredValue ?? "0"), weight: String(value?.weight ?? "1"), length: String(value?.dimensions?.length ?? "20"), width: String(value?.dimensions?.width ?? "20"), height: String(value?.dimensions?.height ?? "20") });
const asAddress = (value?: Partial<Address>): Address => ({ ...emptyAddress(), ...value });

export function EnviaShippingPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quotedEnvironment, setQuotedEnvironment] = useState<Settings["environment"] | null>(null);
  const [origin, setOrigin] = useState<Address>(emptyAddress());
  const [destination, setDestination] = useState<Address>(emptyAddress());
  const [parcel, setParcel] = useState<Parcel>(emptyParcel());
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<ShippingCustomer[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [savedPresets, setSavedPresets] = useState<SavedPresets>({ addresses: [], packages: [] });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateFilter, setRateFilter] = useState<"all" | "cheapest" | "fastest">("all");
  const [orderDraft, setOrderDraft] = useState<ShippingDraft | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let draft: ShippingDraft | null = null;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(shippingDraftKey); draft = raw ? JSON.parse(raw) : null; } catch { /* Ignore malformed draft. */ }
    const load = async () => {
      try {
        const [nextSettings, nextShipments, nextPresets, nextCustomers, store] = await Promise.all([
          request<Settings>("/shipping/settings"), request<Shipment[]>("/shipping/shipments"), request<SavedPresets>("/shipping/saved"), request<ShippingCustomer[]>("/shipping/customers"),
          draft?.source === "order" ? request<{configured:boolean;isCheckoutOrganization:boolean;origin:Partial<Address>;environment:Settings["environment"]}>("/shipping/store-origin") : Promise.resolve(null)
        ]);
        if (!active) return;
        setShipments(nextShipments); setSavedPresets(nextPresets); setCustomers(nextCustomers);
        if (draft?.destination) setDestination(asAddress(draft.destination));
        if (draft?.conversationId) setConversationId(draft.conversationId);
        if (draft?.source === "order") setOrderDraft(draft);
        if (store && (!store.configured || !store.isCheckoutOrganization)) throw new Error("Configura el origen de la tienda para esta organización antes de cotizar el pedido. Después pulsa Reintentar carga.");
        setSettings(store ? {...nextSettings,environment:store.environment} : nextSettings);
        setOrigin(asAddress(store?.origin || nextSettings.origin));
        // Apply the order package AFTER loading defaults so they cannot overwrite it.
        setParcel(asParcel(draft?.package || nextSettings.defaultPackage));
        if (draft?.source === "order") setNotice(`Pedido ${draft.orderFolio}: dirección y paquete cargados. Revisa los datos y pulsa Cotizar. Las medidas usan las reglas de empaque actuales.`);
        else if (draft?.destination) setNotice("Destino cargado desde la conversación. Elige el paquete y cotiza.");
        try { if (sessionStorage.getItem(shippingDraftKey) === raw) sessionStorage.removeItem(shippingDraftKey); } catch { /* Storage unavailable. */ }
      } catch (error) { if (active) setNotice(error instanceof Error ? error.message : "No fue posible cargar Envia."); }
    };
    void load();
    return () => { active = false; };
  }, [loadRevision]);

  const packagePayload = useMemo(() => ({ type: parcel.type, content: parcel.content, amount: Number(parcel.amount), declaredValue: Number(parcel.declaredValue), lengthUnit: "CM" as const, weightUnit: "KG" as const, weight: Number(parcel.weight), dimensions: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) } }), [parcel]);
  const quotePayload = (rate?: Rate) => ({ destination, packages: [packagePayload], settings:{comments:[orderDraft?.orderFolio,destination.interiorNumber ? `Interior: ${destination.interiorNumber}` : "",destination.references].filter(Boolean).join(" · ").slice(0,500)}, ...(conversationId ? { conversationId } : {}), ...(rate ? { carrier: rate.carrier, service: rate.service } : {}) });
  const setAddressField = (target: "origin" | "destination", field: keyof Address, value: string) => target === "origin" ? setOrigin(current => ({ ...current, [field]: value })) : setDestination(current => ({ ...current, [field]: value }));
  const saveSettings = async () => request<Settings>("/shipping/settings", { method: "PUT", body: JSON.stringify({ environment: settings?.environment || "sandbox", origin, defaultPackage: packagePayload }) });
  const saveAddressPreset = async (kind: "origin" | "destination") => {
    const address = kind === "origin" ? origin : destination;
    const suggestedName = `${kind === "origin" ? "Origen" : "Destinatario"} · ${address.name || address.city || "sin nombre"}`;
    const name = window.prompt("Nombre para identificar esta dirección", suggestedName)?.trim();
    if (!name) return;
    try {
      const preset = await request<SavedAddress>("/shipping/saved/addresses", { method: "POST", body: JSON.stringify({ kind, name, address }) });
      setSavedPresets(current => ({ ...current, addresses: [preset, ...current.addresses] })); setNotice("Dirección guardada para futuras cotizaciones.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar la dirección."); }
  };
  const savePackagePreset = async () => {
    const name = window.prompt("Nombre para identificar este paquete", parcel.content || "Paquete")?.trim();
    if (!name) return;
    try {
      const preset = await request<SavedPackage>("/shipping/saved/packages", { method: "POST", body: JSON.stringify({ name, package: packagePayload }) });
      setSavedPresets(current => ({ ...current, packages: [preset, ...current.packages] })); setNotice("Paquete guardado para futuras cotizaciones.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el paquete."); }
  };

  const quote = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(""); setRates([]); setSelectedRate(null);
    try {
      const saved = await saveSettings(); setSettings(saved);
      const result = await request<{ environment: Settings["environment"]; rates: Rate[]; unavailableCarriers?: string[] }>("/shipping/quote", { method: "POST", body: JSON.stringify(quotePayload()) });
      setQuotedEnvironment(result.environment);
      setSettings(current => current ? { ...current, environment: result.environment } : current);
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
      const shipment = await request<Shipment>("/shipping/generate", { method: "POST", body: JSON.stringify({ ...quotePayload(selectedRate), environment: quotedEnvironment, settings: { ...quotePayload(selectedRate).settings, printFormat: "PDF", printSize: "STOCK_4X6" } }) });
      setShipments(current => [shipment, ...current]); setNotice(`Guía generada${shipment.trackingNumber ? `: ${shipment.trackingNumber}` : ""}.`); setRates([]); setSelectedRate(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar la guía."); }
    finally { setBusy(false); }
  };

  const addressFields = (target: "origin" | "destination", value: Address) => <div className="envia-address-fields">
    {([['name', 'Nombre completo'], ['email', 'Correo'], ['phone', 'Teléfono'], ['street', 'Calle'], ['number', 'Número'], ['country', 'País'], ...(target === "destination" ? [['interiorNumber','Número interior'],['references','Referencias']] : [])] as [keyof Address, string][]).map(([field, label]) => <label key={field} className={field === "street" || field === "references" ? "envia-field-wide" : ""}>{label}
      <input value={value[field] || ""} maxLength={field === "country" ? 2 : field === "references" ? 300 : field === "interiorNumber" ? 30 : undefined} placeholder={field === "country" ? "MX" : label} onChange={event => setAddressField(target, field, field === "country" ? event.target.value.toUpperCase() : event.target.value)} required={!['district', 'email', 'number','interiorNumber','references'].includes(field)} />
    </label>)}
    <EnviaPostalFields value={value} onChange={target === "origin" ? setOrigin : setDestination} />
  </div>;
  const orderedRates = useMemo(() => [...rates].sort((a, b) => {
    if (rateFilter === "cheapest") return Number(a.totalPrice || Number.MAX_SAFE_INTEGER) - Number(b.totalPrice || Number.MAX_SAFE_INTEGER);
    if (rateFilter === "fastest") return Number(a.deliveryDays || Number.MAX_SAFE_INTEGER) - Number(b.deliveryDays || Number.MAX_SAFE_INTEGER);
    return 0;
  }), [rates, rateFilter]);
  const presetsFor = (kind: "origin" | "destination") => savedPresets.addresses.filter(preset => preset.kind === kind);
  const addressPresetControls = (kind: "origin" | "destination") => <div className="envia-preset-controls"><select defaultValue="" onChange={event => { const preset = presetsFor(kind).find(item => item.id === event.target.value); if (preset) kind === "origin" ? setOrigin(asAddress(preset.address)) : setDestination(asAddress(preset.address)); event.currentTarget.value = ""; }}><option value="">Usar dirección guardada…</option>{presetsFor(kind).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><button type="button" onClick={() => void saveAddressPreset(kind)}>＋ Guardar</button></div>;
  const packagePresetControls = <div className="envia-preset-controls"><select defaultValue="" onChange={event => { const preset = savedPresets.packages.find(item => item.id === event.target.value); if (preset) setParcel(asParcel(preset.package)); event.currentTarget.value = ""; }}><option value="">Usar paquete guardado…</option>{savedPresets.packages.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><button type="button" onClick={() => void savePackagePreset()}>＋ Guardar</button></div>;

  return <section className="envia-panel"><header><div><p>LOGÍSTICA</p><h1>Cotizar y generar envío</h1><span>Compara automáticamente las paqueterías disponibles para tu ruta.</span></div><b className={settings?.tokenConfigured ? "envia-status ready" : "envia-status"}>{settings?.tokenConfigured ? "● API conectada" : "○ Falta ENVIA_TOKEN"}</b></header>{notice && <div className="envia-notice">{notice}</div>}
    <StoreShippingOrigin />
    {!settings && notice && <button type="button" onClick={()=>setLoadRevision(n=>n+1)}>Reintentar carga</button>}
    {orderDraft && <section className="envia-card" aria-label="Pedido a enviar"><h2>{orderDraft.orderFolio}</h2><ul>{orderDraft.orderLines?.map((line,index)=><li key={index}>{line.quantity} × {line.name}</li>)}</ul><p>{orderDraft.pairs} pares · 1 caja consolidada. El peso incluye el empaque. Puedes revisar y ajustar el paquete antes de cotizar.</p><small>Preparar este formulario no cobra el envío ni genera una guía.</small></section>}
    <form className="envia-quote-form" onSubmit={quote}>
      <div className="envia-quote-columns">
        <section className="envia-form-column"><div className="envia-column-title"><span>▣</span><div><b>Origen</b><small>Remitente</small></div></div>{addressPresetControls("origin")}<div className="envia-environment"><p>Ambiente: {settings?.environment === "production" ? "Producción" : "Desarrollo"} · Se administra en Feature.</p></div>{addressFields("origin", origin)}</section>
        <section className="envia-form-column"><div className="envia-column-title"><span>⌖</span><div><b>Destino</b><small>Datos del cliente</small></div></div><div className="envia-customer-link"><label>Cliente de MerlynSeller<select value={conversationId} onChange={event => { const id = event.target.value; setConversationId(id); const customer = customers.find(item => item.id === id); if (customer) setDestination(current => ({ ...current, name: current.name || customer.name || "", phone: current.phone || customer.phoneNumber })); }}><option value="">Sin asociar a una conversación</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || "Cliente sin nombre"} · {customer.phoneNumber}</option>)}</select></label><small>La guía quedará vinculada a este cliente y su conversación.</small></div>{addressPresetControls("destination")}{addressFields("destination", destination)}</section>
        <section className="envia-form-column envia-package-column"><div className="envia-column-title"><span>▣</span><div><b>Paquete</b><small>Caja #1</small></div></div>{packagePresetControls}<div className="envia-package-fields"><label className="envia-field-wide">Contenido<input value={parcel.content} onChange={event => setParcel(current => ({ ...current, content: event.target.value }))} required /></label><label>Largo <span>cm</span><input value={parcel.length} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, length: event.target.value }))} required /></label><label>Ancho <span>cm</span><input value={parcel.width} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, width: event.target.value }))} required /></label><label>Alto <span>cm</span><input value={parcel.height} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, height: event.target.value }))} required /></label><label>Peso <span>kg</span><input value={parcel.weight} type="number" min="0.01" step="any" onChange={event => setParcel(current => ({ ...current, weight: event.target.value }))} required /></label><label>Valor declarado<input value={parcel.declaredValue} type="number" min="0" step="any" onChange={event => setParcel(current => ({ ...current, declaredValue: event.target.value }))} required /></label></div><p className="envia-package-help">Las tarifas se consultarán con todas las paqueterías activas.</p></section>
      </div>
      <div className="envia-quote-actions"><span>Las direcciones y el paquete predeterminado se guardarán antes de cotizar.</span><button className="envia-primary" disabled={busy || !settings?.tokenConfigured}>{busy ? "Consultando paqueterías…" : "Cotizar todas las paqueterías"}</button></div>
    </form>
    {rates.length > 0 && <section className="envia-card envia-results"><div className="envia-results-header"><div><p>RESULTADOS</p><h2>Elige el servicio para generar la guía</h2><span>{rates.length} tarifa(s) encontrada(s) entre las paqueterías disponibles.</span></div><div className="envia-rate-filters"><button type="button" className={rateFilter === "all" ? "active" : ""} onClick={() => setRateFilter("all")}>Todos</button><button type="button" className={rateFilter === "cheapest" ? "active" : ""} onClick={() => setRateFilter("cheapest")}>Más económico</button><button type="button" className={rateFilter === "fastest" ? "active" : ""} onClick={() => setRateFilter("fastest")}>Más rápido</button></div></div><div className="envia-rate-list">{orderedRates.map((rate, index) => <button className={selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "selected" : ""} type="button" key={`${rate.carrier}-${rate.service}-${index}`} onClick={() => setSelectedRate(rate)}><span className="envia-rate-carrier">{rate.carrier}</span><div><b>{rate.serviceDescription || rate.service}</b><small>{rate.service}</small></div><span>{rate.deliveryEstimate || (rate.deliveryDays ? `${rate.deliveryDays} días estimados` : "Tiempo por confirmar")}</span><strong>{rate.currency || "MXN"} {rate.totalPrice ?? "—"}</strong><span className="envia-rate-choose">{selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "Seleccionado" : "Elegir"}</span></button>)}</div><button type="button" className="envia-primary" disabled={!selectedRate || busy} onClick={() => void generate()}>Generar guía seleccionada</button></section>}
    <section className="envia-card"><div className="envia-card-heading"><div><h2>Guías generadas</h2><p>Consulta su rastreo y descarga la etiqueta cuando esté disponible.</p></div></div>{shipments.length ? <div className="envia-shipments">{shipments.map(shipment => <article key={shipment.id}><div><b>{shipment.carrier} · {shipment.service}</b><span>{shipment.customerName ? `Cliente: ${shipment.customerName}${shipment.customerPhone ? ` · ${shipment.customerPhone}` : ""}` : "Sin cliente asociado"}</span><span>{shipment.trackingNumber || "Rastreo pendiente"} · {shipment.status}</span></div>{shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer">Abrir guía PDF ↗</a>}</article>)}</div> : <p className="envia-empty">Aún no hay guías generadas.</p>}</section>
  </section>;
}
