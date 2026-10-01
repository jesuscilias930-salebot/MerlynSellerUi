"use client";

import { type ReactNode, useEffect, useRef } from "react";

export function MobileChatSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="mobile-chat-sheet" aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><h2>{title}</h2><button type="button" aria-label="Cerrar panel" onClick={onClose}>×</button></header>
    <div className="mobile-chat-sheet-body">{children}</div>
  </dialog>;
}
