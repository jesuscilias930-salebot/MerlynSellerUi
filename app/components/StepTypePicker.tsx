"use client";

import { useEffect, useRef } from "react";
import type { ScenarioStep } from "../lib/types";

type StepType = ScenarioStep["type"];
export const STEP_TYPE_INFO: { type: StepType; icon: string; label: string; description: string }[] = [
  { type: "send_text", icon: "✉", label: "Enviar mensaje", description: "Un texto que recibe el cliente." },
  { type: "send_options", icon: "☰", label: "Mensaje con opciones", description: "Botones o lista; cada opción sigue su camino." },
  { type: "wait_reply", icon: "◌", label: "Esperar respuesta", description: "Lee lo que escribe el cliente y elige un camino." },
  { type: "send_catalog", icon: "▤", label: "Enviar catálogo", description: "El PDF de catálogo configurado del negocio." },
  { type: "send_media", icon: "▧", label: "Imágenes o documentos", description: "Fotos o PDF que ya subiste." },
  { type: "budget_recommendation", icon: "💰", label: "Recomendar por presupuesto", description: "Sugiere paquetes según cuánto quiere invertir." },
  { type: "move_column", icon: "↗", label: "Mover lead", description: "Cambia la columna del lead en Leads." },
  { type: "end", icon: "✓", label: "Finalizar", description: "Termina el escenario; continúa tu equipo." },
];

type Props = { title: string; onPick: (type: StepType) => void; onClose: () => void; align?: "left" | "right"; anchor?: DOMRect | null; note?: string };
const WIDTH = 300;
const HEIGHT = 390;

/** Menú para elegir el tipo de paso a agregar. Esc o clic fuera lo cierra. */
export function StepTypePicker({ title, onPick, onClose, align = "left", anchor, note }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onPointer); };
  }, [onClose]);
  // Con `anchor` se muestra fijo junto al botón para no quedar recortado por el mapa.
  const fixed = anchor ? {
    position: "fixed" as const,
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8)),
    top: anchor.bottom + 6 + HEIGHT > window.innerHeight ? Math.max(8, anchor.top - HEIGHT - 6) : anchor.bottom + 6,
    right: "auto",
  } : undefined;
  return <div ref={ref} style={fixed} className={`step-type-picker ${align === "right" ? "align-right" : ""}`} role="menu" aria-label={title} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <p>{title}</p>
    {note && <small className="step-type-picker-note">{note}</small>}
    {STEP_TYPE_INFO.map(item => <button key={item.type} type="button" role="menuitem" onClick={() => onPick(item.type)}>
      <span aria-hidden="true">{item.icon}</span><b>{item.label}</b><small>{item.description}</small>
    </button>)}
  </div>;
}
