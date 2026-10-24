"use client";

import { useEffect, useState } from "react";
import { cachedInventory, loadInventory } from "./inventory-snapshot";

/** Productos de Control (con color y talla) para completar nombres guardados sin ellos. */
export function useInventoryProducts() {
  const [products, setProducts] = useState(() => cachedInventory()?.products ?? []);
  useEffect(() => {
    let active = true;
    loadInventory().then(snapshot => { if (active) setProducts(snapshot.products); }).catch(() => { /* Sin sesión de Control se muestran los nombres guardados. */ });
    return () => { active = false; };
  }, []);
  return products;
}
