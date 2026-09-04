"use client";

import { ChangeEvent, DragEvent, FormEvent, useState } from "react";
import { api } from "../lib/api";
import type { AutomationScenario, LeadColumn, ScenarioBranch, ScenarioMedia, ScenarioStep } from "../lib/types";

type Draft = Omit<AutomationScenario, "id" | "key" | "updatedAt" | "position">;
type Props = { scenarios: AutomationScenario[]; columns: LeadColumn[]; onSave: (value: Draft, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onReorder: (scenarioIds: string[]) => Promise<void> };
const stepId = () => `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const blankStep = (type: ScenarioStep["type"] = "send_text"): ScenarioStep => ({ id: stepId(), type, label: type === "send_text" ? "Enviar mensaje" : type === "wait_reply" ? "Esperar respuesta" : type === "send_catalog" ? "Enviar catálogo" : type === "send_media" ? "Enviar archivos" : type === "move_column" ? "Mover lead" : "Finalizar", ...(type === "send_text" ? { body: "" } : {}), ...(type === "wait_reply" ? { branches: [] } : {}) });
const emptyScenario = (): Draft => { const message = blankStep("send_text"); const end = blankStep("end"); message.nextStepId = end.id; return { name: "", isActive: true, triggerExamples: [], aiDescription: "", priority: 0, canInterrupt: true, steps: [message, end] }; };
const labels: Record<ScenarioStep["type"], string> = { send_text: "Enviar texto", send_catalog: "Enviar catálogo", send_media: "Enviar imágenes o documentos", wait_reply: "Esperar y decidir", move_column: "Mover a columna", end: "Finalizar" };

function Editor({ initial, columns, onSave, onDelete, onCancel }: { initial?: AutomationScenario; columns: LeadColumn[]; onSave: Props["onSave"]; onDelete?: () => Promise<void>; onCancel?: () => void }) {
  const [value, setValue] = useState<Draft>(initial ? { name: initial.name, isActive: initial.isActive, triggerExamples: initial.triggerExamples, aiDescription: initial.aiDescription || "", priority: initial.priority || 0, canInterrupt: initial.canInterrupt !== false, steps: initial.steps } : emptyScenario());
  const [triggerText, setTriggerText] = useState((initial?.triggerExamples || []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(!initial);
  const [newStepType, setNewStepType] = useState("");
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const ids = value.steps.map((step) => step.id);
  const updateStep = (id: string, patch: Partial<ScenarioStep>) => setValue({ ...value, steps: value.steps.map((step) => step.id === id ? { ...step, ...patch } : step) });
  const removeStep = (id: string) => setValue({ ...value, steps: value.steps.filter((step) => step.id !== id).map((step) => ({ ...step, nextStepId: step.nextStepId === id ? undefined : step.nextStepId, fallbackStepId: step.fallbackStepId === id ? undefined : step.fallbackStepId, branches: step.branches?.filter((branch) => branch.nextStepId !== id) })) });
  const dropStep = (event: DragEvent<HTMLElement>, destinationId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/merlynsales-scenario-step") || draggingStepId;
    setDraggingStepId(null);
    if (!sourceId || sourceId === destinationId) return;
    setValue((current) => {
      const steps = [...current.steps];
      const from = steps.findIndex((step) => step.id === sourceId);
      const to = steps.findIndex((step) => step.id === destinationId);
      if (from < 0 || to < 0) return current;
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      return { ...current, steps };
    });
  };
  const selectStep = (step: ScenarioStep) => <select value={step.nextStepId || ""} onChange={(event) => updateStep(step.id, { nextStepId: event.target.value || undefined })}><option value="">Terminar después de este paso</option>{value.steps.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label || candidate.id}</option>)}</select>;
  const uploadMedia = async (step: ScenarioStep, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { setError("Selecciona una imagen JPEG, PNG, WebP o un PDF."); return; }
    setError("");
    try { const response = await fetch(`${api}/scenarios/evidence/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "X-Upload-Filename": encodeURIComponent(file.name) }, body: file }); const uploaded = await response.json().catch(() => ({})); if (!response.ok) throw new Error(uploaded.error || "No fue posible subir el archivo."); updateStep(step.id, { items: [...(step.items || []), { mediaId: uploaded.mediaId, filename: uploaded.filename, type: file.type === "application/pdf" ? "document" : "image" }] }); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible subir el archivo."); }
  };
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await onSave({ ...value, aiDescription: value.aiDescription?.trim() || null, triggerExamples: triggerText.split("\n").map((item) => item.trim()).filter(Boolean) }, initial?.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar."); } finally { setSaving(false); } };
  return <form className="scenario-editor generic-scenario-editor" onSubmit={submit}>
    <header><div><h2>{initial ? value.name : "Nuevo escenario"}</h2><p>{value.steps.length} pasos · {value.triggerExamples.length || triggerText.split("\n").filter(Boolean).length} frases disparadoras</p></div><div className="collapsible-actions"><button className="collapse-toggle" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>{expanded ? "⌃ Ocultar" : "⌄ Editar"}</button><label className="automation-active"><input type="checkbox" checked={value.isActive} onChange={(event) => setValue({ ...value, isActive: event.target.checked })} /> Activo</label></div></header>
    {expanded && <>
    <div className="scenario-meta"><label className="scenario-field"><span>Nombre del escenario</span><input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Ej. Cotización para mayoristas" required /></label><label className="scenario-field"><span>Frases que inician el flujo — una por línea</span><textarea value={triggerText} onChange={(event) => setTriggerText(event.target.value)} placeholder="Quiero una cotización\n¿Cuánto cuesta mayoreo?" required /></label><label className="scenario-field"><span>Descripción para la IA</span><textarea value={value.aiDescription || ""} onChange={(event) => setValue({ ...value, aiDescription: event.target.value })} placeholder="Ej. Cliente pregunta si hacemos envíos a México, cualquier estado o ciudad; incluye faltas como ‘ase envios’." /></label><label className="scenario-field"><span>Prioridad</span><input type="number" min="0" max="1000" value={value.priority} onChange={(event) => setValue({ ...value, priority: Number(event.target.value) || 0 })} /></label><label className="automation-active"><input type="checkbox" checked={value.canInterrupt} onChange={(event) => setValue({ ...value, canInterrupt: event.target.checked })} /> Puede reemplazar otro escenario activo si coincide claramente</label></div>
    <section className="scenario-steps"><div className="scenario-section-title"><strong>Pasos del flujo</strong><small>Arrastra ⠿ para cambiar el orden. Las conexiones siguen apuntando al mismo paso.</small></div>{value.steps.map((step, index) => <section className={`scenario-step${draggingStepId === step.id ? " dragging" : ""}`} key={step.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropStep(event, step.id)}><div className="scenario-step-heading"><span className="step-drag-handle" draggable title="Arrastra para reordenar este paso" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/merlynsales-scenario-step", step.id); setDraggingStepId(step.id); }} onDragEnd={() => setDraggingStepId(null)}>⠿</span><b>{index + 1}</b><input value={step.label} onChange={(event) => updateStep(step.id, { label: event.target.value })} aria-label="Nombre del paso" /><select value={step.type} onChange={(event) => { const type = event.target.value as ScenarioStep["type"]; updateStep(step.id, { type, body: type === "send_text" ? step.body || "" : undefined, branches: type === "wait_reply" ? step.branches || [] : undefined, items: type === "send_media" ? step.items || [] : undefined }); }}>{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select><button type="button" className="plain-button" onClick={() => removeStep(step.id)} disabled={value.steps.length <= 1}>Eliminar</button></div>
      {step.type === "send_text" && <label className="scenario-field"><span>Texto a enviar</span><textarea value={step.body || ""} onChange={(event) => updateStep(step.id, { body: event.target.value })} required /></label>}
      {step.type === "send_catalog" && <><label className="scenario-field"><span>Texto que acompaña el catálogo</span><textarea value={step.caption || ""} onChange={(event) => updateStep(step.id, { caption: event.target.value })} placeholder="Opcional" /></label><label className="automation-active"><input type="checkbox" checked={step.resendCatalog === true} onChange={(event) => updateStep(step.id, { resendCatalog: event.target.checked })} /> Reenviar aunque el catálogo ya exista en la conversación</label></>}
      {step.type === "send_media" && <div className="scenario-media"><label className="media-button">＋ Subir imagen o PDF reutilizable<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" onChange={(event) => uploadMedia(step, event)} /></label>{(step.items || []).map((item: ScenarioMedia) => <div className="scenario-asset" key={item.mediaId}><span>{item.filename || item.mediaId}</span><button type="button" onClick={() => updateStep(step.id, { items: (step.items || []).filter((candidate) => candidate.mediaId !== item.mediaId) })}>Quitar</button></div>)}</div>}
      {step.type === "move_column" && <label className="scenario-field"><span>Columna destino</span><select value={step.columnId || ""} onChange={(event) => updateStep(step.id, { columnId: event.target.value })}><option value="">No mover</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>}
      {step.type === "wait_reply" && <label className="scenario-field"><span>Respuesta si el cliente dice algo diferente</span><textarea value={step.fallbackBody || ""} onChange={(event) => updateStep(step.id, { fallbackBody: event.target.value })} placeholder="Ej. Claro, tómate tu tiempo 😊. Cuando lo revises, dime si buscas emprender o surtir tu negocio." /><small>Mientras este escenario está activo, esta respuesta evita que otra automatización envíe un catálogo repetido.</small></label>}
      {step.type === "wait_reply" && <div className="scenario-branches"><strong>Posibles respuestas</strong>{(step.branches || []).map((branch, branchIndex) => <div className="scenario-branch" key={branch.id}><input value={branch.name} placeholder="Nombre de intención" onChange={(event) => { const next = [...(step.branches || [])]; next[branchIndex] = { ...branch, name: event.target.value }; updateStep(step.id, { branches: next }); }} /><textarea value={branch.examples.join("\n")} placeholder="Una frase por línea" onChange={(event) => { const next = [...(step.branches || [])]; next[branchIndex] = { ...branch, examples: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) }; updateStep(step.id, { branches: next }); }} /><select value={branch.nextStepId} onChange={(event) => { const next = [...(step.branches || [])]; next[branchIndex] = { ...branch, nextStepId: event.target.value }; updateStep(step.id, { branches: next }); }}>{ids.map((id) => <option key={id} value={id}>{value.steps.find((candidate) => candidate.id === id)?.label || id}</option>)}</select><button type="button" onClick={() => updateStep(step.id, { branches: (step.branches || []).filter((candidate) => candidate.id !== branch.id) })}>×</button></div>)}<button type="button" className="plain-button" onClick={() => { const branch: ScenarioBranch = { id: `branch_${stepId()}`, name: "", examples: [], nextStepId: value.steps.find((candidate) => candidate.id !== step.id)?.id || step.id }; updateStep(step.id, { branches: [...(step.branches || []), branch] }); }}>＋ Agregar respuesta</button></div>}
      {!['wait_reply', 'end'].includes(step.type) && <label className="scenario-next"><span>Siguiente paso</span>{selectStep(step)}</label>}
    </section>)}</section>
    <div className="scenario-toolbar"><select value={newStepType} onChange={(event) => { const type = event.target.value as ScenarioStep["type"] | ""; setNewStepType(type); if (!type) return; setValue((current) => ({ ...current, steps: [...current.steps, blankStep(type)] })); setNewStepType(""); }}><option value="">＋ Agregar paso…</option>{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></div>
    {error && <p className="scenario-error">{error}</p>}<div className="automation-actions"><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : "Guardar escenario"}</button>{onDelete && <button type="button" className="danger" onClick={() => void onDelete()}>Eliminar escenario</button>}{onCancel && <button type="button" className="plain-button" onClick={onCancel}>Cancelar</button>}</div>
    </>}
  </form>;
}

export function ScenariosPanel({ scenarios, columns, onSave, onDelete, onReorder }: Props) {
  const [creating, setCreating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const dropScenario = async (event: DragEvent<HTMLDivElement>, destinationId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/merlynsales-scenario") || draggingId;
    setDraggingId(null);
    if (!sourceId || sourceId === destinationId || savingOrder) return;
    const ordered = [...scenarios]; const from = ordered.findIndex((item) => item.id === sourceId); const to = ordered.findIndex((item) => item.id === destinationId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved);
    setSavingOrder(true);
    try { await onReorder(ordered.map((item) => item.id)); } finally { setSavingOrder(false); }
  };
  return <section className="scenarios"><header className="automations-header"><div><p>ESCENARIOS</p><h1>Atención guiada</h1><span>Arrastra los escenarios para definir cuál se evalúa primero cuando ambos coinciden.</span></div><button className="primary-action" type="button" onClick={() => setCreating(true)} disabled={creating}>＋ Nuevo escenario</button></header><div className="scenario-list">{scenarios.map((scenario) => <div key={scenario.id} className={`scenario-drag-item${draggingId === scenario.id ? " dragging" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropScenario(event, scenario.id)}><div className="scenario-drag-handle" draggable title="Arrastra para reordenar" aria-label="Arrastra para reordenar" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/merlynsales-scenario", scenario.id); setDraggingId(scenario.id); }} onDragEnd={() => setDraggingId(null)}>⠿</div><Editor initial={scenario} columns={columns} onSave={onSave} onDelete={() => onDelete(scenario.id)} /></div>)}{creating && <Editor columns={columns} onSave={async (value) => { await onSave(value); setCreating(false); }} onCancel={() => setCreating(false)} />}</div>{savingOrder && <small className="scenario-order-saving">Guardando orden…</small>}</section>;
}
