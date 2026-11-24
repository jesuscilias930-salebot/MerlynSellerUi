"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Al cambiar, abre la sección y la muestra (p. ej. desde un botón «Configurar»). */
  revealSignal?: number;
};

export function ToolAccordion({ icon, title, description, children, defaultOpen = false, className = "", revealSignal = 0 }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!revealSignal) return;
    void Promise.resolve().then(() => { setOpen(true); window.setTimeout(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); });
  }, [revealSignal]);

  return (
    <section ref={section} className={`tool-card tool-accordion ${open ? "is-open" : ""} ${className}`}>
      <button className="tool-accordion-trigger" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className="tool-accordion-icon">{icon}</span>
        <span className="tool-accordion-copy"><b>{title}</b>{description && <small>{description}</small>}</span>
        <span className="tool-accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <div className="tool-accordion-content">{children}</div>}
    </section>
  );
}
