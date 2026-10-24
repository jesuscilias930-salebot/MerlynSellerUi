import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLoanDraft, isOverdue, loanIssues, loanLine, loanPayload, loansByProduct, loanSuggestions, piecesOut, returnDateLabel } from '../app/lib/inventory-loans.ts';

const now = new Date(2026, 9, 24, 12);
const loan = (patch = {}) => ({ id: 'a', productId: 5, productName: 'Essential · Negro', quantity: 6, location: 'Tienda Centro', takenBy: 'Ana', returnDate: '2026-10-25', notes: null, status: 'out', createdAt: '', returnedAt: null, ...patch });

test('valida y arma la salida temporal', () => {
  assert.deepEqual(loanIssues({ ...emptyLoanDraft(), quantity: '0' }), ['Escribe cuántas prendas se tomaron.', 'Escribe dónde están las prendas.']);
  assert.deepEqual(loanIssues({ ...emptyLoanDraft(), location: 'Tienda' }), []);
  assert.deepEqual(loanPayload(5, ' Essential ', { quantity: '3', location: ' Fotos ', takenBy: ' ', returnDate: '', notes: '' }),
    { productId: 5, productName: 'Essential', quantity: 3, location: 'Fotos', takenBy: null, returnDate: null, notes: null });
});

test('agrupa por producto, suma piezas y marca vencidas', () => {
  const rows = [loan(), loan({ id: 'b', quantity: 2, location: 'tienda centro', takenBy: 'Luis' }), loan({ id: 'c', productId: 6, status: 'returned' })];
  const map = loansByProduct(rows);
  assert.equal(map.size, 1); assert.equal(piecesOut(map.get(5)), 8);
  assert.equal(isOverdue(loan({ returnDate: '2026-10-23' }), now), true);
  assert.equal(isOverdue(loan({ returnDate: '2026-10-24' }), now), false);
  assert.equal(isOverdue(loan({ returnDate: null }), now), false);
  assert.deepEqual(loanSuggestions(rows, 'location'), ['Tienda Centro']);
  assert.deepEqual(loanSuggestions(rows, 'takenBy'), ['Ana', 'Luis']);
});

test('describe la salida en una línea', () => {
  assert.equal(returnDateLabel('2026-10-24', now), 'hoy');
  assert.equal(loanLine(loan(), now), '6 piezas fuera · Tienda Centro · con Ana · regresa mañana');
  assert.match(loanLine(loan({ returnDate: '2026-10-20', takenBy: null, quantity: 1 }), now), /^1 pieza fuera · Tienda Centro · debía regresar /);
});
