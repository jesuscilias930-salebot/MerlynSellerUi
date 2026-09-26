"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

export function BundleEditorDialog({ title, saving, onClose, children }: {
  title: string;
  saving: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="bundle-editor-dialog" aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <header className="bundle-modal-header"><div><p>CONFIGURACIÓN DE BUNDLES</p><h2 id={titleId}>{title}</h2></div>
      <button type="button" className="plain-button" aria-label="Cerrar editor de bundle" disabled={saving} onClick={onClose}>Cerrar ×</button>
    </header>
    {children}
  </dialog>;
}
