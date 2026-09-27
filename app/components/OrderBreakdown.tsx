import styles from "./StoreOrdersPanel.module.css";

type OrderLine = { kind: string; itemId: number; name: string; quantity: number; unitPrice: number; contents?: string };
const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function OrderBreakdown({ lines, subtotal, shippingAmount, total, shippingCarrier, shippingService, shippingEnvironment }: {
  lines: OrderLine[]; subtotal: number; shippingAmount?: number | null; total?: number;
  shippingCarrier?: string; shippingService?: string; shippingEnvironment?: string;
}) {
  const groups = [
    { name: "Paquetes", lines: lines.filter(line => line.kind === "BUNDLE"), bundles: true },
    { name: "Productos individuales", lines: lines.filter(line => line.kind !== "BUNDLE"), bundles: false },
  ];
  const hasShipping = shippingAmount != null;
  return <section className={styles.breakdown} aria-label="Desglose del pedido">
    <h3>Desglose del pedido</h3>
    {!lines.length && <p>No hay artículos registrados en este pedido.</p>}
    {groups.filter(group => group.lines.length > 0).map(group => <section key={group.name} className={styles.itemGroup}>
      <h4>{group.name} <span>{group.lines.length} {group.lines.length === 1 ? "renglón" : "renglones"}</span></h4>
      {group.lines.map((line, index) => <article className={styles.itemCard} key={`${line.kind}-${line.itemId}-${index}`}>
        <div className={styles.itemHeading}><h5>{line.name}</h5><span className={styles.quantity}>{line.quantity} {group.bundles ? line.quantity === 1 ? "caja" : "cajas" : "unidades"}</span></div>
        <dl className={styles.itemAmounts}>
          <div><dt>Precio por {group.bundles ? "caja" : "unidad"}</dt><dd>{money(Number(line.unitPrice))}</dd></div>
          <div><dt>Importe · {line.quantity} × {money(Number(line.unitPrice))}</dt><dd>{money(line.quantity * Number(line.unitPrice))}</dd></div>
        </dl>
        {line.contents && <div className={styles.contents}><strong>{group.bundles ? "Contenido de cada caja" : "Detalle del producto"}</strong><p>{line.contents}</p></div>}
      </article>)}
    </section>)}
    <div className={styles.totals}>
      <h4>Resumen de importes <small>MXN</small></h4>
      <dl>
        <div><dt>Subtotal de artículos</dt><dd>{money(Number(subtotal))}</dd></div>
        <div><dt>Envío</dt><dd>{hasShipping ? money(Number(shippingAmount)) : "Por acordar"}</dd></div>
        <div className={styles.grandTotal}><dt>{hasShipping ? "Total del pedido" : "Total sin envío"}</dt><dd>{money(Number(total ?? (Number(subtotal) + Number(shippingAmount ?? 0))))}</dd></div>
      </dl>
      {hasShipping && <p>{[shippingCarrier, shippingService].filter(Boolean).join(" · ")}{shippingEnvironment === "sandbox" && " · Tarifa de prueba"}</p>}
      {!hasShipping && <p>El envío aún no está incluido; se acuerda por separado.</p>}
    </div>
  </section>;
}
