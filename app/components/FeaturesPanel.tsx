"use client";
import { useEffect, useState } from "react";
import { request } from "../lib/api";
type Mode = "sandbox" | "production";
type Service = "envia" | "stripe";
type Features = Record<Service, Mode> & { configured: Record<Service, Record<Mode, boolean>>; stripeError?: string };

export function FeaturesPanel() {
  const [data, setData] = useState<Features | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() { setData(await request<Features>("/features")); }
  useEffect(() => { const controller = new AbortController(); void request<Features>("/features", { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setNotice(e.message); }); return () => controller.abort(); }, []);
  async function change(service: Service, environment: Mode) {
    if (environment === data?.[service]) return;
    if (environment === "production" && !window.confirm(service === "stripe" ? "¿Activar cobros REALES de Stripe para nuevos pedidos?" : "¿Activar Envia en producción? Las tarifas serán reales y las guías creadas manualmente podrán consumir saldo.")) return;
    setBusy(true); setNotice("");
    try {
      await request("/features", { method: "PUT", body: JSON.stringify({ service, environment, confirmProduction: environment === "production" }) });
      await load(); setNotice(service === "stripe" ? "Ambiente de Stripe actualizado. Los pagos ya iniciados conservan su ambiente original." : "Ambiente de Envia.com actualizado. Se usará en las siguientes cotizaciones.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }
  return <div className="automation-workspace" style={{ overflowY: "auto", padding: 24 }}>
    <header><small>CONFIGURACIÓN ADMINISTRATIVA</small><h1>Feature</h1><p>Dos controles independientes. Apagado: Dev · Encendido: Prod.</p></header>
    <p role="status">{notice}</p>
    <button type="button" disabled={busy} onClick={() => { setBusy(true); void load().catch(e => setNotice(e.message)).finally(() => setBusy(false)); }}>Actualizar estado</button>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))", gap: 20, marginTop: 24 }}>
      {(["stripe", "envia"] as Service[]).map(service => {
        const production = data?.[service] === "production";
        const nextMode: Mode = production ? "sandbox" : "production";
        const canSwitch = Boolean(data?.configured[service][nextMode]);
        return <section key={service} className="envia-card">
        <h2>{service === "envia" ? "Envia.com · Envíos" : "Stripe · Pagos"}</h2>
        <p>{service === "envia" ? "Ambiente para cotizaciones del carrito y envíos del CRM. Cotizar no genera una guía." : "Ambiente para nuevos pagos. Los webhooks de ambos ambientes siguen funcionando."}</p>
        <strong>Activo: {data ? (data[service] === "production" ? "Producción · real" : "Desarrollo · pruebas") : "Cargando…"}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <span style={{ fontWeight: !production ? 700 : 400 }}>Dev</span>
          <button type="button" role="switch" aria-checked={production} aria-label={`Producción de ${service === "envia" ? "Envia.com" : "Stripe"}`} aria-describedby={`${service}-mode-help`} disabled={!data || busy || !canSwitch} onClick={() => void change(service, nextMode)} style={{ position: "relative", width: 64, minWidth: 64, height: 36, padding: 0, borderRadius: 999, border: "1px solid #6C7770", background: production ? "#1C513E" : "#6C7770", opacity: !data || busy || !canSwitch ? 0.55 : 1, cursor: !data || busy || !canSwitch ? "not-allowed" : "pointer" }}>
            <span aria-hidden="true" style={{ display: "block", position: "absolute", top: 3, left: production ? 31 : 3, width: 28, height: 28, borderRadius: "50%", background: "white", transition: "left 160ms ease" }} />
          </button>
          <span style={{ fontWeight: production ? 700 : 400 }}>Prod</span>
        </div>
        <p id={`${service}-mode-help`}>{!data ? "Cargando configuración…" : !canSwitch ? `Faltan credenciales para cambiar a ${production ? "Dev" : "Prod"}.` : `Pulsa para cambiar a ${production ? "Dev" : "Prod"}.`}</p>
        {service === "stripe" && data?.stripeError && <p role="alert">{data.stripeError}</p>}
      </section>;
      })}
    </div>
    <p>Las claves se configuran en los servidores; nunca se muestran aquí. “Configuradas” verifica su presencia y formato, no su validez ante el proveedor.</p>
    {data?.stripe === "production" && data.envia !== "production" && <p role="alert">Para cobrar envíos reales, activa también Envia en producción y vuelve a cotizar. Stripe no cobrará tarifas de prueba.</p>}
  </div>;
}
