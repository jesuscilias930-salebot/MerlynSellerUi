import { DragEvent, FormEvent, ReactNode, useState } from "react";
import { initials } from "../lib/format";
import { ColumnRemarketing } from "./ColumnRemarketing";
import { contactDetail, contactName } from "../lib/channels";
import type { Chat, ConversationFilter, LeadBoardSummary, LeadColumn } from "../lib/types";

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
  /** Tabs del multi dashboard. */
  tabs?: ReactNode;
  /** Dashboards para «Mover todos» a una columna de otro dashboard. */
  boards?: LeadBoardSummary[]; activeBoardId?: string;
  /** Aviso tras enviar remarketing desde una columna (botón 📣). */
  onRemarketingSent?: (notice: string) => void;
};

function BulkMoveControl({ column, columns, boards = [], activeBoardId = "", onMoveAll }: Pick<Props, "columns" | "boards" | "activeBoardId" | "onMoveAll"> & { column: LeadColumn }) {
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState(activeBoardId);
  const [targetColumnId, setTargetColumnId] = useState("");
  const [moving, setMoving] = useState(false);
  // Destino: columnas del dashboard abierto o de otro dashboard.
  const otherBoard = boardId && boardId !== activeBoardId ? boards.find((board) => board.id === boardId) : undefined;
  const targets = otherBoard ? otherBoard.columns.map((item) => ({ id: item.id, name: item.name })) : columns.filter((item) => item.id !== column.id);
  const canMoveAnywhere = targets.length > 0 || boards.length > 1;
  const move = async () => {
    const target = targets.find((item) => item.id === targetColumnId);
    if (!target || !column.leads.length) return;
    const destination = otherBoard ? `“${target.name}” del dashboard “${otherBoard.name}”` : `“${target.name}”`;
    if (!window.confirm(`Mover ${column.leads.length} ${column.leads.length === 1 ? "lead" : "leads"} de “${column.name}” a ${destination}?`)) return;
    setMoving(true);
    try { await onMoveAll(column, targetColumnId); setOpen(false); setTargetColumnId(""); setBoardId(activeBoardId); }
    finally { setMoving(false); }
  };
  if (!canMoveAnywhere) return null;
  return <div className="bulk-move-control"><button type="button" className="bulk-move-trigger" disabled={!column.leads.length} onClick={() => { setOpen((value) => !value); setBoardId(activeBoardId); setTargetColumnId(""); }}>Mover todos</button>{open && <div className="bulk-move-popover">
    {boards.length > 1 && <label>Dashboard<select value={boardId} onChange={(event) => { setBoardId(event.target.value); setTargetColumnId(""); }}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}{board.id === activeBoardId ? " (este)" : ""}</option>)}</select></label>}
    <label>Columna<select value={targetColumnId} onChange={(event) => setTargetColumnId(event.target.value)}><option value="">Selecciona una columna</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
    {otherBoard && <small className="bulk-move-note">Los leads se irán al dashboard «{otherBoard.name}».</small>}
    <div><button type="button" className="plain-button" onClick={() => setOpen(false)}>Cancelar</button><button type="button" disabled={!targetColumnId || moving} onClick={() => void move()}>{moving ? "Moviendo…" : "Confirmar"}</button></div></div>}</div>;
}

export function LeadBoard({ columns, filter, canEdit, columnName, draggingLeadId, draggingColumnId, onColumnNameChange, onFilterChange, onAddColumn, onRemoveColumn, onMoveAll, onOpenLead, onDragStart, onDragEnd, onDrop, onColumnDragStart, onColumnDragEnd, onColumnDrop, tabs, boards, activeBoardId, onRemarketingSent }: Props) {
  return <section className="pipeline" aria-label="Tablero de leads"><header className="pipeline-header"><div><p>PIPELINE COMERCIAL</p><h1>Leads</h1><span>Arrastra una tarjeta para actualizar su proceso comercial.</span></div><div className="dashboard-actions"><div className="filter-buttons"><button className={filter === "all" ? "selected" : ""} type="button" onClick={() => onFilterChange("all")}>Todos</button><button className={filter === "unread" ? "selected" : ""} type="button" onClick={() => onFilterChange("unread")}>No leídos</button><button className={filter === "needs-response" ? "selected" : ""} type="button" onClick={() => onFilterChange("needs-response")}>Pendientes</button></div>{canEdit && <form onSubmit={onAddColumn} className="add-column"><input value={columnName} onChange={(event) => onColumnNameChange(event.target.value)} maxLength={80} placeholder="Nueva columna" /><button>Agregar columna</button></form>}</div></header>{tabs}<div className="kanban" role="list">{columns.map((column) => <section className={`lead-column${draggingColumnId === column.id ? " column-dragging" : ""}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (event.dataTransfer.getData("text/merlynsales-column")) onColumnDrop(event, column.id); else onDrop(event, column.id); }}><header><div className="column-title">{canEdit && <button type="button" draggable className="column-drag-handle" onDragStart={(event) => onColumnDragStart(event, column.id)} onDragEnd={onColumnDragEnd} aria-label={`Reordenar ${column.name}`}>⋮⋮</button>}<div><h2>{column.name}</h2><span>{column.leads.length} {column.leads.length === 1 ? "lead" : "leads"}</span></div></div><div className="column-actions">{canEdit && <ColumnRemarketing column={column} onSent={onRemarketingSent} />}{canEdit && <BulkMoveControl column={column} columns={columns} boards={boards} activeBoardId={activeBoardId} onMoveAll={onMoveAll} />}{canEdit && <button type="button" className="remove-column" onClick={() => onRemoveColumn(column)} aria-label={`Eliminar ${column.name}`}>×</button>}</div></header><div className="lead-stack">{column.leads.map((lead) => <button className={`${draggingLeadId === lead.id ? "lead-card dragging" : "lead-card"}${lead.unreadCount > 0 ? " has-unread" : ""}`} key={lead.id} draggable onDragStart={(event) => onDragStart(event, lead.id)} onDragEnd={onDragEnd} onClick={() => onOpenLead(lead)}><span className="lead-avatar" aria-hidden="true">{initials(contactName(lead))}</span><span><strong>{contactName(lead)}</strong><small>{contactDetail(lead)}</small><em>{lead.last_message || "Sin mensajes aún"}</em>{lead.columnPinnedAt && <i className="lead-pinned" title="Las automatizaciones no lo moverán. Arrástralo para liberarlo.">📌 {lead.columnPinnedRule ? `Fijado por «${lead.columnPinnedRule}»` : "Fijado en esta columna"}</i>}</span>{lead.unreadCount > 0 && <b className="unread-badge" aria-label={`${lead.unreadCount} mensajes pendientes`}>{lead.unreadCount > 99 ? "99+" : lead.unreadCount}</b>}</button>)}{column.leads.length === 0 && <p className="empty-column">No hay leads para este filtro</p>}</div></section>)}</div></section>;
}
