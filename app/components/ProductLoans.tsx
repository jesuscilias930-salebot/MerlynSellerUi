"use client";

import { useId, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import {
  draftFromLoan, emptyLoanDraft, isOverdue, loanIssues, loanLine, loanPayload, loanSuggestions, piecesOut,
  type InventoryLoan, type LoanDraft,
} from "../lib/inventory-loans";

type Props = { productId: number; productName: string; loans: InventoryLoan[]; allLoans: InventoryLoan[]; onChanged: () => void };

/** Prendas de este producto que se tomaron temporalmente: dónde están, quién las tiene y cuándo regresan. */
export function ProductLoans({ productId, productName, loans, allLoans, onChanged }: Props) {
  const [form, setForm] = useState<{ loan?: InventoryLoan } | null>(null);
  const [returning, setReturning] = useState<{ loan: InventoryLoan; quantity: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); setReturning(null); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };
  const out = piecesOut(loans);
  return <div className="loan-box">
    {loans.length > 0 && <ul className="loan-list">{loans.map(loan => <li key={loan.id} className={isOverdue(loan) ? "overdue" : ""}>
      {returning?.loan.id === loan.id ? <form className="loan-return" onSubmit={event => { event.preventDefault(); void run(() => request(`/inventory-loans/${loan.id}/return`, { method: "POST", body: JSON.stringify({ quantity: Number(returning.quantity) }) })); }}>
        <label>¿Cuántas regresaron?<input type="number" min={1} max={loan.quantity} autoFocus value={returning.quantity} onChange={event => setReturning({ loan, quantity: event.target.value })} /></label>
        <span>de {loan.quantity}</span>
        <button type="button" disabled={busy} onClick={() => setReturning(null)}>Cancelar</button>
        <button type="submit" className="location-save" disabled={busy || !(Number(returning.quantity) >= 1 && Number(returning.quantity) <= loan.quantity)}>{busy ? "Guardando…" : "Confirmar"}</button>
      </form> : <>
        <span><b>🚚 {loanLine(loan)}</b>{loan.notes && <small>📝 {loan.notes}</small>}</span>
        <span className="loan-actions">
          <button type="button" disabled={busy} onClick={() => setReturning({ loan, quantity: String(loan.quantity) })}>✓ Regresaron</button>
          <button type="button" disabled={busy} onClick={() => setForm({ loan })}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar el registro de ${loan.quantity} prendas en «${loan.location}»? Úsalo solo si fue un error; si ya regresaron, marca «Regresaron».`)) void run(() => request(`/inventory-loans/${loan.id}`, { method: "DELETE" })); }}>Eliminar</button>
        </span>
      </>}
    </li>)}</ul>}
    {error && <p className="location-error" role="alert">{error}</p>}
    {form ? <LoanForm productId={productId} productName={productName} loan={form.loan} allLoans={allLoans} onClose={() => setForm(null)} onSaved={() => { setForm(null); onChanged(); }} />
      : <button type="button" className="loan-add" onClick={() => setForm({})}>＋ Registrar prendas tomadas{out > 0 ? ` (${out} fuera)` : ""}</button>}
  </div>;
}

function LoanForm({ productId, productName, loan, allLoans, onClose, onSaved }: { productId: number; productName: string; loan?: InventoryLoan; allLoans: InventoryLoan[]; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState<LoanDraft>(() => (loan ? draftFromLoan(loan) : emptyLoanDraft()));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const issues = loanIssues(draft);
  const set = (key: keyof LoanDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setTouched(true);
    if (issues.length) return;
    setSaving(true); setError("");
    try {
      await request(loan ? `/inventory-loans/${loan.id}` : "/inventory-loans", { method: loan ? "PUT" : "POST", body: JSON.stringify(loanPayload(productId, loan?.productName || productName, draft)) });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); setSaving(false); }
  };
  return <form className="location-editor loan-form" onSubmit={submit} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
    <p className="location-editor-note">{loan ? "Editar salida temporal" : "Prendas tomadas temporalmente"} · No cambia la existencia en Control.</p>
    <div className="loan-fields">
      <label>Cantidad<input type="number" min={1} autoFocus value={draft.quantity} onChange={event => set("quantity", event.target.value)} /></label>
      <label className="wide">¿Dónde están?<input list={`${id}-location`} value={draft.location} maxLength={80} placeholder="Ej. Exhibición tienda Centro" onChange={event => set("location", event.target.value)} /></label>
      <label>¿Quién las tomó?<input list={`${id}-taker`} value={draft.takenBy} maxLength={60} placeholder="Opcional" onChange={event => set("takenBy", event.target.value)} /></label>
      <label>Fecha de regreso<input type="date" value={draft.returnDate} onChange={event => set("returnDate", event.target.value)} /></label>
      <label className="wide">Nota<input value={draft.notes} maxLength={300} placeholder="Opcional · Ej. para sesión de fotos" onChange={event => set("notes", event.target.value)} /></label>
    </div>
    <datalist id={`${id}-location`}>{loanSuggestions(allLoans, "location").map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-taker`}>{loanSuggestions(allLoans, "takenBy").map(value => <option key={value} value={value} />)}</datalist>
    {touched && issues.length > 0 && <p className="location-error" role="alert">{issues[0]}</p>}
    {error && <p className="location-error" role="alert">No se guardó. {error}</p>}
    <div className="location-actions">
      <button type="button" disabled={saving} onClick={onClose}>Cancelar</button>
      <button type="submit" className="location-save" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
    </div>
  </form>;
}

/** Resumen arriba del inventario: todo lo que está fuera del almacén. */
export function LoansSummary({ loans }: { loans: InventoryLoan[] }) {
  const open = loans.filter(loan => loan.status === "out");
  if (!open.length) return null;
  const overdue = open.filter(loan => isOverdue(loan)).length;
  const pieces = piecesOut(open);
  return <details className="loan-summary">
    <summary>🚚 <b>{pieces} {pieces === 1 ? "prenda" : "prendas"} fuera del almacén</b> en {open.length} {open.length === 1 ? "salida" : "salidas"}{overdue > 0 && <span className="loan-overdue-badge">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</span>}</summary>
    <ul>{open.map(loan => <li key={loan.id} className={isOverdue(loan) ? "overdue" : ""}><span><b>{loan.productName}</b><small>{loanLine(loan)}{loan.notes ? ` · ${loan.notes}` : ""}</small></span><small>#{loan.productId}</small></li>)}</ul>
  </details>;
}
