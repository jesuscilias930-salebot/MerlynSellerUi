import test from 'node:test';
import assert from 'node:assert/strict';
import { boardSubtitle, columnsFromBoards, resolveBoardId } from '../app/lib/lead-boards.ts';

const board = (id, name, isDefault, columns) => ({ id, name, product: null, zone: null, position: 0, isDefault, leadCount: 0, unreadLeads: 0, columns: columns.map((column, position) => ({ id: `${id}-${column}`, name: column, position, boardId: id, leadCount: 2, scenariosPaused: 1, unreadLeads: 0 })) });

test('elige el dashboard guardado o el principal', () => {
  const boards = [board('a', 'Principal', true, ['Nuevos']), board('b', 'Orizaba', false, ['Nuevos'])];
  assert.equal(resolveBoardId(boards, 'b'), 'b');
  assert.equal(resolveBoardId(boards, 'borrado'), 'a');
  assert.equal(resolveBoardId([], 'x'), '');
});

test('las columnas de selectores llevan el dashboard solo si hay varios', () => {
  assert.deepEqual(columnsFromBoards([board('a', 'Principal', true, ['R-HOT'])]).map((column) => column.name), ['R-HOT']);
  const columns = columnsFromBoards([board('a', 'Principal', true, ['R-HOT']), board('b', 'Orizaba', false, ['R-HOT'])]);
  assert.deepEqual(columns.map((column) => [column.name, column.shortName, column.leadCount]), [['Principal · R-HOT', 'R-HOT', 2], ['Orizaba · R-HOT', 'R-HOT', 2]]);
  assert.equal(boardSubtitle({ product: 'Calcetas', zone: 'Orizaba' }), 'Calcetas · Orizaba');
  assert.equal(boardSubtitle({ product: null, zone: 'Orizaba' }), 'Orizaba');
});
