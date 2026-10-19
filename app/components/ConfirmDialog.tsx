"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Ventana de confirmación encima de cualquier otro modal. Esc o fondo = cancelar. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Cancelar", tone = "primary", busy = false, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // En acciones destructivas el foco inicial queda en «Cancelar».
    (tone === "danger" ? cancelRef : confirmRef).current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, tone, busy, onCancel]);
  if (!open) return null;
  return <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
    <button type="button" className="confirm-dialog-backdrop" aria-label={cancelLabel} onClick={() => !busy && onCancel()} />
    <section className="confirm-dialog-card">
      <h2 id="confirm-dialog-title">{title}</h2>
      {children && <div className="confirm-dialog-body">{children}</div>}
      <footer>
        <button ref={cancelRef} type="button" className="plain-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button ref={confirmRef} type="button" className={tone === "danger" ? "confirm-dialog-danger" : "primary-action"} disabled={busy} onClick={onConfirm}>{busy ? "Un momento…" : confirmLabel}</button>
      </footer>
    </section>
  </div>;
}
