"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { AutomationScenario, LeadColumn, ScenarioBranch, ScenarioMedia, ScenarioStep } from "../lib/types";

type Draft = Omit<AutomationScenario, "id" | "key" | "updatedAt" | "position">;
type Props = { scenarios: AutomationScenario[]; columns: LeadColumn[]; onSave: (value: Draft, id?: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onReorder: (scenarioIds: string[]) => Promise<void> };
type ReusableScenarioMedia = ScenarioMedia & { source: string };

const stepId = () => `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const labels: Record<ScenarioStep["type"], string> = { send_text: "Enviar mensaje", send_catalog: "Enviar catálogo", send_media: "Enviar imágenes o documentos", wait_reply: "Esperar respuesta", move_column: "Mover lead", end: "Finalizar" };
const icons: Record<ScenarioStep["type"], string> = { send_text: "✉", send_catalog: "▤", send_media: "▧", wait_reply: "◌", move_column: "↗", end: "✓" };
const blankStep = (type: ScenarioStep["type"] = "send_text"): ScenarioStep => ({ id: stepId(), type, label: labels[type], ...(type === "send_text" ? { body: "" } : {}), ...(type === "wait_reply" ? { branches: [] } : {}) });
const emptyScenario = (): Draft => { const message = blankStep("send_text"); const end = blankStep("end"); message.nextStepId = end.id; return { name: "", isActive: true, triggerExamples: [], aiDescription: "", priority: 0, canInterrupt: true, steps: [message, end] }; };
const truncate = (value?: string, limit = 78) => !value ? "Sin contenido configurado" : value.length > limit ? `${value.slice(0, limit)}…` : value;

function FlowBuilder({ initial, columns, reusableMedia, onSave, onDelete, onCancel }: { initial?: AutomationScenario; columns: LeadColumn[]; reusableMedia: ReusableScenarioMedia[]; onSave: Props["onSave"]; onDelete?: () => Promise<void>; onCancel?: () => void }) {
  const [value, setValue] = useState<Draft>(initial ? { name: initial.name, isActive: initial.isActive, triggerExamples: initial.triggerExamples, aiDescription: initial.aiDescription || "", priority: initial.priority || 0, canInterrupt: initial.canInterrupt !== false, steps: initial.steps } : emptyScenario());
  const [triggerText, setTriggerText] = useState((initial?.triggerExamples || []).join("\n"));
  const [selectedStepId, setSelectedStepId] = useState(value.steps[0]?.id || "");
  const [newStepType, setNewStepType] = useState<ScenarioStep["type"]>("send_text");
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(!initial);
  const [stepEditorOpen, setStepEditorOpen] = useState(false);
  const selectedStep = value.steps.find((step) => step.id === selectedStepId) || value.steps[0];
  const flowGraph = useMemo(() => {
    const byStepId = new Map(value.steps.map((step) => [step.id, step]));
    const incoming = new Set<string>();
    const edges = value.steps.flatMap((step) => [
      ...(step.nextStepId ? [{ from: step.id, to: step.nextStepId, label: "continúa", kind: "direct" }] : []),
      ...(step.fallbackStepId ? [{ from: step.id, to: step.fallbackStepId, label: "si no coincide", kind: "fallback" }] : []),
      ...(step.branches || []).map((branch) => ({ from: step.id, to: branch.nextStepId, label: branch.name || "respuesta", kind: "branch" })),
    ].filter((edge) => byStepId.has(edge.to)));
    edges.forEach((edge) => incoming.add(edge.to));
    const roots = value.steps.filter((step) => !incoming.has(step.id));
    const levels = new Map<string, number>();
    const queue = (roots.length ? roots : value.steps.slice(0, 1)).map((step) => ({ id: step.id, level: 0 }));
    while (queue.length) {
      const current = queue.shift();
      if (!current || levels.has(current.id)) continue;
      levels.set(current.id, current.level);
      edges.filter((edge) => edge.from === current.id).forEach((edge) => queue.push({ id: edge.to, level: current.level + 1 }));
    }
    value.steps.forEach((step) => { if (!levels.has(step.id)) levels.set(step.id, 0); });
    const groups = new Map<number, ScenarioStep[]>();
    value.steps.forEach((step) => { const level = levels.get(step.id) || 0; groups.set(level, [...(groups.get(level) || []), step]); });
    const positions = new Map<string, { x: number; y: number }>();
    const columnCount = Math.max(1, ...groups.keys()) + 1;
    let tallestColumn = 1;
    groups.forEach((steps, level) => {
      tallestColumn = Math.max(tallestColumn, steps.length);
      steps.forEach((step, index) => positions.set(step.id, { x: 44 + level * 274, y: 48 + index * 172 }));
    });
    return { edges, positions, width: Math.max(760, columnCount * 274 + 66), height: Math.max(430, tallestColumn * 172 + 100) };
  }, [value.steps]);
  const currentScenarioMedia: ReusableScenarioMedia[] = value.steps.flatMap((step) => step.type === "send_media" ? (step.items || []).map((item) => ({ ...item, source: value.name.trim() || "Este escenario" })) : []);
  const mediaLibrary = useMemo(() => [...new Map([...reusableMedia, ...currentScenarioMedia].map((item) => [item.mediaId, item])).values()], [reusableMedia, currentScenarioMedia]);
  const issues = useMemo(() => value.steps.flatMap((step, index) => {
    const prefix = `Paso ${index + 1}`;
    if (step.type === "send_text" && !step.body?.trim()) return [`${prefix}: falta el mensaje.`];
    if (step.type === "send_media" && !(step.items || []).length) return [`${prefix}: agrega al menos un archivo.`];
    if (step.type === "wait_reply" && !(step.branches || []).length) return [`${prefix}: agrega una respuesta posible.`];
    if (step.type === "wait_reply" && (step.branches || []).some((branch) => !branch.name.trim() || !branch.examples.some((example) => example.trim()) || !branch.nextStepId)) return [`${prefix}: completa el nombre, ejemplos y destino de cada respuesta.`];
    if ([step.nextStepId, step.fallbackStepId, ...(step.branches || []).map((branch) => branch.nextStepId)].filter(Boolean).some((id) => !value.steps.some((candidate) => candidate.id === id))) return [`${prefix}: hay una conexión que apunta a un paso eliminado.`];
    return [];
  }), [value.steps]);

  const updateStep = (id: string, patch: Partial<ScenarioStep>) => setValue((current) => ({ ...current, steps: current.steps.map((step) => step.id === id ? { ...step, ...patch } : step) }));
  const openStepEditor = (id: string) => { setSelectedStepId(id); setStepEditorOpen(true); };
  const targetOptions = (currentId: string) => value.steps.filter((step) => step.id !== currentId);
  const addStep = () => {
    const step = blankStep(newStepType);
    setValue((current) => {
      const selected = current.steps.find((candidate) => candidate.id === selectedStepId);
      const steps = [...current.steps, step].map((candidate) => selected && candidate.id === selected.id && !selected.nextStepId && !["wait_reply", "end"].includes(selected.type) ? { ...candidate, nextStepId: step.id } : candidate);
      return { ...current, steps };
    });
    setSelectedStepId(step.id);
    setStepEditorOpen(true);
  };
  const removeStep = (id: string) => {
    if (value.steps.length <= 1) return;
    const remaining = value.steps.filter((step) => step.id !== id).map((step) => ({ ...step, nextStepId: step.nextStepId === id ? undefined : step.nextStepId, fallbackStepId: step.fallbackStepId === id ? undefined : step.fallbackStepId, branches: step.branches?.filter((branch) => branch.nextStepId !== id) }));
    setValue({ ...value, steps: remaining });
    setSelectedStepId(remaining[0]?.id || "");
    setStepEditorOpen(false);
  };
  const dropStep = (event: DragEvent<HTMLElement>, destinationId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/merlynsales-scenario-step") || draggingStepId;
    setDraggingStepId(null);
    if (!sourceId || sourceId === destinationId) return;
    setValue((current) => {
      const steps = [...current.steps]; const from = steps.findIndex((step) => step.id === sourceId); const to = steps.findIndex((step) => step.id === destinationId);
      if (from < 0 || to < 0) return current;
      const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved);
      return { ...current, steps };
    });
  };
  const uploadMedia = async (step: ScenarioStep, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { setError("Selecciona una imagen JPEG, PNG, WebP o un PDF."); return; }
    setError("");
    try {
      const response = await fetch(`${api}/scenarios/evidence/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": file.type, "X-Upload-Filename": encodeURIComponent(file.name) }, body: file });
      const uploaded = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(uploaded.error || "No fue posible subir el archivo.");
      updateStep(step.id, { items: [...(step.items || []), { mediaId: uploaded.mediaId, filename: uploaded.filename, type: file.type === "application/pdf" ? "document" : "image" }] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible subir el archivo."); }
  };
  const addReusableMedia = (step: ScenarioStep, mediaId: string) => {
    const item = mediaLibrary.find((candidate) => candidate.mediaId === mediaId);
    if (!item || (step.items || []).some((candidate) => candidate.mediaId === item.mediaId)) return;
    updateStep(step.id, { items: [...(step.items || []), { mediaId: item.mediaId, filename: item.filename, caption: item.caption, type: item.type }] });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await onSave({ ...value, aiDescription: value.aiDescription?.trim() || null, triggerExamples: triggerText.split("\n").map((item) => item.trim()).filter(Boolean), steps: value.steps.map((step) => ({ ...step, branches: step.branches?.map((branch) => ({ ...branch, name: branch.name.trim(), aiDescription: branch.aiDescription?.trim() || undefined, examples: branch.examples.map((item) => item.trim()).filter(Boolean) })) })) }, initial?.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar."); } finally { setSaving(false); }
  };
  const branchEditor = (step: ScenarioStep) => <div className="flow-branches"><strong>Si el cliente responde…</strong><small>Las frases se comparan primero. Si no coinciden, la IA usa la descripción de significado para elegir una rama solo cuando tiene alta confianza.</small>{(step.branches || []).map((branch, branchIndex) => <article key={branch.id}><input value={branch.name} placeholder="Ej. Confirmó que abrió el catálogo" onChange={(event) => { const branches = [...(step.branches || [])]; branches[branchIndex] = { ...branch, name: event.target.value }; updateStep(step.id, { branches }); }} /><textarea value={branch.aiDescription || ""} placeholder="Significado para la IA: el cliente confirma que pudo abrir, ver o consultar el catálogo correctamente." onChange={(event) => { const branches = [...(step.branches || [])]; branches[branchIndex] = { ...branch, aiDescription: event.target.value }; updateStep(step.id, { branches }); }} /><textarea value={branch.examples.join("\n")} placeholder="Frases conocidas que significan esta respuesta, una por línea" onChange={(event) => { const branches = [...(step.branches || [])]; branches[branchIndex] = { ...branch, examples: event.target.value.split("\n") }; updateStep(step.id, { branches }); }} /><label>Continuar en<select value={branch.nextStepId} onChange={(event) => { const branches = [...(step.branches || [])]; branches[branchIndex] = { ...branch, nextStepId: event.target.value }; updateStep(step.id, { branches }); }}><option value="">Selecciona un paso…</option>{targetOptions(step.id).map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label><button type="button" className="danger-link" onClick={() => updateStep(step.id, { branches: (step.branches || []).filter((candidate) => candidate.id !== branch.id) })}>Eliminar</button></article>)}<button type="button" className="plain-button" onClick={() => { const next = targetOptions(step.id)[0]; const branch: ScenarioBranch = { id: `branch_${stepId()}`, name: "", aiDescription: "", examples: [], nextStepId: next?.id || "" }; updateStep(step.id, { branches: [...(step.branches || []), branch] }); }}>＋ Agregar respuesta</button></div>;

  return <form className="flow-builder" onSubmit={submit}>
    <header className="flow-builder-header"><div><p>ESCENARIO</p><h1>{initial ? value.name || "Escenario sin nombre" : "Nuevo escenario"}</h1><span>{value.steps.length} pasos · {issues.length ? `${issues.length} detalle${issues.length === 1 ? "" : "s"} por revisar` : "Flujo listo para guardar"}</span></div><div><label className="scenario-active-toggle"><input type="checkbox" checked={value.isActive} onChange={(event) => setValue({ ...value, isActive: event.target.checked })} /> Activo</label><button className="primary-action" disabled={saving}>{saving ? "Guardando…" : "Guardar escenario"}</button></div></header>
    <button type="button" className="flow-settings-trigger" onClick={() => setSettingsOpen(true)}>⚙ Configuración del escenario</button>
    {settingsOpen && <div className="scenario-modal" role="dialog" aria-modal="true" aria-label="Configuración del escenario"><button type="button" className="scenario-modal-backdrop" aria-label="Cerrar" onClick={() => setSettingsOpen(false)} /><section className="scenario-modal-card scenario-settings-modal"><header><div><p>ESCENARIO</p><h2>Configuración</h2></div><button type="button" className="scenario-modal-close" onClick={() => setSettingsOpen(false)}>×</button></header><div className="flow-settings-modal-fields"><label>Nombre del escenario<input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Ej. Envíos nacionales" required /></label><label>Frases que inician el flujo<textarea value={triggerText} onChange={(event) => setTriggerText(event.target.value)} placeholder="Hacen envíos\nEnvían a Veracruz" required /></label><label>Descripción para la IA<textarea value={value.aiDescription || ""} onChange={(event) => setValue({ ...value, aiDescription: event.target.value })} placeholder="Describe el propósito del escenario y qué preguntas debe reconocer." /></label><label>Prioridad<input type="number" min="0" max="1000" value={value.priority} onChange={(event) => setValue({ ...value, priority: Number(event.target.value) || 0 })} /></label><label className="scenario-active-toggle"><input type="checkbox" checked={value.canInterrupt} onChange={(event) => setValue({ ...value, canInterrupt: event.target.checked })} /> Puede reemplazar otro escenario activo si coincide claramente</label></div><footer><button type="button" className="primary-action" onClick={() => setSettingsOpen(false)}>Listo</button></footer></section></div>}
    <div className="flow-builder-layout"><section className="flow-canvas" aria-label="Flujo del escenario"><header><div><strong>Mapa del flujo</strong><small>Selecciona una tarjeta para editarla. Las líneas muestran las conexiones reales; las punteadas son respuestas o rutas alternativas.</small></div><div className="flow-add"><select value={newStepType} onChange={(event) => setNewStepType(event.target.value as ScenarioStep["type"])}>{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select><button type="button" className="plain-button" onClick={addStep}>＋ Agregar paso</button></div></header><div className="flow-map-viewport"><div className="flow-map" style={{ width: flowGraph.width, height: flowGraph.height }}><svg className="flow-map-links" width={flowGraph.width} height={flowGraph.height} aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>{flowGraph.edges.map((edge) => { const source = flowGraph.positions.get(edge.from); const target = flowGraph.positions.get(edge.to); if (!source || !target) return null; const startX = source.x + 218; const startY = source.y + 54; const endX = target.x; const endY = target.y + 54; const curve = Math.max(55, (endX - startX) * .45); return <g key={`${edge.from}-${edge.to}-${edge.label}`}><path className={`flow-map-link ${edge.kind}`} d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`} /><text x={(startX + endX) / 2} y={(startY + endY) / 2 - 9}>{edge.label}</text></g>; })}</svg>{value.steps.map((step) => { const position = flowGraph.positions.get(step.id) || { x: 44, y: 48 }; return <article key={step.id} className={`flow-map-node${selectedStep?.id === step.id ? " selected" : ""}${draggingStepId === step.id ? " dragging" : ""}`} style={{ left: position.x, top: position.y }} onClick={() => openStepEditor(step.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropStep(event, step.id)}><button type="button" className="flow-drag" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/merlynsales-scenario-step", step.id); setDraggingStepId(step.id); }} onDragEnd={() => setDraggingStepId(null)} title="Arrastra para reordenar">⠿</button><span className="flow-node-icon">{icons[step.type]}</span><div><small>{labels[step.type]}</small><strong>{step.label}</strong><em>{step.type === "send_text" ? truncate(step.body, 45) : step.type === "send_media" ? `${(step.items || []).length} archivo${(step.items || []).length === 1 ? "" : "s"}` : step.type === "wait_reply" ? `${(step.branches || []).length} respuesta${(step.branches || []).length === 1 ? "" : "s"}` : step.type === "move_column" ? columns.find((column) => column.id === step.columnId)?.name || "Sin columna" : labels[step.type]}</em></div><button type="button" className="flow-node-edit" onClick={(event) => { event.stopPropagation(); openStepEditor(step.id); }}>Editar</button></article>; })}</div></div></section>
      <aside className="flow-inspector flow-inspector-modal" data-open={stepEditorOpen} aria-label="Editor del paso">{selectedStep ? <><header><div><p>PASO {value.steps.findIndex((step) => step.id === selectedStep.id) + 1}</p><h2>{selectedStep.label}</h2></div><div className="flow-inspector-actions"><button type="button" className="danger-link" onClick={() => removeStep(selectedStep.id)} disabled={value.steps.length <= 1}>Eliminar</button><button type="button" className="scenario-modal-close" onClick={() => setStepEditorOpen(false)}>×</button></div></header><label>Nombre visible del paso<input value={selectedStep.label} onChange={(event) => updateStep(selectedStep.id, { label: event.target.value })} /></label><label>Acción<select value={selectedStep.type} onChange={(event) => { const type = event.target.value as ScenarioStep["type"]; updateStep(selectedStep.id, { type, label: selectedStep.label || labels[type], body: type === "send_text" ? selectedStep.body || "" : undefined, branches: type === "wait_reply" ? selectedStep.branches || [] : undefined, items: type === "send_media" ? selectedStep.items || [] : undefined }); }}>{Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>{selectedStep.type === "send_text" && <label>Mensaje<textarea value={selectedStep.body || ""} onChange={(event) => updateStep(selectedStep.id, { body: event.target.value })} placeholder="Escribe el mensaje que recibirá el cliente" /></label>}{selectedStep.type === "send_catalog" && <><label>Mensaje que acompaña el catálogo<textarea value={selectedStep.caption || ""} onChange={(event) => updateStep(selectedStep.id, { caption: event.target.value })} placeholder="Opcional" /></label><label className="scenario-active-toggle"><input type="checkbox" checked={selectedStep.resendCatalog === true} onChange={(event) => updateStep(selectedStep.id, { resendCatalog: event.target.checked })} /> Reenviar aunque ya exista en la conversación</label></>}{selectedStep.type === "send_media" && <div className="flow-media-picker"><strong>Archivos de este paso</strong><div><label className="media-button">＋ Subir archivo nuevo<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" onChange={(event) => uploadMedia(selectedStep, event)} /></label><select defaultValue="" onChange={(event) => { addReusableMedia(selectedStep, event.target.value); event.target.value = ""; }} disabled={!mediaLibrary.some((item) => !(selectedStep.items || []).some((current) => current.mediaId === item.mediaId))}><option value="">Reutilizar imagen o documento…</option>{mediaLibrary.filter((item) => !(selectedStep.items || []).some((current) => current.mediaId === item.mediaId)).map((item) => <option key={item.mediaId} value={item.mediaId}>{item.type === "document" ? "PDF" : "Imagen"} · {item.filename || "Sin nombre"} · {item.source}</option>)}</select></div>{(selectedStep.items || []).length === 0 ? <small>Aún no hay archivos para enviar.</small> : selectedStep.items?.map((item) => <article key={item.mediaId}><span>{item.type === "document" ? "PDF" : "IMG"}</span><strong>{item.filename || item.mediaId}</strong><button type="button" className="danger-link" onClick={() => updateStep(selectedStep.id, { items: (selectedStep.items || []).filter((candidate) => candidate.mediaId !== item.mediaId) })}>Quitar</button></article>)}</div>}{selectedStep.type === "wait_reply" && <><label>Respuesta si no coincide con ninguna opción<textarea value={selectedStep.fallbackBody || ""} onChange={(event) => updateStep(selectedStep.id, { fallbackBody: event.target.value })} placeholder="Opcional. Si queda vacío, el lead pasa a Requiere atención." /></label>{branchEditor(selectedStep)}</>}{selectedStep.type === "move_column" && <label>Columna de destino<select value={selectedStep.columnId || ""} onChange={(event) => updateStep(selectedStep.id, { columnId: event.target.value })}><option value="">No mover</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>}{!["wait_reply", "end"].includes(selectedStep.type) && <label>Después, continuar en<select value={selectedStep.nextStepId || ""} onChange={(event) => updateStep(selectedStep.id, { nextStepId: event.target.value || undefined })}><option value="">Terminar después de este paso</option>{targetOptions(selectedStep.id).map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>}</> : <div className="flow-empty">Selecciona un paso para configurarlo.</div>}</aside></div>
    <footer className={`flow-validation${issues.length ? " has-issues" : ""}`}><div><strong>{issues.length ? "Revisa antes de guardar" : "Flujo validado"}</strong><span>{issues.length ? issues.join(" ") : "Todos los pasos requeridos tienen contenido y conexiones válidas."}</span></div>{onCancel && <button type="button" className="plain-button" onClick={onCancel}>Cancelar</button>}{onDelete && <button type="button" className="danger-link" onClick={() => void onDelete()}>Eliminar escenario</button>}</footer>{error && <p className="scenario-error">{error}</p>}
  </form>;
}

export function ScenariosPanel({ scenarios, columns, onSave, onDelete, onReorder }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(scenarios[0]?.id || null);
  const [creating, setCreating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedId) || scenarios[0];
  const reusableMedia: ReusableScenarioMedia[] = scenarios.flatMap((scenario) => scenario.steps.flatMap((step) => step.type === "send_media" ? (step.items || []).map((item) => ({ ...item, source: scenario.name })) : []));
  const dropScenario = async (event: DragEvent<HTMLButtonElement>, destinationId: string) => {
    event.preventDefault(); const sourceId = event.dataTransfer.getData("text/merlynsales-scenario") || draggingId; setDraggingId(null);
    if (!sourceId || sourceId === destinationId || savingOrder) return;
    const ordered = [...scenarios]; const from = ordered.findIndex((item) => item.id === sourceId); const to = ordered.findIndex((item) => item.id === destinationId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1); ordered.splice(to, 0, moved); setSavingOrder(true);
    try { await onReorder(ordered.map((item) => item.id)); } finally { setSavingOrder(false); }
  };
  return <section className="scenario-studio"><header className="scenario-studio-header"><div><p>ESCENARIOS</p><h1>Constructor de flujos</h1><span>Diseña conversaciones visualmente: elige un paso, conéctalo y configura solo lo necesario.</span></div><button className="plain-button scenario-library-toggle" type="button" onClick={() => setLibraryOpen((open) => !open)}>☰ {libraryOpen ? "Ocultar escenarios" : "Escenarios"}</button><button className="primary-action" type="button" onClick={() => { setCreating(true); setSelectedId(null); }}>＋ Nuevo escenario</button></header><div className="scenario-studio-layout" data-library-open={libraryOpen}>{libraryOpen && <aside className="scenario-library"><header><strong>Mis escenarios</strong><small>Arrastra para definir prioridad</small></header>{scenarios.length === 0 && !creating && <p>Aún no hay escenarios. Crea el primero para comenzar.</p>}{scenarios.map((scenario) => <button key={scenario.id} type="button" draggable className={`${selectedScenario?.id === scenario.id && !creating ? "selected" : ""}${draggingId === scenario.id ? " dragging" : ""}`} onClick={() => { setSelectedId(scenario.id); setCreating(false); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/merlynsales-scenario", scenario.id); setDraggingId(scenario.id); }} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropScenario(event, scenario.id)}><span>⠿</span><div><strong>{scenario.name}</strong><small>{scenario.steps.length} pasos · {scenario.isActive ? "Activo" : "Pausado"}</small></div></button>)}{savingOrder && <small className="scenario-order-saving">Guardando orden…</small>}</aside>}<div className="scenario-studio-editor">{creating ? <FlowBuilder key="new" columns={columns} reusableMedia={reusableMedia} onSave={async (draft) => { await onSave(draft); setCreating(false); }} onCancel={() => setCreating(false)} /> : selectedScenario ? <FlowBuilder key={selectedScenario.id} initial={selectedScenario} columns={columns} reusableMedia={reusableMedia} onSave={onSave} onDelete={async () => { if (!window.confirm(`¿Eliminar “${selectedScenario.name}”?`)) return; await onDelete(selectedScenario.id); }} /> : <div className="scenario-studio-empty"><b>Selecciona un escenario</b><span>O crea uno nuevo para diseñar tu primer flujo.</span></div>}</div></div></section>;
}
