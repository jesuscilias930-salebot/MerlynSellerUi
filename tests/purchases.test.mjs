import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromPurchase, draftIssues, draftTotals, emptyLine, lineTotals, purchaseTotal, sortPurchases, toPurchaseRequest } from '../app/lib/purchases.ts';

const unit = { ...emptyLine(), productId: '1', units: '120', unitCost: '8.5' };
const bulk = { ...emptyLine(), productId: '2', mode: 'bulk', bulks: '3', unitsPerBulk: '24', pricePerBulk: '360', taxed: true };

test('totales por pieza y por bulto', () => {
  assert.deepEqual(lineTotals(unit), { units: 120, unitCost: 8.5, total: 1020 });
  assert.deepEqual(lineTotals(bulk), { units: 72, unitCost: 15, total: 1080 });
  const totals = draftTotals({ supplierName: '', purchaseDate: '2026-10-22', invoiceTotal: '2100', lines: [unit, bulk] });
  assert.deepEqual(totals, { products: 2, units: 192, total: 2100, invoice: 2100, difference: 0 });
});

test('mensajes claros por producto y duplicados', () => {
  const draft = { supplierName: '', purchaseDate: '2026-10-22', invoiceTotal: '', lines: [{ ...emptyLine() }, { ...bulk, unitsPerBulk: '' }, { ...unit }, { ...unit, key: 'x' }] };
  assert.deepEqual(draftIssues(draft), [
    'Producto 1: elige el producto, indica las piezas recibidas, indica el costo por pieza.',
    'Producto 2: indica las piezas por bulto.',
    'Un producto aparece dos veces; junta sus piezas en una sola línea.',
  ]);
  assert.deepEqual(draftIssues({ ...draft, lines: [unit, bulk] }), []);
});

test('convierte al formato de Control y vuelve a editarse igual', () => {
  const request = toPurchaseRequest({ supplierName: ' Textiles MX ', purchaseDate: '2026-10-22', invoiceTotal: '', lines: [unit, bulk] });
  assert.equal(request.supplierName, 'Textiles MX'); assert.equal(request.purchaseDate, '2026-10-22T00:00:00'); assert.equal(request.totalInvoiceAmount, null);
  assert.deepEqual(request.purchaseItemsRequest[0], { productId: 1, isBulk: false, isTaxed: false, bulksReceived: 0, unitsPerBulk: 0, individualUnitsReceived: 120, unitCostNet: 8.5, pricePerBulk: null, totalUnitsAcquired: 120, totalPaid: 1020 });
  assert.deepEqual(request.purchaseItemsRequest[1], { productId: 2, isBulk: true, isTaxed: true, bulksReceived: 3, unitsPerBulk: 24, individualUnitsReceived: 0, unitCostNet: 15, pricePerBulk: 360, totalUnitsAcquired: 72, totalPaid: 1080 });
  const purchase = { id: 9, supplierName: 'Textiles MX', purchaseDate: '2026-10-22T00:00:00', totalInvoiceAmount: null, purchaseItemsRequest: request.purchaseItemsRequest.map((item, i) => ({ ...item, id: i + 1 })) };
  const draft = draftFromPurchase(purchase);
  assert.equal(draft.lines[0].units, '120'); assert.equal(draft.lines[1].mode, 'bulk'); assert.equal(draft.lines[1].pricePerBulk, '360'); assert.equal(draft.lines[1].id, 2);
  assert.equal(purchaseTotal(purchase), 2100);
  assert.deepEqual(sortPurchases([{ id: 1, purchaseDate: '2026-10-01' }, { id: 3, purchaseDate: '2026-10-20' }, { id: 2, purchaseDate: '2026-10-20' }]).map(p => p.id), [3, 2, 1]);
});
