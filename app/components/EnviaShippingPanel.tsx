"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { request } from "../lib/api";
import { controlRequest, controlSession } from "../lib/control-api";
import {bundleShippingPackage,shippingPackageLabel,type ShippingBundle,type StoredShippingPackage} from "../lib/shipping-package";
import type {Chat} from "../lib/types";
import { EnviaPostalFields } from "./EnviaPostalFields";
import { StoreShippingOrigin } from "./StoreShippingOrigin";
import { shippingDraftKey, type ShippingDraft } from "../lib/shipping-draft";
import {readChatShippingDraft,writeChatShippingDraft,type ShippingAddress,type ShippingParcel} from "../lib/chat-shipping-draft";

type Address = ShippingAddress;
type Parcel = ShippingParcel;
type StoredPackage = StoredShippingPackage;
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
const addressPayload = (value: Address) => {
  const address={...value,number:value.number?.trim() || "SN"};
  delete address.interiorNumber;delete address.references;
  if(address.email?.trim())address.email=address.email.trim();else delete address.email;
  return address;
};

export function EnviaShippingPanel({chat,onBusyChange}:{chat?:Chat;onBusyChange?:(busy:boolean)=>void}={}) {
  const [savedChatDraft]=useState(()=>chat?readChatShippingDraft(chat.id):null);
  const defaultsApplied=useRef(false);
  const [defaultsLoaded,setDefaultsLoaded]=useState(false);
  const [draftStorageUnavailable,setDraftStorageUnavailable]=useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quotedEnvironment, setQuotedEnvironment] = useState<Settings["environment"] | null>(null);
  const [origin, setOrigin] = useState<Address>(()=>asAddress(savedChatDraft?.origin));
  const [destination, setDestination] = useState<Address>(()=>asAddress(savedChatDraft?.destination || (chat?{name:chat.name||"",phone:chat.phone_number,country:"MX",number:"SN"}:undefined)));
  const [parcel, setParcel] = useState<Parcel>(()=>savedChatDraft?.parcel || emptyParcel());
  const [rates, setRates] = useState<Rate[]>([]);
  const [quotedFingerprint,setQuotedFingerprint]=useState("");
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<ShippingCustomer[]>([]);
  const [conversationId, setConversationId] = useState(chat?.id || "");
  const [savedPresets, setSavedPresets] = useState<SavedPresets>({ addresses: [], packages: [] });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateFilter, setRateFilter] = useState<"all" | "cheapest" | "fastest">("all");
  const [orderDraft, setOrderDraft] = useState<ShippingDraft | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [pastedInfo,setPastedInfo]=useState(savedChatDraft?.pastedInfo || "");
  const [storeBundles,setStoreBundles]=useState<ShippingBundle[]>([]);
  const [bundleError,setBundleError]=useState("");
  const [bundleLoading,setBundleLoading]=useState(true);
  const [bundleRevision,setBundleRevision]=useState(0);
  const quoteFingerprint=JSON.stringify({origin,destination,parcel,conversationId});
  const ratesCurrent=quotedFingerprint===quoteFingerprint;
  useEffect(()=>{
    if(!chat)return;
    const saved=writeChatShippingDraft({version:1,conversationId:chat.id,pastedInfo,destination,
      ...(defaultsLoaded || savedChatDraft?.origin ? {origin} : {}),
      ...(defaultsLoaded || savedChatDraft?.parcel ? {parcel} : {})});
    let active=true;
    void Promise.resolve().then(()=>{if(active)setDraftStorageUnavailable(!saved);});
    return ()=>{active=false;};
  },[chat,pastedInfo,destination,origin,parcel,defaultsLoaded,savedChatDraft]);
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(()=>{
    const controller=new AbortController();
    void Promise.resolve().then(()=>{
      if(!controlSession.get())throw new Error("Inicia sesión en Control de ventas y reintenta para consultar los bundles de E-commerce.");
      return controlRequest<ShippingBundle[]>("/bundles",{signal:controller.signal,cache:"no-store"});
    }).then(data=>{
      if(!controller.signal.aborted){if(!Array.isArray(data))throw new Error("La lista de bundles no es válida.");setStoreBundles(data);}
    }).catch(error=>{if(!controller.signal.aborted)setBundleError(error instanceof Error?error.message:"No fue posible cargar los bundles.");}).finally(()=>{if(!controller.signal.aborted)setBundleLoading(false);});
    return ()=>controller.abort();
  },[bundleRevision]);

  useEffect(() => {
    let active = true;
    let draft: ShippingDraft | null = null;
    let raw: string | null = null;
    if(chat)draft={conversationId:chat.id,destination:{name:chat.name||"",phone:chat.phone_number,country:"MX",number:"SN"}};
    else try { raw = sessionStorage.getItem(shippingDraftKey); draft = raw ? JSON.parse(raw) : null; } catch { /* Ignore malformed draft. */ }
    const load = async () => {
      try {
        const [nextSettings, nextShipments, nextPresets, nextCustomers, store] = await Promise.all([
          request<Settings>("/shipping/settings"), request<Shipment[]>(chat?`/shipping/shipments?conversationId=${encodeURIComponent(chat.id)}`:"/shipping/shipments"), request<SavedPresets>("/shipping/saved"), chat?Promise.resolve([] as ShippingCustomer[]):request<ShippingCustomer[]>("/shipping/customers"),
          draft?.source === "order" ? request<{configured:boolean;isCheckoutOrganization:boolean;origin:Partial<Address>;environment:Settings["environment"]}>("/shipping/store-origin") : Promise.resolve(null)
        ]);
        if (!active) return;
        setShipments(nextShipments); setSavedPresets(nextPresets); setCustomers(nextCustomers);
        if (draft?.source === "order") setOrderDraft(draft);
        if (store && (!store.configured || !store.isCheckoutOrganization)) throw new Error("Configura el origen de la tienda para esta organización antes de cotizar el pedido. Después pulsa Reintentar carga.");
        setSettings(store ? {...nextSettings,environment:store.environment} : nextSettings);
        if(!defaultsApplied.current){
          if (draft?.destination && !chat) setDestination(asAddress(draft.destination));
          if (draft?.conversationId) setConversationId(draft.conversationId);
          setOrigin(asAddress(savedChatDraft?.origin || store?.origin || nextSettings.origin));
          // A chat's local draft takes priority over server defaults, including unfinished fields.
          setParcel(savedChatDraft?.parcel || asParcel(draft?.package || nextSettings.defaultPackage));
          defaultsApplied.current=true;setDefaultsLoaded(true);
        }
        if (draft?.source === "order") setNotice(`Pedido ${draft.orderFolio}: dirección y paquete cargados. Revisa los datos y pulsa Cotizar. Las medidas usan las reglas de empaque actuales.`);
        else if (draft?.destination) setNotice(savedChatDraft?"Borrador de esta conversación recuperado. Revisa los datos y cotiza de nuevo.":"Destino cargado desde la conversación. Elige el paquete y cotiza.");
        if(!chat)try { if (sessionStorage.getItem(shippingDraftKey) === raw) sessionStorage.removeItem(shippingDraftKey); } catch { /* Storage unavailable. */ }
      } catch (error) { if (active) setNotice(error instanceof Error ? error.message : "No fue posible cargar Envia."); }
    };
    void load();
    return () => { active = false; };
  }, [loadRevision,chat,savedChatDraft]);

  const packagePayload = useMemo(() => ({ type: parcel.type, content: parcel.content, amount: Number(parcel.amount), declaredValue: Number(parcel.declaredValue), lengthUnit: "CM" as const, weightUnit: "KG" as const, weight: Number(parcel.weight), dimensions: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) } }), [parcel]);
  const quotePayload = (rate?: Rate) => ({ destination:addressPayload(destination), packages: [packagePayload], settings:{comments:[orderDraft?.orderFolio,destination.interiorNumber ? `Interior: ${destination.interiorNumber}` : "",destination.references].filter(Boolean).join(" · ").slice(0,500)}, ...(conversationId ? { conversationId } : {}), ...(rate ? { carrier: rate.carrier, service: rate.service } : {}) });
  const setAddressField = (target: "origin" | "destination", field: keyof Address, value: string) => target === "origin" ? setOrigin(current => ({ ...current, [field]: value })) : setDestination(current => ({ ...current, [field]: value }));
  const saveSettings = async () => request<Settings>("/shipping/settings", { method: "PUT", body: JSON.stringify({ environment: settings?.environment || "sandbox", origin:addressPayload(origin), defaultPackage: packagePayload }) });
  const saveAddressPreset = async (kind: "origin" | "destination") => {
    const address = kind === "origin" ? origin : destination;
    const suggestedName = `${kind === "origin" ? "Origen" : "Destinatario"} · ${address.name || address.city || "sin nombre"}`;
    const name = window.prompt("Nombre para identificar esta dirección", suggestedName)?.trim();
    if (!name) return;
    try {
      const preset = await request<SavedAddress>("/shipping/saved/addresses", { method: "POST", body: JSON.stringify({ kind, name, address:addressPayload(address) }) });
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
      setQuotedFingerprint(quoteFingerprint);
      if (!nextRates.length) setNotice("No hubo tarifas disponibles para esta ruta y paquete.");
      else if (result.unavailableCarriers?.length) setNotice(`Mostramos las tarifas disponibles. ${result.unavailableCarriers.length} paquetería(s) no respondió(ieron) para esta ruta.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cotizar."); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    if (!ratesCurrent || !selectedRate || !window.confirm(`¿Generar guía con ${selectedRate.carrier} ${selectedRate.service}? Esta acción puede generar un cargo.`)) return;
    setBusy(true); setNotice("");
    try {
      const shipment = await request<Shipment>("/shipping/generate", { method: "POST", body: JSON.stringify({ ...quotePayload(selectedRate), environment: quotedEnvironment, settings: { ...quotePayload(selectedRate).settings, printFormat: "PDF", printSize: "STOCK_4X6" } }) });
      setShipments(current => [shipment, ...current]); setNotice(`Guía generada${shipment.trackingNumber ? `: ${shipment.trackingNumber}` : ""}.`); setRates([]); setSelectedRate(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar la guía."); }
    finally { setBusy(false); }
  };

  const addressFields = (target: "origin" | "destination", value: Address) => <div className="envia-address-fields">
    {([['name', 'Nombre completo'], ['email', 'Correo'], ['phone', 'Teléfono'], ['street', 'Calle'], ['number', 'Número'], ['country', 'País'], ...(target === "destination" ? [['interiorNumber','Número interior'],['references','Referencias']] : [])] as [keyof Address, string][]).map(([field, label]) => <label key={field} className={field === "street" || field === "references" ? "envia-field-wide" : ""}>{label}
      <input type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} value={value[field] || ""} maxLength={field === "country" ? 2 : field === "references" ? 300 : field === "interiorNumber" ? 30 : undefined} placeholder={field === "country" ? "MX" : field === "number" ? "SN" : label} onChange={event => setAddressField(target, field, field === "country" ? event.target.value.toUpperCase() : event.target.value)} required={!['district', 'email', 'number','interiorNumber','references'].includes(field)} />
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
  const packagePresetControls = <>
    <div className="envia-preset-controls"><select aria-label="Usar paquete guardado" defaultValue="" onChange={event => {
      const value=event.target.value;
      if(value.startsWith("bundle:")){
        const bundle=storeBundles.find(item=>String(item.id)===value.slice(7));
        const stored=bundle?bundleShippingPackage(bundle):null;
        if(stored)setParcel(asParcel(stored));
      }else{
        const preset=savedPresets.packages.find(item=>`saved:${item.id}`===value);
        if(preset)setParcel(asParcel(preset.package));
      }
      event.currentTarget.value="";
    }}><option value="">Usar paquete guardado…</option>
      {storeBundles.length>0 && <optgroup label="Bundles de E-commerce">{storeBundles.map(bundle=>{
        const stored=bundleShippingPackage(bundle);
        return <option key={bundle.id} value={`bundle:${bundle.id}`} disabled={!stored}>{shippingPackageLabel(bundle.name,stored)}</option>;
      })}</optgroup>}
      {savedPresets.packages.length>0 && <optgroup label="Paquetes guardados de Envíos">{savedPresets.packages.map(preset=><option key={preset.id} value={`saved:${preset.id}`}>{shippingPackageLabel(preset.name,preset.package)}</option>)}</optgroup>}
    </select><button type="button" onClick={() => void savePackagePreset()}>＋ Guardar</button></div>
    {bundleLoading && <small role="status">Cargando bundles de la tienda…</small>}
    {bundleError && <div className="envia-bundle-error" role="status"><span>No se pudieron cargar los bundles: {bundleError} Puedes capturar las medidas manualmente.</span><button type="button" onClick={()=>{setBundleLoading(true);setBundleError("");setBundleRevision(n=>n+1);}}>Reintentar bundles</button></div>}
    {!bundleLoading && !bundleError && !storeBundles.length && <small>No hay bundles de E-commerce guardados.</small>}
    <small className="envia-package-note">Los bundles cargan sus medidas y peso guardados. Revisa el valor declarado y ajusta el paquete si cambió su contenido.</small>
  </>;

  return <section className="envia-panel"><header><div><p>LOGÍSTICA</p><h1>Cotizar y generar envío</h1><span>Compara automáticamente las paqueterías disponibles para tu ruta.</span></div><b className={settings?.tokenConfigured ? "envia-status ready" : "envia-status"}>{settings?.tokenConfigured ? "● API conectada" : "○ Falta ENVIA_TOKEN"}</b></header>{notice && <div className="envia-notice">{notice}</div>}
    {!chat && <StoreShippingOrigin />}
    {chat && draftStorageUnavailable && <div className="envia-notice" role="status">El navegador no permite guardar el borrador. Si cierras el modal, los cambios de esta captura podrían perderse.</div>}
    {!settings && notice && <button type="button" onClick={()=>setLoadRevision(n=>n+1)}>Reintentar carga</button>}
    {orderDraft && <section className="envia-card" aria-label="Pedido a enviar"><h2>{orderDraft.orderFolio}</h2><ul>{orderDraft.orderLines?.map((line,index)=><li key={index}>{line.quantity} × {line.name}</li>)}</ul><p>{orderDraft.pairs} pares · 1 caja consolidada. El peso incluye el empaque. Puedes revisar y ajustar el paquete antes de cotizar.</p><small>Preparar este formulario no cobra el envío ni genera una guía.</small></section>}
    <div className={chat?"envia-chat-workspace":""}>
      {chat && <aside className="envia-chat-source"><details open><summary>Información recibida del cliente</summary><label htmlFor="shipping-client-message">Pega aquí el mensaje del Inbox</label><textarea id="shipping-client-message" value={pastedInfo} onChange={event=>setPastedInfo(event.target.value)} maxLength={10000} placeholder="Nombre, teléfono, calle, número, colonia, código postal, ciudad, estado…"/><small>El borrador se guarda automáticamente en este navegador para esta conversación. Este texto es una referencia para completar el formulario. No se envía a la paquetería ni llena campos automáticamente.</small></details></aside>}
    <form className="envia-quote-form" onSubmit={quote}>
      <fieldset className="envia-capture-fields" disabled={busy || !settings}>
      <div className="envia-quote-columns">
        <section className="envia-form-column"><div className="envia-column-title"><span>▣</span><div><b>Origen</b><small>Remitente</small></div></div>{addressPresetControls("origin")}<div className="envia-environment"><p>Ambiente: {settings?.environment === "production" ? "Producción" : "Desarrollo"} · Se administra en Feature.</p></div>{addressFields("origin", origin)}</section>
        <section className="envia-form-column"><div className="envia-column-title"><span>⌖</span><div><b>Destino</b><small>Datos del cliente</small></div></div>{chat ? <div className="envia-customer-link"><b>{chat.name || "Cliente del Inbox"}</b><small>{chat.phone_number} · La guía quedará vinculada a esta conversación.</small></div> : <div className="envia-customer-link"><label>Cliente de MerlynSeller<select value={conversationId} onChange={event => { const id = event.target.value; setConversationId(id); const customer = customers.find(item => item.id === id); if (customer) setDestination(current => ({ ...current, name: current.name || customer.name || "", phone: current.phone || customer.phoneNumber })); }}><option value="">Sin asociar a una conversación</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || "Cliente sin nombre"} · {customer.phoneNumber}</option>)}</select></label><small>La guía quedará vinculada a este cliente y su conversación.</small></div>}{addressPresetControls("destination")}{addressFields("destination", destination)}</section>
        <section className="envia-form-column envia-package-column"><div className="envia-column-title"><span>▣</span><div><b>Paquete</b><small>Caja #1</small></div></div>{packagePresetControls}<div className="envia-package-fields"><label className="envia-field-wide">Contenido<input value={parcel.content} onChange={event => setParcel(current => ({ ...current, content: event.target.value }))} required /></label><label>Largo <span>cm</span><input value={parcel.length} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, length: event.target.value }))} required /></label><label>Ancho <span>cm</span><input value={parcel.width} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, width: event.target.value }))} required /></label><label>Alto <span>cm</span><input value={parcel.height} type="number" min="0.1" step="any" onChange={event => setParcel(current => ({ ...current, height: event.target.value }))} required /></label><label>Peso <span>kg</span><input value={parcel.weight} type="number" min="0.01" step="any" onChange={event => setParcel(current => ({ ...current, weight: event.target.value }))} required /></label><label>Valor declarado<input value={parcel.declaredValue} type="number" min="0" step="any" onChange={event => setParcel(current => ({ ...current, declaredValue: event.target.value }))} required /></label></div><p className="envia-package-help">Las tarifas se consultarán con todas las paqueterías activas.</p></section>
      </div>
      <div className="envia-quote-actions"><span>Las direcciones y el paquete predeterminado se guardarán antes de cotizar.</span><button className="envia-primary" disabled={busy || !settings?.tokenConfigured}>{busy ? "Consultando paqueterías…" : "Cotizar todas las paqueterías"}</button></div>
      </fieldset>
    </form>
    </div>
    {ratesCurrent && rates.length > 0 && <section className="envia-card envia-results"><div className="envia-results-header"><div><p>RESULTADOS</p><h2>Elige el servicio para generar la guía</h2><span>{rates.length} tarifa(s) encontrada(s) entre las paqueterías disponibles.</span></div><div className="envia-rate-filters"><button type="button" className={rateFilter === "all" ? "active" : ""} onClick={() => setRateFilter("all")}>Todos</button><button type="button" className={rateFilter === "cheapest" ? "active" : ""} onClick={() => setRateFilter("cheapest")}>Más económico</button><button type="button" className={rateFilter === "fastest" ? "active" : ""} onClick={() => setRateFilter("fastest")}>Más rápido</button></div></div><div className="envia-rate-list">{orderedRates.map((rate, index) => <button className={selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "selected" : ""} type="button" key={`${rate.carrier}-${rate.service}-${index}`} onClick={() => setSelectedRate(rate)}><span className="envia-rate-carrier">{rate.carrier}</span><div><b>{rate.serviceDescription || rate.service}</b><small>{rate.service}</small></div><span>{rate.deliveryEstimate || (rate.deliveryDays ? `${rate.deliveryDays} días estimados` : "Tiempo por confirmar")}</span><strong>{rate.currency || "MXN"} {rate.totalPrice ?? "—"}</strong><span className="envia-rate-choose">{selectedRate?.service === rate.service && selectedRate?.carrier === rate.carrier ? "Seleccionado" : "Elegir"}</span></button>)}</div><button type="button" className="envia-primary" disabled={!selectedRate || busy} onClick={() => void generate()}>Generar guía seleccionada</button></section>}
    <section className="envia-card"><div className="envia-card-heading"><div><h2>Guías generadas</h2><p>Consulta su rastreo y descarga la etiqueta cuando esté disponible.</p></div></div>{shipments.length ? <div className="envia-shipments">{shipments.map(shipment => <article key={shipment.id}><div><b>{shipment.carrier} · {shipment.service}</b><span>{shipment.customerName ? `Cliente: ${shipment.customerName}${shipment.customerPhone ? ` · ${shipment.customerPhone}` : ""}` : "Sin cliente asociado"}</span><span>{shipment.trackingNumber || "Rastreo pendiente"} · {shipment.status}</span></div>{shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer">Abrir guía PDF ↗</a>}</article>)}</div> : <p className="envia-empty">Aún no hay guías generadas.</p>}</section>
  </section>;
}
