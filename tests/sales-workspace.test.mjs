import test from "node:test";
import assert from "node:assert/strict";
import { salesToday, salesRange, validSalesRange, saleProductName, saleSource } from "../app/lib/sales-workspace.ts";

test("local sales day does not roll over with UTC", () => {
  assert.equal(salesToday(new Date("2026-10-11T02:00:00Z")), "2026-10-10");
});
test("week includes all Monday to Sunday dates, including year boundaries", () => {
  assert.deepEqual(salesRange("week", "2026-10-11"), { start: "2026-10-05", end: "2026-10-11" });
  assert.deepEqual(salesRange("week", "2026-01-01"), { start: "2025-12-29", end: "2026-01-04" });
});
test("day and year support historical anchors", () => {
  assert.deepEqual(salesRange("day", "2025-02-20"), { start: "2025-02-20", end: "2025-02-20" });
  assert.deepEqual(salesRange("year", "2025-02-20"), { start: "2025-01-01", end: "2025-12-31" });
});
test("reject incomplete and inverted ranges", () => {
  assert.equal(validSalesRange({ start: "", end: "2026-10-01" }), false);
  assert.equal(validSalesRange({ start: "2026-10-10", end: "2026-10-01" }), false);
  assert.equal(validSalesRange({ start: "2026-10-10", end: "2026-10-10" }), true);
  assert.equal(validSalesRange({ start: "2026-02-30", end: "2026-03-01" }), false);
});
test("product identity keeps category and gender; never guesses legacy sale source", () => {
  assert.equal(saleProductName({ name: "CALCETA", category: { name: "CARICATURA" }, gender: "Niña" }), "CALCETA · CARICATURA · Niña");
  assert.equal(saleSource("CHAT"), "Chat");
  assert.equal(saleSource(null), "Sin origen registrado");
});
