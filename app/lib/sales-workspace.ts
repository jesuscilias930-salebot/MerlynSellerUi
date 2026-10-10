export type SalesPeriod = "day" | "week" | "year" | "custom";
export type SalesRange = { start: string; end: string };

export function salesToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function salesRange(period: SalesPeriod, anchor = salesToday()): SalesRange {
  if (period === "year") return { start: `${anchor.slice(0, 4)}-01-01`, end: `${anchor.slice(0, 4)}-12-31` };
  if (period === "week") {
    const date = new Date(`${anchor}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const start = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 6);
    return { start, end: date.toISOString().slice(0, 10) };
  }
  return { start: anchor, end: anchor };
}

export function validSalesRange(range: SalesRange): boolean {
  return [range.start, range.end].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date) && range.start <= range.end;
}

export type SaleProduct = { id?: number; name?: string; gender?: string | null; category?: { name?: string | null } | null };
export function saleProductName(product?: SaleProduct | null): string {
  return [product?.name, product?.category?.name, product?.gender].filter(Boolean).join(" · ") || "Producto";
}

export function saleSource(source?: string | null): string {
  return ({ CHAT: "Chat", MANUAL: "Manual", STORE: "Tienda" } as Record<string, string>)[source || ""] || "Sin origen registrado";
}
