"use client";

import { useEffect, useRef, useState } from "react";
import type { LeadBoardSummary, LeadColumn } from "../lib/types";

/** Menú ⋯ de una columna: mover la columna (con sus leads, ⏳ y ⏱) a otro dashboard, o eliminarla. */
export function ColumnMenu({ column, boards = [], activeBoardId = "", onMove, onRemove }: { column: LeadColumn; boards?: LeadBoardSummary[]; activeBoardId?: string; onMove?: (column: LeadColumn, boardId: string) => Promise<void>; onRemove: (column: LeadColumn) => void }) {
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState("");
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = boards.filter(board => board.id !== activeBoardId);
  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const move = async () => {
    if (!onMove || !boardId || moving) return;
    const target = boards.find(board => board.id === boardId);
    const count = column.leadCount ?? column.leads.length;
    if (!window.confirm(`¿Mover la columna «${column.name}» con sus ${count} ${count === 1 ? "lead" : "leads"} al dashboard «${target?.name}»? Sus ⏳ y ⏱ se van con ella.`)) return;
    setMoving(true);
    try { await onMove(column, boardId); setOpen(false); setBoardId(""); }
    finally { setMoving(false); }
  };
  return <div className="column-menu" ref={ref}>
    <button type="button" className="column-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={`Más opciones de ${column.name}`} title="Más opciones" onClick={() => setOpen(value => !value)}>⋯</button>
    {open && <div className="column-menu-popover" role="menu">
      {onMove && <div className="column-menu-move">
        <b>Mover columna a otro dashboard</b>
        {others.length ? <>
          <select value={boardId} aria-label="Dashboard de destino" onChange={event => setBoardId(event.target.value)}>
            <option value="">Elige un dashboard…</option>
            {others.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
          </select>
          <button type="button" className="primary-action" disabled={!boardId || moving} onClick={() => void move()}>{moving ? "Moviendo…" : "Mover columna"}</button>
          <small>Se lleva sus leads, ⏳ y ⏱; queda al final del otro dashboard.</small>
        </> : <small>Crea otro dashboard con «＋ Dashboard» para poder mover columnas.</small>}
      </div>}
      <button type="button" role="menuitem" className="column-menu-danger" onClick={() => { setOpen(false); onRemove(column); }}>Eliminar columna</button>
    </div>}
  </div>;
}
