"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/** Fila horizontal de chips; si no caben, se desliza y muestra flechas ‹ ›. */
export function ChipCarousel({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges(current => current.start === start && current.end === end ? current : { start, end });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach(child => observer.observe(child));
    el.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", measure); };
  }, [measure, children]);

  // Lleva a la vista el chip actual (la columna asignada) al abrir el chat.
  useEffect(() => {
    const el = track.current;
    const current = el?.querySelector<HTMLElement>("[aria-current='true']");
    if (el && current) el.scrollLeft = Math.max(0, current.offsetLeft - el.clientWidth / 2 + current.offsetWidth / 2);
  }, [children]);

  const slide = (direction: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return <div className={`chip-carousel ${className}`} role="group" aria-label={label} data-start={edges.start || undefined} data-end={edges.end || undefined}>
    {edges.start && <button type="button" className="chip-carousel-arrow prev" aria-label="Ver columnas anteriores" onClick={() => slide(-1)}>‹</button>}
    <div ref={track} className="chip-carousel-track">{children}</div>
    {edges.end && <button type="button" className="chip-carousel-arrow next" aria-label="Ver más columnas" onClick={() => slide(1)}>›</button>}
  </div>;
}
