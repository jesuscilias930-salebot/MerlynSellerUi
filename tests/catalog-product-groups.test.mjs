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

test('agrupa productos que solo cambian de talla para compartir fotos', async () => {
  const { groupSizeSiblings } = await import('../app/lib/catalog-product-groups.ts');
  const cat = { id: 2, name: 'Básicos' };
  const products = [
    { id: 1, name: 'Essential High Quality', gender: 'Hombre', size: '25-28', category: cat },
    { id: 2, name: 'Essential High Quality', gender: 'Hombre', size: '22-25', category: cat },
    { id: 3, name: 'Essential High Quality', gender: 'Hombre', size: '25-28', category: cat },
    { id: 4, name: 'Essential High Quality', gender: 'Mujer', size: '22-25', category: cat },
  ];
  const colors = { 1: 'Negro', 2: 'negro', 3: 'Blanco', 4: 'Negro' };
  const groups = groupSizeSiblings(products, colors, id => (id === 2 ? 3 : 0));
  assert.deepEqual(groups.map(g => [g.products.map(p => p.id), g.primary.id, g.sizes]), [
    [[1, 2], 2, ['25-28', '22-25']],
    [[3], 3, ['25-28']],
    [[4], 4, ['22-25']],
  ]);
});
