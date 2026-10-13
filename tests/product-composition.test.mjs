import test from "node:test";
import assert from "node:assert/strict";
import { compositionLines } from "../app/lib/product-composition.ts";

test("composition preserves merchant order and verified text",()=>{
  assert.deepEqual(compositionLines("  Algodón 80%\r\n\n Poliéster 15% \nElastano 5% "),["Algodón 80%","Poliéster 15%","Elastano 5%"]);
  assert.deepEqual(compositionLines(" \n "),[]);
});
test("composition has bounded count and line length",()=>{
  assert.equal(compositionLines(Array(20).fill("Material").join("\n")).length,20);
  assert.throws(()=>compositionLines(Array(21).fill("Material").join("\n")));
  assert.equal(compositionLines("a".repeat(150))[0].length,150);
  assert.throws(()=>compositionLines("a".repeat(151)));
  assert.throws(()=>compositionLines("Algodón\u0000"));
});
