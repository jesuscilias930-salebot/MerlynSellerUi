import type { LeadBoardSummary, LeadColumn } from "./types";

const STORAGE_KEY = "merlyn.activeBoard";
export const readStoredBoard = () => { try { return window.localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; } };
export const storeBoard = (id: string) => { try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* Preferencia opcional. */ } };

/** Dashboard a mostrar: el elegido si sigue existiendo; si no, el principal. */
export const resolveBoardId = (boards: LeadBoardSummary[], wanted: string) =>
  boards.find(board => board.id === wanted)?.id || boards.find(board => board.isDefault)?.id || boards[0]?.id || "";

/** Todas las columnas de todos los dashboards para selectores (sin cargar chats).
 *  Con varios dashboards el nombre lleva el dashboard: «Calcetas · Orizaba · R-HOT». */
export const columnsFromBoards = (boards: LeadBoardSummary[]): LeadColumn[] => {
  const multiple = boards.length > 1;
  return boards.flatMap(board => board.columns.map(column => ({
    id: column.id, name: multiple ? `${board.name} · ${column.name}` : column.name, shortName: column.name,
    position: column.position, boardId: board.id, boardName: board.name, leadCount: column.leadCount, scenariosPaused: column.scenariosPaused, leads: [],
  })));
};
export const boardSubtitle = (board: Pick<LeadBoardSummary, "product" | "zone">) => [board.product, board.zone].filter(Boolean).join(" · ");

/** Columnas del dashboard al que pertenece el chat (el de la columna asignada con su primer mensaje), en orden. */
export function chatBoardColumns<T extends { id: string; boardId?: string; position: number }>(columns: T[], leadColumnId: string | null | undefined): T[] {
  const current = columns.find(column => column.id === leadColumnId);
  const boardId = current?.boardId ?? columns[0]?.boardId;
  return columns.filter(column => column.boardId === boardId).sort((a, b) => a.position - b.position);
}
