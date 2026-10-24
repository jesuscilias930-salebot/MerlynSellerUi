/** Prendas tomadas temporalmente del almacén. Solo es un aviso: no cambia la existencia de Control. */
export type InventoryLoan = {
  id: string; productId: number; productName: string; quantity: number; location: string;
  takenBy: string | null; returnDate: string | null; notes: string | null;
  status: "out" | "returned"; createdAt: string; returnedAt: string | null;
};
export type LoanDraft = { quantity: string; location: string; takenBy: string; returnDate: string; notes: string };

export const emptyLoanDraft = (): LoanDraft => ({ quantity: "1", location: "", takenBy: "", returnDate: "", notes: "" });
export const draftFromLoan = (loan: InventoryLoan): LoanDraft => ({
  quantity: String(loan.quantity), location: loan.location, takenBy: loan.takenBy || "", returnDate: loan.returnDate || "", notes: loan.notes || "",
});

export function loanIssues(draft: LoanDraft): string[] {
  const quantity = Number(draft.quantity);
  return [
    !Number.isInteger(quantity) || quantity < 1 ? "Escribe cuántas prendas se tomaron." : "",
    !draft.location.trim() ? "Escribe dónde están las prendas." : "",
    draft.location.trim().length > 80 ? "El lugar admite máximo 80 caracteres." : "",
    draft.takenBy.trim().length > 60 ? "El nombre admite máximo 60 caracteres." : "",
    draft.notes.trim().length > 300 ? "La nota admite máximo 300 caracteres." : "",
  ].filter(Boolean);
}

export const loanPayload = (productId: number, productName: string, draft: LoanDraft) => ({
  productId, productName: productName.trim().slice(0, 200), quantity: Number(draft.quantity),
  location: draft.location.trim(), takenBy: draft.takenBy.trim() || null, returnDate: draft.returnDate || null, notes: draft.notes.trim() || null,
});

/** Salidas abiertas agrupadas por producto. */
export function loansByProduct(loans: InventoryLoan[]): Map<number, InventoryLoan[]> {
  const result = new Map<number, InventoryLoan[]>();
  for (const loan of loans) if (loan.status === "out") result.set(loan.productId, [...(result.get(loan.productId) || []), loan]);
  return result;
}
export const piecesOut = (loans: InventoryLoan[] | undefined) => (loans || []).reduce((sum, loan) => sum + loan.quantity, 0);

const localDay = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
/** Ya pasó la fecha de regreso y siguen fuera. */
export const isOverdue = (loan: Pick<InventoryLoan, "returnDate" | "status">, now = new Date()) => loan.status === "out" && Boolean(loan.returnDate) && (loan.returnDate as string) < localDay(now);

/** «hoy», «mañana» o «lun 2 nov». */
export function returnDateLabel(value: string | null, now = new Date()): string {
  if (!value) return "";
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (value === today) return "hoy";
  if (value === tomorrow) return "mañana";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}

/** «6 fuera · Tienda Centro · Ana · regresa mañana». */
export function loanLine(loan: InventoryLoan, now = new Date()): string {
  return [
    `${loan.quantity} ${loan.quantity === 1 ? "pieza" : "piezas"} fuera`,
    loan.location,
    loan.takenBy && `con ${loan.takenBy}`,
    loan.returnDate && (isOverdue(loan, now) ? `debía regresar ${returnDateLabel(loan.returnDate, now)}` : `regresa ${returnDateLabel(loan.returnDate, now)}`),
  ].filter(Boolean).join(" · ");
}

/** Lugares y personas usados antes, para sugerirlos al escribir. */
export function loanSuggestions(loans: InventoryLoan[], key: "location" | "takenBy"): string[] {
  const seen = new Map<string, string>();
  for (const loan of loans) {
    const value = loan[key]?.trim();
    if (value && !seen.has(value.toLocaleLowerCase("es"))) seen.set(value.toLocaleLowerCase("es"), value);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es")).slice(0, 30);
}
