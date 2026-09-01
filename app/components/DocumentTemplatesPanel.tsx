"use client";

import { ChangeEvent, useState } from "react";
import type { DocumentTemplate } from "../lib/types";

type Props = {
  templates: DocumentTemplate[];
  onUpload: (file: File) => Promise<void>;
  onSave: (template: DocumentTemplate, changes: { filename: string; caption: string; isCatalog: boolean }) => Promise<void>;
  onDelete: (template: DocumentTemplate) => Promise<void>;
};

function TemplateCard({ template, onSave, onDelete }: { template: DocumentTemplate; onSave: Props["onSave"]; onDelete: Props["onDelete"] }) {
  const [filename, setFilename] = useState(template.filename);
  const [caption, setCaption] = useState(template.caption || "");
  const [isCatalog, setIsCatalog] = useState(template.isCatalog);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(template.isCatalog);
  const save = async () => { setSaving(true); try { await onSave(template, { filename, caption, isCatalog }); } finally { setSaving(false); } };
  return <article className="document-template-card">
    <header><div><strong>{filename}</strong><small>{template.isCatalog ? "Catálogo automático" : "Documento reutilizable"}</small></div><button type="button" className="collapse-toggle" onClick={() => setExpanded((value) => !value)}>{expanded ? "⌃ Ocultar" : "⌄ Editar"}</button></header>
    {expanded && <div className="document-template-editor">
      <label>Nombre del documento<input value={filename} maxLength={240} onChange={(event) => setFilename(event.target.value)} /></label>
      <label>Mensaje que se enviará junto con el documento<textarea value={caption} maxLength={1024} placeholder="Por ejemplo: Aquí está nuestro catálogo. Avísame si puedes abrirlo." onChange={(event) => setCaption(event.target.value)} /></label>
      <label className="template-catalog"><input type="checkbox" checked={isCatalog} onChange={(event) => setIsCatalog(event.target.checked)} /> Usar como catálogo automático</label>
      <div className="template-actions"><button type="button" onClick={() => void save()} disabled={saving || !filename.trim()}>{saving ? "Guardando…" : "Guardar"}</button><button type="button" className="danger" onClick={() => void onDelete(template)} disabled={saving}>Eliminar</button></div>
    </div>}
  </article>;
}

export function DocumentTemplatesPanel({ templates, onUpload, onSave, onDelete }: Props) {
  const [uploading, setUploading] = useState(false);
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024 || (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))) return window.alert("Selecciona un PDF de hasta 25 MB.");
    setUploading(true); try { await onUpload(file); } finally { setUploading(false); }
  };
  return <section className="document-templates">
    <header><div><p>DOCUMENTOS</p><h1>Plantillas de documentos</h1><span>Guarda cada PDF una sola vez y define el texto que lo acompañará al enviarlo.</span></div><label className="primary-action">{uploading ? "Subiendo…" : "＋ Agregar PDF"}<input type="file" accept="application/pdf,.pdf" onChange={chooseFile} disabled={uploading} /></label></header>
    <div className="document-template-list">{templates.length === 0 ? <div className="automation-empty"><b>Aún no hay documentos guardados</b><span>Sube un PDF para reutilizarlo desde cualquier conversación.</span></div> : templates.map((template) => <TemplateCard key={template.id} template={template} onSave={onSave} onDelete={onDelete} />)}</div>
  </section>;
}
