// Adquisición de mercancía: borrador de compra, totales y conversión al formato
// de Control de ventas (POST/PUT /purchase). El backend recalcula los totales.
export type PurchaseMode = "unit" | "bulk";
export type PurchaseLine = {
  key: string; id?: number; productId: string; mode: PurchaseMode;
  units: string; unitCost: string; bulks: string; unitsPerBulk: string; pricePerBulk: string; taxed: boolean;
};
export type PurchaseDraft = { supplierName: string; purchaseDate: string; invoiceTotal: string; lines: PurchaseLine[] };
export type PurchaseItem = {
  id?: number; productId?: number; product?: { id?: number; name?: string; category?: { name?: string } | null; gender?: string | null; size?: string | null };
  isBulk?: boolean; unitsPerBulk?: number; bulksReceived?: number; individualUnitsReceived?: number; totalUnitsAcquired?: number;
  unitCostNet?: number; isTaxed?: boolean; pricePerBulk?: number | null; totalPaid?: number;
};
export type Purchase = { id: number; supplierName?: string | null; totalInvoiceAmount?: number | null; purchaseDate?: string | null; purchaseItemsRequest?: PurchaseItem[] };

let counter = 0;
const key = () => `line-${Date.now().toString(36)}-${(counter += 1)}`;
const pad = (value: number) => String(value).padStart(2, "0");
export const localToday = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const num = (value: string) => (value.trim() === "" ? NaN : Number(value));
const round2 = (value: number) => Math.round(value * 100) / 100;

export const emptyLine = (): PurchaseLine => ({ key: key(), productId: "", mode: "unit", units: "", unitCost: "", bulks: "1", unitsPerBulk: "", pricePerBulk: "", taxed: false });
export const emptyPurchase = (): PurchaseDraft => ({ supplierName: "", purchaseDate: localToday(), invoiceTotal: "", lines: [emptyLine()] });

/** Piezas, costo por pieza y total de una línea (0 si falta un dato). */
export function lineTotals(line: PurchaseLine) {
  if (line.mode === "bulk") {
    const bulks = num(line.bulks) || 0, perBulk = num(line.unitsPerBulk) || 0, price = num(line.pricePerBulk) || 0;
    const units = bulks * perBulk;
    return { units, unitCost: perBulk ? price / perBulk : 0, total: round2(price * bulks) };
  }
  const units = num(line.units) || 0, unitCost = num(line.unitCost) || 0;
  return { units, unitCost, total: round2(units * unitCost) };
}
export function draftTotals(draft: PurchaseDraft) {
  const lines = draft.lines.map(lineTotals);
  const total = round2(lines.reduce((sum, line) => sum + line.total, 0));
  const invoice = num(draft.invoiceTotal);
  return {
    products: draft.lines.filter(line => line.productId).length,
    units: lines.reduce((sum, line) => sum + line.units, 0),
    total,
    invoice: Number.isFinite(invoice) ? invoice : null,
    difference: Number.isFinite(invoice) ? round2(invoice - total) : null,
  };
}

const positiveInt = (value: string) => Number.isInteger(num(value)) && num(value) > 0;
export function lineIssues(line: PurchaseLine): string[] {
  const issues: string[] = [];
  if (!line.productId) issues.push("elige el producto");
  if (line.mode === "unit") {
    if (!positiveInt(line.units)) issues.push("indica las piezas recibidas");
    if (!(num(line.unitCost) > 0)) issues.push("indica el costo por pieza");
  } else {
    if (!positiveInt(line.bulks)) issues.push("indica cuántos bultos");
    if (!positiveInt(line.unitsPerBulk)) issues.push("indica las piezas por bulto");
    if (!(num(line.pricePerBulk) > 0)) issues.push("indica el precio por bulto");
  }
  return issues;
}
export function draftIssues(draft: PurchaseDraft): string[] {
  const issues: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate)) issues.push("Selecciona la fecha de compra.");
  if (draft.invoiceTotal.trim() && !(num(draft.invoiceTotal) >= 0)) issues.push("El total de factura no es válido.");
  if (!draft.lines.length) issues.push("Agrega al menos un producto.");
  draft.lines.forEach((line, index) => {
    const problems = lineIssues(line);
    if (problems.length) issues.push(`Producto ${index + 1}: ${problems.join(", ")}.`);
  });
  const ids = draft.lines.map(line => line.productId).filter(Boolean);
  if (new Set(ids).size !== ids.length) issues.push("Un producto aparece dos veces; junta sus piezas en una sola línea.");
  return issues;
}

export function toPurchaseRequest(draft: PurchaseDraft) {
  return {
    supplierName: draft.supplierName.trim() || null,
    // Fecha de calendario: sin conversión UTC que la mueva de día.
    purchaseDate: `${draft.purchaseDate}T00:00:00`,
    totalInvoiceAmount: draft.invoiceTotal.trim() ? Number(draft.invoiceTotal) : null,
    purchaseItemsRequest: draft.lines.map(line => {
      const bulk = line.mode === "bulk";
      const totals = lineTotals(line);
      return {
        ...(line.id ? { id: line.id } : {}),
        productId: Number(line.productId),
        isBulk: bulk,
        isTaxed: line.taxed,
        bulksReceived: bulk ? Number(line.bulks) : 0,
        unitsPerBulk: bulk ? Number(line.unitsPerBulk) : 0,
        individualUnitsReceived: bulk ? 0 : Number(line.units),
        unitCostNet: totals.unitCost,
        pricePerBulk: bulk ? Number(line.pricePerBulk) : null,
        // Vista previa; el backend los recalcula.
        totalUnitsAcquired: totals.units,
        totalPaid: totals.total,
      };
    }),
  };
}

export function draftFromPurchase(purchase: Purchase): PurchaseDraft {
  const items = purchase.purchaseItemsRequest?.length ? purchase.purchaseItemsRequest : [];
  return {
    supplierName: purchase.supplierName || "",
    purchaseDate: purchase.purchaseDate?.slice(0, 10) || localToday(),
    invoiceTotal: purchase.totalInvoiceAmount == null ? "" : String(purchase.totalInvoiceAmount),
    lines: items.length ? items.map(item => ({
      key: key(), ...(item.id ? { id: item.id } : {}),
      productId: String(item.productId || item.product?.id || ""),
      mode: item.isBulk ? "bulk" : "unit",
      units: item.isBulk ? "" : String(item.individualUnitsReceived ?? item.totalUnitsAcquired ?? ""),
      unitCost: item.isBulk ? "" : String(item.unitCostNet ?? ""),
      bulks: String(item.bulksReceived ?? 1), unitsPerBulk: String(item.unitsPerBulk || ""), pricePerBulk: String(item.pricePerBulk ?? ""),
      taxed: Boolean(item.isTaxed),
    })) : [emptyLine()],
  };
}

export const purchaseUnits = (purchase: Purchase) => (purchase.purchaseItemsRequest || []).reduce((sum, item) => sum + Number(item.totalUnitsAcquired || 0), 0);
export const purchaseTotal = (purchase: Purchase) =>
  purchase.totalInvoiceAmount != null && Number(purchase.totalInvoiceAmount) > 0
    ? Number(purchase.totalInvoiceAmount)
    : round2((purchase.purchaseItemsRequest || []).reduce((sum, item) => sum + Number(item.totalPaid || 0), 0));
/** Más recientes primero (por fecha de compra y número). */
export const sortPurchases = (purchases: Purchase[]) => [...purchases].sort((a, b) => (b.purchaseDate || "").localeCompare(a.purchaseDate || "") || b.id - a.id);
export const purchaseDateLabel = (iso?: string | null) => {
  if (!iso) return "Sin fecha";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
