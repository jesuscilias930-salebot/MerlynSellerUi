"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { request } from "../lib/api";
import { contactPhone } from "../lib/channels";
import { chatShippingDraftKey, readChatShippingDraft, writeChatShippingDraft, type ShippingAddress, type ShippingParcel } from "../lib/chat-shipping-draft";
import { chatShippingQuoteKey, QUOTE_FRESH_MS, readShippingQuote, writeShippingQuote } from "../lib/chat-shipping-quote";
import { bestPriceMessage, chatQuoteBundle, missingDestinationFields, quoteAge, quoteBundleRef, rateDelivery, rateMessage, ratePrice, ratesMessage, ratesByPrice, storedParcel, trackingMessage, type QuoteRate, type QuoteShipment } from "../lib/quote";
import { bundleShippingPackage, type StoredShippingPackage } from "../lib/shipping-package";
import type { Chat, QuoteBundleRef } from "../lib/types";
import { EnviaPostalFields } from "./EnviaPostalFields";
import { useControlBundles } from "./useControlBundles";

type Settings = { origin: Partial<ShippingAddress>; defaultPackage: StoredShippingPackage; tokenConfigured: boolean };
type SavedAddress = { id: string; kind: "origin" | "destination"; name: string; address: ShippingAddress };
type View = "form" | "product" | "rates";

const emptyAddress = (): ShippingAddress => ({ name: "", phone: "", street: "", city: "", state: "", country: "MX", postalCode: "", district: "", number: "", email: "" });
const emptyParcel = (): ShippingParcel => ({ type: "box", content: "Productos", amount: "1", declaredValue: "0", weight: "1", length: "20", width: "20", height: "20" });
const addressPayload = (value: ShippingAddress) => {
  const address: Partial<ShippingAddress> = { ...value, number: value.number?.trim() || "SN" };
  delete address.interiorNumber; delete address.references;
  if (address.email?.trim()) address.email = address.email.trim(); else delete address.email;
  return address;
};
const packagePayload = (parcel: ShippingParcel) => ({ type: parcel.type, content: parcel.content, amount: Number(parcel.amount), declaredValue: Number(parcel.declaredValue), lengthUnit: "CM" as const, weightUnit: "KG" as const, weight: Number(parcel.weight), dimensions: { length: Number(parcel.length), width: Number(parcel.width), height: Number(parcel.height) } });
const money = (value: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value) || 0);

/** Cotizador del chat: datos del cliente → (ajustar producto) → opciones de envío de las paqueterías. */
export function QuoteDrawer({ chat, onInsert, onQuoteBundleChange }: { chat: Chat; onInsert: (text: string) => void; onQuoteBundleChange?: (bundle: QuoteBundleRef | null) => Promise<void> }) {
  const [saved] = useState(() => readChatShippingDraft(chat.id));
  // Última cotización de este chat (se conserva 12 h en este navegador y se comparte entre ventanas).
  const [storedQuote] = useState(() => readShippingQuote(chat.id));
  const [view, setView] = useState<View>(storedQuote?.rates.length ? "rates" : "form");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [presets, setPresets] = useState<SavedAddress[]>([]);
  const [destination, setDestination] = useState<ShippingAddress>(() => ({ ...emptyAddress(), ...(saved?.destination || { name: chat.name || "", phone: contactPhone(chat) }) }));
  const [parcel, setParcel] = useState<ShippingParcel | null>(null);
  const [bundleId, setBundleId] = useState("");
  const [rates, setRates] = useState<QuoteRate[]>(storedQuote?.rates || []);
  const [savedAt, setSavedAt] = useState<number | null>(storedQuote?.savedAt ?? null);
  const [now, setNow] = useState(() => storedQuote?.savedAt ?? 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(storedQuote?.notice || "");
  const [inserted, setInserted] = useState("");
  // Lo cotizado tal cual: la guía se genera con la misma dirección y paquete que se cotizaron.
  const [quoted, setQuoted] = useState<{ body: Record<string, unknown>; environment: string } | null>(storedQuote?.quoted || null);
  const [confirmKey, setConfirmKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [shipment, setShipment] = useState<QuoteShipment | null>(null);
  const [previous, setPrevious] = useState<QuoteShipment[]>([]);
  const parcelResolved = useRef(false);
  const chatBundle = chatQuoteBundle(chat);
  const { bundles, loading: bundlesLoading, error: bundlesError, retry: retryBundles } = useControlBundles(true);

  useEffect(() => {
    let active = true;
    void Promise.all([request<Settings>("/shipping/settings"), request<{ addresses: SavedAddress[] }>("/shipping/saved"), request<QuoteShipment[]>(`/shipping/shipments?conversationId=${encodeURIComponent(chat.id)}`).catch(() => [] as QuoteShipment[])])
      .then(([nextSettings, nextSaved, shipments]) => { if (active) { setSettings(nextSettings); setPresets(nextSaved.addresses.filter(item => item.kind === "destination")); setPrevious(Array.isArray(shipments) ? shipments : []); } })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : "No fue posible cargar la configuración de envíos."); });
    return () => { active = false; };
  }, [chat.id]);

  // Paquete inicial: el del chat (fijado por el escenario o a mano); si no tiene, el borrador o el predeterminado.
  useEffect(() => {
    if (parcelResolved.current || !settings || (chatBundle && bundlesLoading)) return;
    parcelResolved.current = true;
    const bundle = chatBundle ? bundles.find(item => String(item.id) === chatBundle.id) : undefined;
    const fromBundle = bundle ? storedParcel(bundleShippingPackage(bundle), bundle.name) : null;
    const next = fromBundle || saved?.parcel || storedParcel(Object.keys(settings.defaultPackage || {}).length ? settings.defaultPackage : null) || emptyParcel();
    const message = chatBundle && !fromBundle ? bundle ? `El bundle ${chatBundle.name} no tiene medidas o peso en Control. Ajusta el producto antes de cotizar.` : `No se encontró el bundle ${chatBundle.name} en Control. Ajusta el producto antes de cotizar.` : "";
    void Promise.resolve().then(() => { setParcel(next); if (fromBundle && bundle) setBundleId(String(bundle.id)); if (message) setNotice(message); });
  }, [settings, bundles, bundlesLoading, chatBundle, saved]);

  // Comparte el borrador con «Capturar datos de envío» de esta conversación.
  useEffect(() => {
    if (!parcel) return;
    writeChatShippingDraft({ version: 1, conversationId: chat.id, pastedInfo: saved?.pastedInfo || "", destination, ...(saved?.origin ? { origin: saved.origin } : {}), parcel });
  }, [chat.id, destination, parcel, saved]);

  // Otra ventana con este mismo chat: lo que se captura o cotiza allá aparece aquí al instante.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === chatShippingDraftKey(chat.id)) {
        const draft = readChatShippingDraft(chat.id);
        if (!draft) return;
        setDestination(current => JSON.stringify(current) === JSON.stringify({ ...emptyAddress(), ...draft.destination }) ? current : { ...emptyAddress(), ...draft.destination });
        if (draft.parcel) { const next = draft.parcel; setParcel(current => current && JSON.stringify(current) === JSON.stringify(next) ? current : next); }
      }
      if (event.key === chatShippingQuoteKey(chat.id)) {
        const next = readShippingQuote(chat.id);
        setRates(next?.rates || []); setQuoted(next?.quoted || null); setSavedAt(next?.savedAt ?? null); setShipment(null); setConfirmKey("");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [chat.id]);
  // Reloj para «Cotizado hace 5 min».
  useEffect(() => {
    if (!savedAt) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [savedAt]);

  const selectedBundle = bundles.find(item => String(item.id) === bundleId);
  const productName = selectedBundle?.name || parcel?.content || "Productos";
  const sortedRates = useMemo(() => ratesByPrice(rates), [rates]);
  const origin = settings?.origin;
  const field = (key: keyof ShippingAddress, label: string, options: { type?: string; required?: boolean; wide?: boolean; placeholder?: string; max?: number } = {}) =>
    <label className={options.wide ? "quote-field-wide" : ""}>{label}<input type={options.type || "text"} required={options.required} maxLength={options.max} placeholder={options.placeholder} value={destination[key] || ""} onChange={event => { const value = event.target.value; setDestination(current => ({ ...current, [key]: value })); }} /></label>;
  const parcelField = (key: keyof ShippingParcel, label: string, unit?: string) =>
    <label>{label}{unit && <span> {unit}</span>}<input type="number" min={key === "declaredValue" ? "0" : key === "amount" ? "1" : "0.1"} step={key === "amount" ? "1" : "any"} required value={parcel?.[key] || ""} onChange={event => { const value = event.target.value; setParcel(current => current && { ...current, [key]: value }); }} /></label>;

  const quote = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!parcel) return;
    const missing = missingDestinationFields(destination);
    if (missing.length) { setNotice(`Falta: ${missing.join(", ")}.`); return; }
    setBusy(true); setNotice(""); setInserted(""); setConfirmKey(""); setShipment(null);
    try {
      const comments = [destination.interiorNumber ? `Interior: ${destination.interiorNumber}` : "", destination.references].filter(Boolean).join(" · ").slice(0, 500);
      const body = { destination: addressPayload(destination), packages: [packagePayload(parcel)], conversationId: chat.id, ...(comments ? { settings: { comments } } : {}) };
      const result = await request<{ environment: string; rates: QuoteRate[]; unavailableCarriers?: string[] }>("/shipping/quote", { method: "POST", body: JSON.stringify(body) });
      setQuoted({ body, environment: result.environment });
      setRates(result.rates || []);
      setView("rates");
      const resultNotice = !result.rates?.length ? "No hubo tarifas disponibles para esta ruta y paquete." : result.unavailableCarriers?.length ? `${result.unavailableCarriers.length} paquetería(s) no respondió(ieron) para esta ruta.` : "";
      if (resultNotice) setNotice(resultNotice);
      const stamp = Date.now();
      setSavedAt(stamp); setNow(stamp);
      writeShippingQuote({ version: 1, conversationId: chat.id, savedAt: stamp, rates: result.rates || [], quoted: { body, environment: result.environment }, productName, place: [destination.city, destination.postalCode && `CP ${destination.postalCode}`].filter(Boolean).join(", "), ...(resultNotice ? { notice: resultNotice } : {}) });
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cotizar."); }
    finally { setBusy(false); }
  };
  const chooseBundle = (id: string) => {
    setBundleId(id);
    const bundle = bundles.find(item => String(item.id) === id);
    if (!bundle) return;
    const next = storedParcel(bundleShippingPackage(bundle), bundle.name);
    if (next) { setParcel(next); setNotice(""); } else setNotice(`El bundle ${bundle.name} no tiene medidas o peso en Control. Captúralos aquí.`);
  };
  const insert = (text: string, key: string) => { onInsert(text); setInserted(key); };
  const generate = async (rate: QuoteRate) => {
    if (!quoted) return;
    setGenerating(true); setNotice("");
    try {
      const settings = { ...((quoted.body.settings as Record<string, unknown>) || {}), printFormat: "PDF", printSize: "STOCK_4X6" };
      const created = await request<QuoteShipment>("/shipping/generate", { method: "POST", body: JSON.stringify({ ...quoted.body, environment: quoted.environment, carrier: rate.carrier, service: rate.service, settings }) });
      setShipment({ ...created, service: rate.serviceDescription || created.service }); setPrevious(current => [created, ...current]); setConfirmKey("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible generar la guía."); }
    finally { setGenerating(false); }
  };

  const bestMessage = bestPriceMessage(rates, destination, productName);
  const age = savedAt && now ? quoteAge(savedAt, Math.max(now, savedAt)) : "";
  const stale = Boolean(savedAt && now - savedAt > QUOTE_FRESH_MS);
  // La cotización se hizo con otros datos: se avisa para volver a cotizar antes de generar la guía.
  const changedSinceQuote = Boolean(quoted && parcel && (JSON.stringify(quoted.body.destination) !== JSON.stringify(addressPayload(destination)) || JSON.stringify(quoted.body.packages) !== JSON.stringify([packagePayload(parcel)])));
  const popOut = () => { window.open(`${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(chat.id)}&quote=1`, `merlyn-quote-${chat.id}`, "popup,width=560,height=900"); };
  const popOutButton = <button type="button" className="quote-link-button quote-popout" title="Abre este chat con el cotizador en otra ventana; ambas se mantienen sincronizadas" onClick={popOut}>↗ Abrir en otra ventana</button>;

  if (loadError) return <div className="quote-drawer-body"><p className="quote-notice" role="alert">{loadError}</p></div>;
  if (!settings || !parcel) return <div className="quote-drawer-body"><p className="quote-loading" role="status">Cargando cotizador…</p></div>;

  if (view === "product") return <div className="quote-drawer-body">
    <div className="quote-step-header"><button type="button" className="quote-back" aria-label="Regresar al formulario" onClick={() => setView("form")}>←</button><div><b>Ajustar producto a enviar</b><small>Cambia el bundle o captura medidas y peso de la caja.</small></div></div>
    {notice && <p className="quote-notice" role="status">{notice}</p>}
    <label className="quote-field-wide">Bundle<select value={bundleId} onChange={event => chooseBundle(event.target.value)}><option value="">{bundlesLoading ? "Cargando bundles…" : "Personalizado"}</option>{bundles.map(bundle => <option key={bundle.id} value={String(bundle.id)} disabled={!bundleShippingPackage(bundle)}>{bundle.name}{bundleShippingPackage(bundle) ? "" : " · faltan medidas"}</option>)}</select></label>
    {bundlesError && <p className="quote-notice" role="status">{bundlesError} <button type="button" onClick={retryBundles}>Reintentar</button></p>}
    {selectedBundle && onQuoteBundleChange && chatBundle?.id !== String(selectedBundle.id) && <button type="button" className="quote-link-button" onClick={() => void onQuoteBundleChange(quoteBundleRef(selectedBundle))}>Usar {selectedBundle.name} como paquete de este chat</button>}
    <div className="quote-grid">
      <label className="quote-field-wide">Contenido<input required value={parcel.content} onChange={event => { const value = event.target.value; setParcel(current => current && { ...current, content: value }); setBundleId(""); }} /></label>
      {parcelField("declaredValue", "Valor declarado", "MXN")}
      {parcelField("amount", "Cajas iguales")}
      {parcelField("weight", "Peso", "kg")}
      {parcelField("length", "Largo", "cm")}
      {parcelField("width", "Ancho", "cm")}
      {parcelField("height", "Alto", "cm")}
    </div>
    <div className="quote-actions"><button type="button" className="quote-primary" onClick={() => setView("form")}>Listo</button></div>
  </div>;

  if (view === "rates") return <div className="quote-drawer-body">
    <div className="quote-step-header"><button type="button" className="quote-back" aria-label="Regresar al formulario" onClick={() => setView("form")}>←</button><div><b>Opciones de envío</b><small>{productName} · {[destination.city, destination.postalCode && `CP ${destination.postalCode}`].filter(Boolean).join(", ")}</small></div></div>
    <div className="quote-saved-bar">{age && <small>Cotizado {age}{stale ? " · los precios pueden haber cambiado" : ""}</small>}<button type="button" className="quote-link-button" disabled={busy} onClick={() => void quote()}>{busy ? "Cotizando…" : "↻ Volver a cotizar"}</button>{popOutButton}</div>
    {changedSinceQuote && <p className="quote-notice" role="status">Los datos del cliente o del paquete cambiaron desde esta cotización. Vuelve a cotizar antes de generar la guía.</p>}
    {notice && <p className="quote-notice" role="status">{notice}</p>}
    {shipment && <section className="quote-shipment" aria-label="Guía generada">
      <b>✓ Guía generada</b>
      <span>{shipment.carrier.toUpperCase()} · {shipment.service}{shipment.trackingNumber ? <> · Guía <strong>{shipment.trackingNumber}</strong></> : " · Número de rastreo pendiente"}</span>
      <div>{shipment.labelUrl && <a href={shipment.labelUrl} target="_blank" rel="noreferrer">Descargar guía (PDF)</a>}<button type="button" onClick={() => insert(trackingMessage(shipment), "tracking")}>{inserted === "tracking" ? "✓ Agregado al mensaje" : "Agregar número de guía al mensaje"}</button></div>
    </section>}
    {!shipment && previous.length > 0 && <p className="quote-notice" role="status">Este chat ya tiene {previous.length === 1 ? "una guía generada" : `${previous.length} guías generadas`} ({previous.slice(0, 2).map(item => `${item.carrier.toUpperCase()}${item.trackingNumber ? ` ${item.trackingNumber}` : ""}`).join(", ")}). Revisa antes de generar otra.</p>}
    {bestMessage && <button type="button" className="quote-primary quote-best" onClick={() => insert(bestMessage, "best")}>{inserted === "best" ? "✓ Escrito en el mensaje" : "💬 Ofrecer la más económica al cliente"}</button>}
    {sortedRates.length > 0 && <button type="button" className="quote-link-button" onClick={() => insert(ratesMessage(sortedRates.slice(0, 3), destination, productName), "top")}>{inserted === "top" ? "✓ Agregadas al mensaje" : "Agregar las 3 más económicas al mensaje"}</button>}
    <ul className="quote-rates">{sortedRates.map((rate, index) => {
      const key = `${rate.carrier}-${rate.service}-${index}`;
      const delivery = rateDelivery(rate);
      return <li key={key} className={confirmKey === key ? "confirming" : ""}><div><b>{rate.carrier.toUpperCase()}</b><small>{rate.serviceDescription || rate.service}{delivery ? ` · ${delivery}` : ""}</small></div><strong>{ratePrice(rate)}</strong>
        <div className="quote-rate-actions"><button type="button" onClick={() => insert(rateMessage(rate, destination, productName), key)}>{inserted === key ? "✓ Agregada" : "Al mensaje"}</button>{!shipment && <button type="button" disabled={generating} onClick={() => setConfirmKey(current => current === key ? "" : key)}>Generar guía</button>}</div>
        {confirmKey === key && !shipment && <div className="quote-confirm" role="alertdialog" aria-label="Confirmar guía"><p>Se generará la guía con <b>{rate.carrier.toUpperCase()} {rate.serviceDescription || rate.service}</b> por <b>{ratePrice(rate)}</b> a {[destination.name, destination.city].filter(Boolean).join(", ")}. Puede generar un cargo en tu cuenta de Envia.{stale ? " Esta cotización tiene más de 2 h: el precio final puede ser distinto." : ""}{changedSinceQuote ? " Ojo: se usará la dirección y el paquete con los que se cotizó." : ""}</p><div><button type="button" disabled={generating} onClick={() => setConfirmKey("")}>Cancelar</button><button type="button" className="quote-primary" disabled={generating} onClick={() => void generate(rate)}>{generating ? "Generando…" : "Confirmar y generar"}</button></div></div>}
      </li>;
    })}</ul>
  </div>;

  return <form className="quote-drawer-body" onSubmit={quote}>
    <div className="quote-saved-bar">{popOutButton}</div>
    {rates.length > 0 && <button type="button" className="quote-last" onClick={() => setView("rates")}><b>Última cotización{age ? ` · ${age}` : ""}</b><span>{rates.length} {rates.length === 1 ? "opción" : "opciones"} · desde {ratePrice(sortedRates[0])} · Ver opciones →</span></button>}
    {notice && <p className="quote-notice" role="status">{notice}</p>}
    <section className="quote-product-card" aria-label="Producto a enviar">
      <div><small>PRODUCTO A ENVIAR</small><b>{productName}</b><span>{parcel.length} × {parcel.width} × {parcel.height} cm · {parcel.weight} kg{Number(parcel.amount) > 1 ? ` · ${parcel.amount} cajas` : ""} · Valor {money(parcel.declaredValue)}</span></div>
      <button type="button" onClick={() => setView("product")}>Ajustar producto a enviar</button>
    </section>
    <section className="quote-section" aria-label="Datos del cliente">
      <div className="quote-section-title"><b>Datos del cliente</b>{presets.length > 0 && <select aria-label="Usar dirección guardada" defaultValue="" onChange={event => { const preset = presets.find(item => item.id === event.target.value); if (preset) setDestination({ ...emptyAddress(), ...preset.address }); event.currentTarget.value = ""; }}><option value="">Usar dirección guardada…</option>{presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
      <div className="quote-grid">
        {field("name", "Nombre completo", { required: true, wide: true, max: 160 })}
        {field("phone", "Teléfono", { type: "tel", required: true })}
        {field("email", "Correo", { type: "email", placeholder: "Opcional" })}
        {field("street", "Calle", { required: true, wide: true })}
        {field("number", "Número", { placeholder: "SN" })}
        {field("interiorNumber", "Interior", { placeholder: "Opcional", max: 30 })}
        <EnviaPostalFields value={destination} onChange={setDestination} />
        {field("references", "Referencias", { wide: true, placeholder: "Entre calles, color de fachada…", max: 300 })}
      </div>
    </section>
    <p className="quote-origin">{origin?.postalCode ? <>Sale de <b>{[origin.city, origin.state].filter(Boolean).join(", ")} · CP {origin.postalCode}</b> (origen guardado en Envíos).</> : <>Falta la dirección de origen. Configúrala en Envíos antes de cotizar.</>}</p>
    <div className="quote-actions"><button className="quote-primary" disabled={busy || !settings.tokenConfigured || !origin?.postalCode}>{busy ? "Consultando paqueterías…" : "Cotizar"}</button>{!settings.tokenConfigured && <small>Falta ENVIA_TOKEN en el servidor.</small>}</div>
  </form>;
}
