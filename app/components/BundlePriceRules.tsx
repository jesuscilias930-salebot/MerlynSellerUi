"use client";

import { useEffect, useId, useState } from "react";
import { controlRequest } from "../lib/control-api";

type PriceRule = { id: number; ruleName: string; minQuantity: number; maxQuantity: number | null; pricePerUnit: number };
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function BundlePriceRules({ productId, productName, revision, applied, onRefresh }: {
  productId: number;
  productName: string;
  revision: number;
  applied?: { groupQuantity: number; unitPrice: number };
  onRefresh: () => void;
}) {
  const titleId = useId();
  const key = `${productId}:${revision}`;
  const [result, setResult] = useState<{ key: string; rules?: PriceRule[]; error?: string } | null>(null);
  const current = result?.key === key ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void controlRequest<PriceRule[]>(`/price-rule/product/${productId}`, { signal: controller.signal })
      .then(rules => {
        if (!Array.isArray(rules)) throw new Error("La respuesta de reglas no es válida.");
        if (active) setResult({ key, rules: [...rules].sort((a, b) => a.minQuantity - b.minQuantity || a.id - b.id) });
      })
      .catch(error => {
        if (active) setResult({ key, error: error instanceof Error ? error.message : "No fue posible consultar las reglas." });
      });
    return () => { active = false; controller.abort(); };
  }, [productId, key]);

  const matches = current?.rules?.filter(rule => applied && applied.groupQuantity >= rule.minQuantity && (rule.maxQuantity == null || applied.groupQuantity <= rule.maxQuantity)) || [];
  const appliedId = matches.length === 1 && Number(matches[0].pricePerUnit) === Number(applied?.unitPrice) ? matches[0].id : null;
  return <section className="bundle-price-rules" aria-labelledby={titleId}>
    <header><div><h4 id={titleId}>Todas las reglas de precio</h4><p>{productName}</p></div><button type="button" className="plain-button" onClick={onRefresh}>Actualizar reglas</button></header>
    <p className="bundle-price-rules-context">{applied ? `${applied.groupQuantity} pares acumulados en la categoría de esta caja.` : "Completa las cantidades para identificar el rango aplicado."} Precios por par con IVA incluido.</p>
    {!current && <p role="status">Cargando reglas…</p>}
    {current?.error && <p role="alert">{current.error} Usa «Actualizar reglas» para reintentar.</p>}
    {current?.rules?.length === 0 && <p role="status">Este producto no tiene reglas de precio. Configúralas en Control de ventas → Precios.</p>}
    {!!current?.rules?.length && <>
      {applied && appliedId == null && <p role="status">Las reglas mostradas no coinciden con la cotización actual. Actualiza las reglas para volver a comprobar el precio.</p>}
      <div className="bundle-price-rules-scroll" role="region" aria-label={`Reglas de ${productName}`} tabIndex={0}>
        <table>
          <caption>Escalas disponibles para {productName}</caption>
          <thead><tr><th scope="col">Escala</th><th scope="col">Pares de la categoría</th><th scope="col">Precio por par</th><th scope="col">Estado</th></tr></thead>
          <tbody>{current.rules.map(rule => {
            const isApplied = rule.id === appliedId;
            return <tr key={rule.id} className={isApplied ? "is-applied" : undefined}>
              <th scope="row">{rule.ruleName || "Sin nombre"}</th>
              <td>{rule.maxQuantity == null || rule.maxQuantity === 2147483647 ? `${rule.minQuantity} o más` : `${rule.minQuantity}–${rule.maxQuantity}`}</td>
              <td>{money(Number(rule.pricePerUnit))}</td>
              <td>{isApplied ? <strong>Aplicado</strong> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
