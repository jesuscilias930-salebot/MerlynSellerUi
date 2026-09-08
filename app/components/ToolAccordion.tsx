"use client";

import { useState, type ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export function ToolAccordion({ icon, title, description, children, defaultOpen = false, className = "" }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`tool-card tool-accordion ${open ? "is-open" : ""} ${className}`}>
      <button className="tool-accordion-trigger" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span className="tool-accordion-icon">{icon}</span>
        <span className="tool-accordion-copy"><b>{title}</b>{description && <small>{description}</small>}</span>
        <span className="tool-accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <div className="tool-accordion-content">{children}</div>}
    </section>
  );
}
