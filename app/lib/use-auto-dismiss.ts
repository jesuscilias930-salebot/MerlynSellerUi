import { useEffect, useRef, useState } from "react";

export const AUTO_DISMISS_MS = 2000;

/** Cierra el aviso a los 2 s; si el puntero está encima, espera a que salga para poder leerlo. */
export function useAutoDismiss(message: string, clear: () => void, ms = AUTO_DISMISS_MS) {
  const [hovered, setHovered] = useState(false);
  const clearRef = useRef(clear);
  useEffect(() => { clearRef.current = clear; }, [clear]);
  useEffect(() => {
    if (!message || hovered) return;
    const timer = window.setTimeout(() => clearRef.current(), ms);
    return () => window.clearTimeout(timer);
  }, [message, hovered, ms]);
  return { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
}
