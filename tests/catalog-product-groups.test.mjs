import test from "node:test";
import assert from "node:assert/strict";
import { catalogProductName, groupCatalogProducts } from "../app/lib/catalog-product-groups.ts";

test("titles identify product, category and gender, including babies", () => {
  assert.equal(catalogProductName({name:"CALCETA",category:{id:1,name:"CARICATURA"},gender:"Bebé niña"}), "CALCETA · CARICATURA · Bebé niña");
  assert.equal(catalogProductName({name:"TIN"}), "TIN · Sin categoría · Sin género");
});
test("genders share category container, categories stay separate and unknown goes last", () => {
  const products = [
    {id:1,name:"TIN"},
    {id:2,name:"CALCETA",category:{id:2,name:"Deportiva"},gender:"Unisex"},
    {id:3,name:"CALCETA",category:{id:1,name:"Caricatura"},gender:"Niño"},
    {id:4,name:"CALCETA",category:{id:1,name:"Caricatura"},gender:"Niña"},
  ];
  const groups = groupCatalogProducts(products);
  assert.deepEqual(groups.map(g => g.name), ["Caricatura","Deportiva","Sin categoría"]);
  assert.deepEqual(groups[0].products.map(p => p.id), [3,4]);
  assert.equal(products[0].id, 1);
});
test("empty search results render no groups and IDs remain distinct", () => {
  assert.deepEqual(groupCatalogProducts([]), []);
  assert.equal(groupCatalogProducts([{name:"A",category:{id:1,name:"Tipo"}},{name:"B",category:{id:2,name:"Tipo"}}]).length, 2);
});
