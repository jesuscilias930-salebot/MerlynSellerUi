"use client";

import { useEffect, useRef } from "react";

/** Al final de una lista: cuando se ve, pide la siguiente página (scroll infinito). */
export function LoadMoreSentinel({ loading, onVisible, label = "Cargar más" }: { loading: boolean; onVisible: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  useEffect(() => { callback.current = onVisible; }, [onVisible]);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // rootMargin: empieza a cargar un poco antes de llegar al final.
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) callback.current(); }, { rootMargin: "0px 0px 240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="load-more-sentinel" aria-live="polite">
    {loading ? <span>Cargando…</span> : <button type="button" className="plain-button" onClick={() => callback.current()}>{label}</button>}
  </div>;
}
