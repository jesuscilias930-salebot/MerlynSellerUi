"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import type { LeadColumn, RemarketingPreset, WhatsAppTemplate } from "../lib/types";

export type MoveRule = { templateId: string | null; presetId: string | null; homeColumnId?: string | null; afterSendColumnId: string | null; onReplyColumnId: string | null };
type Item = { kind: "template" | "preset"; id: string; name: string; detail: string };
const keyOf = (kind: Item["kind"], id: string) => `${kind}:${id}`;

/** Remarketing → Configuración: a qué columna se mueve el lead al enviarle cada plantilla o mensaje guardado y si responde. */
export function RemarketingMovesPanel({ columns }: { columns: Pick<LeadColumn, "id" | "name">[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [rules, setRules] = useState<Record<string, MoveRule>>({});
  const [saving, setSaving] = useState<string>("");
  const [saved, setSaved] = useState<string>("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      request<WhatsAppTemplate[]>("/whatsapp-templates"),
      request<RemarketingPreset[]>("/remarketing/presets"),
      request<MoveRule[]>("/remarketing/move-rules"),
    ]).then(([templates, presets, list]) => {
      if (!active) return;
      setItems([
        ...templates.filter(row => row.status === "APPROVED").map(row => ({ kind: "template" as const, id: row.id, name: row.name, detail: `Plantilla oficial · ${row.language}` })),
        ...presets.map(row => ({ kind: "preset" as const, id: row.id, name: row.name, detail: "Mensaje guardado (mensaje libre)" })),
      ]);
      setRules(Object.fromEntries(list.map(rule => [rule.templateId ? keyOf("template", rule.templateId) : keyOf("preset", rule.presetId || ""), rule])));
    }).catch(reason => { if (active) { setItems([]); setError(reason instanceof Error ? reason.message : "No se pudo cargar la configuración."); } });
    return () => { active = false; };
  }, []);
  const change = async (item: Item, patch: Partial<MoveRule>) => {
    const key = keyOf(item.kind, item.id);
    const current = rules[key] || { templateId: item.kind === "template" ? item.id : null, presetId: item.kind === "preset" ? item.id : null, homeColumnId: null, afterSendColumnId: null, onReplyColumnId: null };
    const next = { ...current, ...patch };
    setRules(value => ({ ...value, [key]: next }));
    setSaving(key); setSaved(""); setError("");
    try { await request("/remarketing/move-rules", { method: "PUT", body: JSON.stringify(next) }); setSaved(key); }
    catch (reason) { setRules(value => ({ ...value, [key]: current })); setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(""); }
  };
  const fieldLabel = { homeColumnId: "Columna del tablero", afterSendColumnId: "Al enviar", onReplyColumnId: "Si responde" };
  const select = (item: Item, field: "homeColumnId" | "afterSendColumnId" | "onReplyColumnId", empty: string) => {
    const rule = rules[keyOf(item.kind, item.id)];
    return <select aria-label={`${fieldLabel[field]} · ${item.name}`} value={rule?.[field] || ""} disabled={saving === keyOf(item.kind, item.id)} onChange={event => void change(item, { [field]: event.target.value || null })}>
      <option value="">{empty}</option>
      {columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}
    </select>;
  };
  return <div className="remarketing-moves">
    <p className="remarketing-moves-intro">Para cada plantilla o mensaje guardado elige <b>en qué columna del tablero aparece</b> (para enviarlo desde ahí con el botón 📣) y a qué columna se mueve el lead. <b>Al enviar</b>: cuando el mensaje sale, aunque el lead esté fijado 📌 (se le quita el fijado). <b>Si responde</b>: con su primera respuesta a ese envío se mueve siempre —aunque esté fijado o en otro dashboard— y queda fijado ahí. Sin columna en «Si responde», se usa R-HOT como hasta ahora.</p>
    {error && <p className="template-campaign-error" role="alert">{error}</p>}
    {items === null ? <p>Cargando…</p> : items.length === 0 ? <div className="column-rules-empty"><b>No hay plantillas aprobadas ni mensajes guardados.</b><span>Sincroniza tus plantillas en Plantillas oficiales o guarda un mensaje en Mensaje libre.</span></div> :
      <div className="remarketing-moves-table" role="table">
        <div role="row" className="remarketing-moves-head"><span role="columnheader">Mensaje</span><span role="columnheader">Columna del tablero</span><span role="columnheader">Al enviar, mover a</span><span role="columnheader">Si responde, mover a</span></div>
        {items.map(item => <div role="row" key={keyOf(item.kind, item.id)}>
          <span role="cell"><b>{item.name}</b><small>{item.detail}{saved === keyOf(item.kind, item.id) ? " · ✓ Guardado" : ""}</small></span>
          <span role="cell">{select(item, "homeColumnId", "Ninguna")}</span>
          <span role="cell">{select(item, "afterSendColumnId", "No mover")}</span>
          <span role="cell">{select(item, "onReplyColumnId", "R-HOT (como hasta ahora)")}</span>
        </div>)}
      </div>}
  </div>;
}
