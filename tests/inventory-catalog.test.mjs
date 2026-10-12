import test from "node:test";
import assert from "node:assert/strict";
import { inventoryCategoryKey, inventoryCategoryName, inventoryProductName, inventorySearchText, inventoryStockState, inventoryFilterParams, inventoryPagePath } from "../app/lib/inventory-catalog.ts";
import { controlResources } from "../app/lib/section-data.ts";

const product = { id: 3, name: "CALCETA", categoryId: 1, categoryName: "CARICATURA", gender: "Bebé niña", size: "12–15", currentStock: 600, minStockAlert: 20 };
test("inventory typeahead identifies product, category, gender and size", () => {
  assert.equal(inventoryProductName(product), "CALCETA · CARICATURA · Bebé niña · 12–15");
  assert.equal(inventoryProductName({ ...product, categoryName: null, gender: null, size: null }), "CALCETA · Sin categoría · Sin género");
});
test("inventory only loads its own backend catalog and waits for two search characters", () => {
  assert.deepEqual(controlResources("inventory"), []);
  assert.equal(inventorySearchText(" c "), ""); assert.equal(inventorySearchText(" niña "), "niña");
});
test("category pages are bounded and selection filters by exact ID, not its display name", () => {
  const path = inventoryPagePath({ categoryId: 1, name: "CARICATURA", productCount: 30 }, "caricatura", undefined, 1);
  const params = new URL(path, "https://local.test").searchParams;
  assert.equal(params.get("categoryId"), "1"); assert.equal(params.get("page"), "1"); assert.equal(params.get("size"), "20"); assert.equal(params.get("q"), "caricatura");
  assert.equal(inventoryFilterParams("ignored label", 3).toString(), "productId=3");
});
test("uncategorized products use an explicit filter rather than all categories", () => {
  const category = { categoryId: null, name: null, productCount: 1 };
  assert.equal(inventoryCategoryKey(category), "uncategorized"); assert.equal(inventoryCategoryName(category), "Sin categoría");
  assert.ok(inventoryPagePath(category, "", undefined, 0).includes("uncategorized=true"));
  assert.ok(!inventoryPagePath(category, "", undefined, 0).includes("categoryId="));
});
test("zero and low stock remain visible and are distinct states", () => {
  assert.equal(inventoryStockState(product), "ready"); assert.equal(inventoryStockState({ ...product, currentStock: 20 }), "low");
  assert.equal(inventoryStockState({ ...product, currentStock: 0 }), "empty");
});
