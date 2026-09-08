import { DragEvent, FormEvent, useState } from "react";
import { initials } from "../lib/format";
import type { Chat, ConversationFilter, LeadColumn } from "../lib/types";

type Props = {
  columns: LeadColumn[]; filter: ConversationFilter; canEdit: boolean; columnName: string;
  draggingLeadId: string | null; draggingColumnId: string | null;
  onColumnNameChange: (value: string) => void; onFilterChange: (filter: ConversationFilter) => void;
  onAddColumn: (event: FormEvent) => void; onRemoveColumn: (column: LeadColumn) => void;
  onMoveAll: (sourceColumn: LeadColumn, targetColumnId: string) => Promise<void>;
  onOpenLead: (lead: Chat) => void; onDragStart: (event: DragEvent<HTMLButtonElement>, leadId: string) => void;
  onDragEnd: () => void; onDrop: (event: DragEvent<HTMLElement>, columnId: string) => void;
  onColumnDragStart: (event: DragEvent<HTMLButtonElement>, columnId: string) => void;
  onColumnDragEnd: () => void; onColumnDrop: (event: DragEvent<HTMLElement>, columnId: string) => void;
};

function BulkMoveControl({ column, columns, onMoveAll }: Pick<Props, "columns" | "onMoveAll"> & { column: LeadColumn }) {
  const [open, setOpen] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState("");
  const [moving, setMoving] = useState(false);
  const targets = columns.filter((item) => item.id !== column.id);
  const move = async () => {
    const target = targets.find((item) => item.id === targetColumnId);
    if (!target || !column.leads.length) return;
    if (!window.confirm(`Mover ${column.leads.length} ${column.leads.length === 1 ? "lead" : "leads"} de “${column.name}” a “${target.name}”?`)) return;
    setMoving(true);
    try { await onMoveAll(column, targetColumnId); setOpen(false); setTargetColumnId(""); }
    finally { setMoving(false); }
  };
  if (!targets.length) return null;
  return <div className="bulk-move-control"><button type="button" className="bulk-move-trigger" disabled={!column.leads.length} onClick={() => setOpen((value) => !value)}>Mover todos</button>{open && <div className="bulk-move-popover"><label>Destino<select value={targetColumnId} onChange={(event) => setTargetColumnId(event.target.value)}><option value="">Selecciona una columna</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><div><button type="button" className="plain-button" onClick={() => setOpen(false)}>Cancelar</button><button type="button" disabled={!targetColumnId || moving} onClick={() => void move()}>{moving ? "Moviendo…" : "Confirmar"}</button></div></div>}</div>;
}

export function LeadBoard({ columns, filter, canEdit, columnName, draggingLeadId, draggingColumnId, onColumnNameChange, onFilterChange, onAddColumn, onRemoveColumn, onMoveAll, onOpenLead, onDragStart, onDragEnd, onDrop, onColumnDragStart, onColumnDragEnd, onColumnDrop }: Props) {
  return <section className="pipeline" aria-label="Tablero de leads"><header className="pipeline-header"><div><p>PIPELINE COMERCIAL</p><h1>Leads</h1><span>Arrastra una tarjeta para actualizar su proceso comercial.</span></div><div className="dashboard-actions"><div className="filter-buttons"><button className={filter === "all" ? "selected" : ""} type="button" onClick={() => onFilterChange("all")}>Todos</button><button className={filter === "unread" ? "selected" : ""} type="button" onClick={() => onFilterChange("unread")}>No leídos</button><button className={filter === "needs-response" ? "selected" : ""} type="button" onClick={() => onFilterChange("needs-response")}>Pendientes</button></div>{canEdit && <form onSubmit={onAddColumn} className="add-column"><input value={columnName} onChange={(event) => onColumnNameChange(event.target.value)} maxLength={80} placeholder="Nueva columna" /><button>Agregar columna</button></form>}</div></header><div className="kanban" role="list">{columns.map((column) => <section className={`lead-column${draggingColumnId === column.id ? " column-dragging" : ""}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (event.dataTransfer.getData("text/merlynsales-column")) onColumnDrop(event, column.id); else onDrop(event, column.id); }}><header><div className="column-title">{canEdit && <button type="button" draggable className="column-drag-handle" onDragStart={(event) => onColumnDragStart(event, column.id)} onDragEnd={onColumnDragEnd} aria-label={`Reordenar ${column.name}`}>⋮⋮</button>}<div><h2>{column.name}</h2><span>{column.leads.length} {column.leads.length === 1 ? "lead" : "leads"}</span></div></div><div className="column-actions">{canEdit && <BulkMoveControl column={column} columns={columns} onMoveAll={onMoveAll} />}{canEdit && <button type="button" className="remove-column" onClick={() => onRemoveColumn(column)} aria-label={`Eliminar ${column.name}`}>×</button>}</div></header><div className="lead-stack">{column.leads.map((lead) => <button className={`${draggingLeadId === lead.id ? "lead-card dragging" : "lead-card"}${lead.unreadCount > 0 ? " has-unread" : ""}`} key={lead.id} draggable onDragStart={(event) => onDragStart(event, lead.id)} onDragEnd={onDragEnd} onClick={() => onOpenLead(lead)}><span className="lead-avatar" aria-hidden="true">{initials(lead.name || lead.phone_number)}</span><span><strong>{lead.name || lead.phone_number}</strong><small>{lead.phone_number}</small><em>{lead.last_message || "Sin mensajes aún"}</em></span>{lead.unreadCount > 0 && <b className="unread-badge" aria-label={`${lead.unreadCount} mensajes pendientes`}>{lead.unreadCount > 99 ? "99+" : lead.unreadCount}</b>}</button>)}{column.leads.length === 0 && <p className="empty-column">No hay leads para este filtro</p>}</div></section>)}</div></section>;
}
