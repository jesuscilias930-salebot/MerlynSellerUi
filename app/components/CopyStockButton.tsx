"use client";

import { useEffect, useState } from "react";
import { loadInventory } from "../lib/inventory-snapshot";
import { productFamily, stockListMessage } from "../lib/quick-inventory";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Sin permiso del portapapeles (p. ej. dentro de un iframe): método clásico.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("No se pudo copiar. Revisa los permisos del navegador.");
}

/**
 * Copia las existencias actuales del producto (todas sus tallas y colores con stock)
 * como lista lista para pegar en un mensaje.
 */
export function CopyStockButton({ productId, className }: { productId: number; className?: string }) {
  const [state, setState] = useState<{ busy?: boolean; text?: string; error?: boolean }>({});
  useEffect(() => {
    if (!state.text) return;
    const timer = window.setTimeout(() => setState({}), 2600);
    return () => window.clearTimeout(timer);
  }, [state.text]);
  const copy = async () => {
    setState({ busy: true });
    try {
      // Siempre a Control: la existencia debe ser la actual.
      const inventory = await loadInventory(true);
      const product = inventory.products.find(item => item.id === productId);
      if (!product) throw new Error("El producto ya no está en Control.");
      const message = stockListMessage(product.model?.trim() || product.name, productFamily(inventory.products, product));
      if (!message) return setState({ text: "Sin existencias para copiar", error: true });
      await copyText(message);
      setState({ text: "Existencias copiadas ✓" });
    } catch (reason) {
      setState({ text: reason instanceof Error ? reason.message : "No se pudo copiar.", error: true });
    }
  };
  return <span className={`copy-stock ${className || ""}`}>
    <button type="button" onClick={() => void copy()} disabled={state.busy} title="Copia las tallas y colores con existencia, listos para mandar por mensaje">
      {state.busy ? "Copiando…" : "📋 Copiar existencias"}
    </button>
    {state.text && <small role="status" className={state.error ? "copy-stock-error" : undefined}>{state.text}</small>}
  </span>;
}
