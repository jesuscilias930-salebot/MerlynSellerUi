"use client";

import { useState } from "react";
import { request } from "../lib/api";
import styles from "./ScenarioCodexConnection.module.css";

export default function ScenarioCodexConnection() {
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const generate = async () => {
    setBusy(true); setToken(""); setNotice("");
    try {
      const session = await request<{ token: string; expiresAt: string }>("/scenarios/mcp-session", { method: "POST" });
      setToken(session.token); setExpiresAt(session.expiresAt);
      setNotice("Código generado. Cópialo y pégalo solo en tu terminal, no en el chat.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo conectar."); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setNotice("");
    try {
      await request<void>("/scenarios/mcp-session", { method: "DELETE" });
      setToken(""); setExpiresAt(""); setNotice("Acceso de Codex a Escenarios revocado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo revocar."); }
    finally { setBusy(false); }
  };
  return <details className={styles.connection}>
    <summary>Conectar con Codex · Crear escenarios desde un prompt</summary>
    <p>Describe en tu chat de Codex qué debe responder MerlynSeller. El conector puede consultar tus recursos, validar el flujo y guardarlo aquí sin enviar mensajes de prueba a clientes.</p>
    <ol>
      <li>Genera y copia el código de conexión.</li>
      <li>En la terminal de <code>salesBotBackend/mcp</code>, ejecuta <code>npm run login:scenarios</code> y pega el código.</li>
      <li>Reinicia Codex para cargar el conector y describe tu escenario. Los nuevos escenarios quedan apagados salvo que autorices activarlos. Recarga esta sección para ver lo guardado.</li>
    </ol>
    <p>Acceso exclusivo a escenarios y sus recursos durante 7 días. Generar otro código reemplaza el anterior. No compartas el código ni el archivo de sesión.</p>
    <div className={styles.actions}>
      <button type="button" className="plain-button" disabled={busy} onClick={generate}>{busy ? "Procesando…" : "Generar código"}</button>
      {token && <button type="button" className="primary-action" disabled={busy} onClick={async () => {
        try { await navigator.clipboard.writeText(token); setNotice("Código copiado. Pégalo en tu terminal."); }
        catch { setNotice("No fue posible copiar. Permite el acceso al portapapeles y vuelve a intentarlo."); }
      }}>Copiar código</button>}
      <button type="button" className="plain-button" disabled={busy} onClick={revoke}>Revocar conexión</button>
    </div>
    {expiresAt && <small>Vence: {new Date(expiresAt).toLocaleString("es-MX")}</small>}
    {notice && <p role="status">{notice}</p>}
  </details>;
}
