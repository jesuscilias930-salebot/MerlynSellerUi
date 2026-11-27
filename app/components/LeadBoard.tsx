import { DragEvent, FormEvent, ReactNode, useState } from "react";
import { initials } from "../lib/format";
import { ColumnRemarketing } from "./ColumnRemarketing";
import { ColumnFollowUp } from "./ColumnFollowUp";
import { ColumnTimeout } from "./ColumnTimeout";
import { ChannelBadge } from "./ChannelBadge";
import { LoadMoreSentinel } from "./LoadMoreSentinel";
import { ColumnMenu } from "./ColumnMenu";
import { contactDetail, contactName } from "../lib/channels";
import { dayOffset, leadsInRange, rangeLabel, type DateRange } from "../lib/lead-move";
import type { Chat, ConversationFilter, LeadBoardSummary, LeadColumn } from "../lib/types";

type Props = {
  columns: LeadColumn[]; filter: ConversationFilter; canEdit: boolean; columnName: string;
  draggingLeadId: string | null; draggingColumnId: string | null;
  onColumnNameChange: (value: string) => void; onFilterChange: (filter: ConversationFilter) => void;
  onAddColumn: (event: FormEvent) => void; onRemoveColumn: (column: LeadColumn) => void;
  /** range: solo los leads cuyo último mensaje cae en esas fechas; vacío = todos. */
  onMoveAll: (sourceColumn: LeadColumn, targetColumnId: string, range: DateRange) => Promise<void>;
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
  /** Siguiente página de leads de una columna (scroll infinito). */
  onLoadMore?: (column: LeadColumn) => Promise<void>;
  /** Mover la columna completa a otro dashboard. */
  onMoveColumn?: (column: LeadColumn, boardId: string) => Promise<void>;
  /** Abre los escenarios de este dashboard (ver y crear). */
  onOpenScenarios?: () => void;
  /** Abre otro dashboard (desde la columna de un hijo en su padre). */
  onSelectBoard?: (boardId: string) => void;
};

function BulkMoveControl({ column, columns, boards = [], activeBoardId = "", onMoveAll }: Pick<Props, "columns" | "boards" | "activeBoardId" | "onMoveAll"> & { column: LeadColumn }) {
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState(activeBoardId);
  const [targetColumnId, setTargetColumnId] = useState("");
  const [range, setRange] = useState<DateRange>({});
  const [moving, setMoving] = useState(false);
  // Destino: columnas del dashboard abierto o de otro dashboard.
  const otherBoard = boardId && boardId !== activeBoardId ? boards.find((board) => board.id === boardId) : undefined;
  const targets = otherBoard ? otherBoard.columns.map((item) => ({ id: item.id, name: item.name })) : columns.filter((item) => item.id !== column.id);
  const canMoveAnywhere = targets.length > 0 || boards.length > 1;
  const filtered = Boolean(range.from || range.to);
  const invalidRange = Boolean(range.from && range.to && range.from > range.to);
  // La columna puede traer solo una parte de sus leads: el conteo exacto lo da el servidor al mover.
  const complete = column.leadCount === undefined || column.leadCount <= column.leads.length;
  const total = column.leadCount ?? column.leads.length;
  const matching = leadsInRange(column.leads, range).length;
  const countText = !filtered ? `${total} ${total === 1 ? "lead" : "leads"}` : complete ? `${matching} de ${total} leads` : `los leads con chat ${rangeLabel(range)}`;
  const reset = () => { setTargetColumnId(""); setBoardId(activeBoardId); setRange({}); };
  const move = async () => {
    const target = targets.find((item) => item.id === targetColumnId);
    if (!target || !total || invalidRange) return;
    if (filtered && complete && !matching) return;
    const destination = otherBoard ? `“${target.name}” del dashboard “${otherBoard.name}”` : `“${target.name}”`;
    const what = filtered ? `${complete ? `${matching} ${matching === 1 ? "lead" : "leads"}` : "los leads"} con último mensaje ${rangeLabel(range)}` : `${total} ${total === 1 ? "lead" : "leads"}`;
    if (!window.confirm(`¿Mover ${what} de “${column.name}” a ${destination}?`)) return;
    setMoving(true);
    try { await onMoveAll(column, targetColumnId, range); setOpen(false); reset(); }
    finally { setMoving(false); }
  };
  const shortcut = (days: number, label: string) => <button type="button" className={range.from === dayOffset(-days) && !range.to ? "selected" : ""} onClick={() => setRange({ from: dayOffset(-days) })}>{label}</button>;
  if (!canMoveAnywhere) return null;
  return <div className="bulk-move-control"><button type="button" className="bulk-move-trigger" disabled={!column.leads.length} title="Mover todos los leads de esta columna" aria-label="Mover todos" onClick={() => { setOpen((value) => !value); reset(); }}>⇄</button>{open && <div className="bulk-move-popover">
    {boards.length > 1 && <label>Dashboard<select value={boardId} onChange={(event) => { setBoardId(event.target.value); setTargetColumnId(""); }}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}{board.id === activeBoardId ? " (este)" : ""}</option>)}</select></label>}
    <label>Columna<select value={targetColumnId} onChange={(event) => setTargetColumnId(event.target.value)}><option value="">Selecciona una columna</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
    <fieldset className="bulk-move-dates">
      <legend>Fecha del chat <small>(último mensaje · opcional)</small></legend>
      <span className="bulk-move-shortcuts">{shortcut(0, "Hoy")}{shortcut(7, "7 días")}{shortcut(30, "30 días")}<button type="button" className={range.to === dayOffset(-30) && !range.from ? "selected" : ""} onClick={() => setRange({ to: dayOffset(-30) })}>Más de 30 días</button></span>
      <span className="bulk-move-range">
        <label>Desde<input type="date" value={range.from || ""} max={range.to || undefined} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value || undefined }))} /></label>
        <label>Hasta<input type="date" value={range.to || ""} min={range.from || undefined} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value || undefined }))} /></label>
      </span>
      {filtered && <button type="button" className="bulk-move-clear" onClick={() => setRange({})}>Quitar fechas (mover todos)</button>}
    </fieldset>
    <small className={`bulk-move-note ${invalidRange || (filtered && complete && !matching) ? "warning" : ""}`}>{invalidRange ? "La fecha «Desde» es posterior a «Hasta»." : filtered && complete && !matching ? "Ningún lead de esta columna tiene chats en esas fechas." : `Se moverán ${countText}.`}</small>
    {otherBoard && <small className="bulk-move-note">Los leads se irán al dashboard «{otherBoard.name}».</small>}
    <div><button type="button" className="plain-button" onClick={() => setOpen(false)}>Cancelar</button><button type="button" disabled={!targetColumnId || moving || invalidRange || (filtered && complete && !matching)} onClick={() => void move()}>{moving ? "Moviendo…" : "Confirmar"}</button></div></div>}</div>;
}

export function LeadBoard({ columns, filter, canEdit, columnName, draggingLeadId, draggingColumnId, onColumnNameChange, onFilterChange, onAddColumn, onRemoveColumn, onMoveAll, onOpenLead, onDragStart, onDragEnd, onDrop, onColumnDragStart, onColumnDragEnd, onColumnDrop, tabs, boards, activeBoardId, onRemarketingSent, onLoadMore, onMoveColumn, onOpenScenarios, onSelectBoard }: Props) {
  // Etapa de cada lead dentro de su dashboard hijo (para la columna del hijo en el padre).
  // El tablero manda la columna como lead_column_id; el inbox como leadColumnId.
  const leadColumnOf = (lead: Chat) => (lead as Chat & { lead_column_id?: string }).lead_column_id || lead.leadColumnId || "";
  const stageOf = new Map((boards || []).flatMap(board => board.columns.map(item => [item.id, item.name] as const)));
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const loadMore = async (column: LeadColumn) => {
    if (!onLoadMore || loadingIds.includes(column.id)) return;
    setLoadingIds(current => [...current, column.id]);
    try { await onLoadMore(column); } finally { setLoadingIds(current => current.filter(id => id !== column.id)); }
  };
  const totalOf = (column: LeadColumn) => column.leadCount ?? column.leads.length;
  const loadedOf = (column: LeadColumn) => column.loadedCount ?? column.leads.length;
  return <section className="pipeline" aria-label="Tablero de leads"><header className="pipeline-header"><h1 title="Arrastra una tarjeta para actualizar su proceso comercial.">Leads</h1>{tabs}<div className="dashboard-actions">{onOpenScenarios && <button type="button" className="board-scenarios-button" title="Ver y crear los escenarios de este dashboard" onClick={onOpenScenarios}>⚡ Escenarios</button>}<div className="filter-buttons"><button className={filter === "all" ? "selected" : ""} type="button" onClick={() => onFilterChange("all")}>Todos</button><button className={filter === "unread" ? "selected" : ""} type="button" onClick={() => onFilterChange("unread")}>No leídos</button><button className={filter === "needs-response" ? "selected" : ""} type="button" onClick={() => onFilterChange("needs-response")}>Pendientes</button></div>{canEdit && <form onSubmit={onAddColumn} className="add-column"><input value={columnName} onChange={(event) => onColumnNameChange(event.target.value)} maxLength={80} placeholder="Nueva columna" /><button title="Agregar columna">＋ Columna</button></form>}</div></header><div className="kanban" role="list">{columns.map((column) => <section className={`lead-column${column.virtual ? " child-board-column" : ""}${draggingColumnId === column.id ? " column-dragging" : ""}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (event.dataTransfer.getData("text/merlynsales-column")) { if (!column.virtual) onColumnDrop(event, column.id); } else onDrop(event, column.id); }}>{column.virtual ? <header><div className="column-title"><div><h2 title={`Todos los leads del dashboard «${column.name}»`}>📂 {column.name}</h2><span>{totalOf(column)} {totalOf(column) === 1 ? "lead" : "leads"} · todas sus etapas</span></div></div><div className="column-actions">{onSelectBoard && column.childBoardId && <button type="button" className="child-board-open" title={`Abrir el dashboard «${column.name}»`} onClick={() => onSelectBoard(column.childBoardId!)}>Abrir ›</button>}</div></header> : <header><div className="column-title">{canEdit && <button type="button" draggable className="column-drag-handle" onDragStart={(event) => onColumnDragStart(event, column.id)} onDragEnd={onColumnDragEnd} aria-label={`Reordenar ${column.name}`}>⋮⋮</button>}<div><h2>{column.name}</h2><span>{totalOf(column)} {totalOf(column) === 1 ? "lead" : "leads"}</span></div></div><div className="column-actions">{canEdit && <><ColumnRemarketing column={column} onSent={onRemarketingSent} /><ColumnFollowUp column={column} columns={columns} onSaved={onRemarketingSent} /><ColumnTimeout column={column} columns={columns} boards={boards} onSaved={onRemarketingSent} /></>}{canEdit && <BulkMoveControl column={column} columns={columns} boards={boards} activeBoardId={activeBoardId} onMoveAll={onMoveAll} />}{canEdit && <ColumnMenu column={column} boards={boards} activeBoardId={activeBoardId} onMove={onMoveColumn} onRemove={onRemoveColumn} />}</div></header>}<div className="lead-stack">{column.leads.map((lead) => <button className={`${draggingLeadId === lead.id ? "lead-card dragging" : "lead-card"}${lead.unreadCount > 0 ? " has-unread" : ""}`} key={lead.id} draggable onDragStart={(event) => onDragStart(event, lead.id)} onDragEnd={onDragEnd} onClick={() => onOpenLead(lead)}><span className="lead-avatar has-channel-badge"><span aria-hidden="true">{initials(contactName(lead))}</span><ChannelBadge contact={lead} /></span><span><strong>{contactName(lead)}</strong><small>{contactDetail(lead)}</small><em>{lead.last_message || "Sin mensajes aún"}</em>{column.virtual && stageOf.get(leadColumnOf(lead)) && <i className="lead-stage">{stageOf.get(leadColumnOf(lead))}</i>}</span>{lead.unreadCount > 0 && <b className="unread-badge" aria-label={`${lead.unreadCount} mensajes pendientes`}>{lead.unreadCount > 99 ? "99+" : lead.unreadCount}</b>}</button>)}{onLoadMore && loadedOf(column) < totalOf(column) && <LoadMoreSentinel key={loadedOf(column)} loading={loadingIds.includes(column.id)} onVisible={() => void loadMore(column)} label={`Cargar más (${totalOf(column) - loadedOf(column)})`} />}{column.leads.length === 0 && totalOf(column) === 0 && <p className="empty-column">No hay leads para este filtro</p>}</div></section>)}</div></section>;
}
