"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AutomationScenario, LeadColumn } from "../lib/types";

type Props = {
  scenarios: AutomationScenario[];
  columns: LeadColumn[];
  onSave: (key: string, value: { isActive: boolean; config: Record<string, unknown> }) => Promise<void>;
};

const asText = (value: unknown) => typeof value === "string" ? value : "";
type Evidence = { mediaId: string; filename: string; caption?: string };
type Box = { title: string; description: string };

function ScenarioEditor({ scenario, columns, onSave }: { scenario: AutomationScenario; columns: LeadColumn[]; onSave: Props["onSave"] }) {
  const [active, setActive] = useState(scenario.isActive);
  const [config, setConfig] = useState<Record<string, unknown>>(scenario.config || {});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  useEffect(() => { setActive(scenario.isActive); setConfig(scenario.config || {}); }, [scenario]);
  const field = (name: string, label: string, placeholder = "") => <label className="scenario-field"><span>{label}</span><textarea value={asText(config[name])} placeholder={placeholder} onChange={(event) => setConfig({ ...config, [name]: event.target.value })} /></label>;
  const evidence = Array.isArray(config.evidence) ? config.evidence as Evidence[] : [];
  const boxes = Array.isArray(config.boxes) ? config.boxes as Box[] : [];
  const uploadEvidence = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setUploadError("Selecciona una imagen JPEG, PNG o WebP."); return; }
    setUploading(true);
    setUploadError("");
    try {
      const response = await fetch(`${api}/scenarios/evidence/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "X-Upload-Filename": encodeURIComponent(file.name) }, body: file });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No fue posible subir la evidencia.");
      setConfig({ ...config, evidence: [...evidence, { mediaId: result.mediaId, filename: result.filename }] });
    } catch (error) { setUploadError(error instanceof Error ? error.message : "No fue posible subir la evidencia."); } finally { setUploading(false); }
  };
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(scenario.key, { isActive: active, config }); } finally { setSaving(false); } };
  const catalogScenario = scenario.key === "catalogo_anuncio";
  return <form className="scenario-editor" onSubmit={submit}>
    <header><div><h2>{scenario.name}</h2><p>{catalogScenario ? "Atiende solicitudes de catálogo, confirma apertura y califica al lead." : "Responde dudas de envíos, comparte evidencia y recomienda cajas."}</p></div><label className="automation-active"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Activo</label></header>
    {catalogScenario ? <>
      {field("catalogCaption", "Mensaje que acompaña el catálogo")}
      {field("goalQuestion", "Pregunta después de confirmar que abrió el catálogo")}
      {field("entrepreneurQuestion", "Pregunta para quien quiere emprender")}
      {field("closingMessage", "Mensaje de cierre al volver a pedir el catálogo")}
      <label className="scenario-field"><span>Columna al terminar</span><select value={asText(config.completionColumnId)} onChange={(event) => setConfig({ ...config, completionColumnId: event.target.value })}><option value="">No mover automáticamente</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
    </> : <>
      {field("shippingMessage", "Respuesta sobre envíos")}
      {field("catalogQuestion", "Pregunta para ofrecer el catálogo")}
      {field("catalogCaption", "Mensaje que acompaña el catálogo")}
      {field("goalQuestion", "Pregunta después de enviar el catálogo")}
      {field("entrepreneurQuestion", "Pregunta para quien quiere emprender")}
      <section className="scenario-evidence"><div><strong>Fotos de evidencia</strong><small>Se subirán una sola vez a Meta y se reutilizarán con cada lead.</small></div><label className="media-button">{uploading ? "Subiendo…" : "＋ Agregar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadEvidence} disabled={uploading} /></label>{uploadError && <small>{uploadError}</small>}{evidence.map((item) => <div className="scenario-asset" key={item.mediaId}><span>{item.filename}</span><button type="button" onClick={() => setConfig({ ...config, evidence: evidence.filter((candidate) => candidate.mediaId !== item.mediaId) })}>Quitar</button></div>)}</section>
      <section className="scenario-boxes"><strong>Las 3 cajas emprendedoras</strong>{[0, 1, 2].map((index) => { const box = boxes[index] || { title: `Caja emprendedora ${index + 1}`, description: "" }; return <div className="scenario-box" key={index}><input value={box.title} placeholder="Nombre de la caja" onChange={(event) => { const next = [...boxes]; next[index] = { ...box, title: event.target.value }; setConfig({ ...config, boxes: next }); }} /><textarea value={box.description} placeholder="Mercancía, precio y ganancia aproximada" onChange={(event) => { const next = [...boxes]; next[index] = { ...box, description: event.target.value }; setConfig({ ...config, boxes: next }); }} /></div>; })}</section>
    </>}
    <button className="primary-action" disabled={saving}>{saving ? "Guardando…" : "Guardar escenario"}</button>
  </form>;
}

export function ScenariosPanel({ scenarios, columns, onSave }: Props) {
  return <section className="scenarios"><header className="automations-header"><div><p>ESCENARIOS</p><h1>Atención guiada</h1><span>Configura los mensajes y decisiones de cada etapa; el bot solo avanza cuando el cliente responde.</span></div></header><div className="scenario-list">{scenarios.map((scenario) => <ScenarioEditor key={scenario.id} scenario={scenario} columns={columns} onSave={onSave} />)}</div></section>;
}
