import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyBoardPages, orderStages, orderBoardPath, orderStageFor, orderDateError, fulfillmentLabel, paymentLabel, orderDateLabel } from "../app/lib/order-board.ts";

test("four stages keep payment separate and preserve legacy, cancelled and test orders", () => {
  assert.deepEqual(orderStages.map(stage => stage.label), ["Pendiente", "Armado", "Guía creada", "Despachado"]);
  for (const state of [undefined, null, "AWAITING_PAYMENT", "READY", "STOCK_ISSUE", "TEST", "CANCELLED", "REFUND_REQUESTED", "REVIEW_REQUIRED"]) assert.equal(orderStageFor(state), "PENDING");
  assert.equal(orderStageFor("PREPARING"), "ASSEMBLED"); assert.equal(orderStageFor("LABEL_CREATED"), "LABEL_CREATED");
  for (const state of ["SHIPPED", "DELIVERED"]) assert.equal(orderStageFor(state), "DISPATCHED");
  assert.equal(paymentLabel("PAID_TEST"), "Pago de prueba"); assert.equal(fulfillmentLabel("CANCELLED"), "Cancelado");
});
test("dates and pagination are sent to the backend independently for each column", () => {
  const pages = { ...emptyBoardPages(), ASSEMBLED: 2 };
  const url = new URL(orderBoardPath({ startDate: "2026-10-01", endDate: "2026-10-13" }, pages), "https://local.test");
  assert.equal(url.pathname, "/pending-orders/board");
  assert.deepEqual(Object.fromEntries(url.searchParams), { size: "20", startDate: "2026-10-01", endDate: "2026-10-13", pendingPage: "0", assembledPage: "2", labelPage: "0", dispatchedPage: "0" });
  assert.equal(new URL(orderBoardPath({ startDate: "", endDate: "" }, emptyBoardPages()), url).searchParams.has("startDate"), false);
});
test("invalid calendar dates and inverted ranges are rejected without shifting dates to the host timezone", () => {
  assert.equal(orderDateError({ startDate: "2026-10-13", endDate: "2026-10-13" }), "");
  assert.equal(orderDateError({ startDate: "", endDate: "" }), "");
  for (const value of ["2026-02-30", "2026-02-29", "2026-2-03", "bad", "9999-12-31"]) assert.ok(orderDateError({ startDate: value, endDate: "" }));
  assert.ok(orderDateError({ startDate: "2026-10-14", endDate: "2026-10-13" }));
  assert.match(orderDateLabel("2026-10-14T05:59:59Z"), /13 oct/);
  assert.equal(orderDateLabel("bad-date"), "Fecha no disponible");
});
test("detail and fulfillment collections are fetched only by an opened native dialog, not by the board", () => {
  const board = readFileSync(new URL("../app/components/PendingOrdersPanel.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../app/components/OrderDetailsModal.tsx", import.meta.url), "utf8");
  assert.match(board, /selected && <OrderDetailsModal/); assert.doesNotMatch(board, /OrderBreakdown|OrderOperations|\.lines\.map/);
  assert.match(board, /new FormData\(event.currentTarget\)/); assert.match(board, /name="startDate"/); assert.match(board, /name="endDate"/);
  assert.match(modal, /<dialog/); assert.match(modal, /showModal\(\)/); assert.match(modal, /encodeURIComponent\(card.id\)/);
  assert.match(modal, /controller.abort\(\)/); assert.match(modal, /onBusyChange=\{setSaving\}/);
});
