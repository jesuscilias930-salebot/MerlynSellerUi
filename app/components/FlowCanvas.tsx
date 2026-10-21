"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";

export type FlowCanvasHandle = { fit: () => void; centerOn: (x: number, y: number) => void; toWorld: (clientX: number, clientY: number) => { x: number; y: number } };
type View = { x: number; y: number; k: number };
type Props = {
  width: number;
  height: number;
  /** Cambia para volver a ajustar la vista (p. ej. al abrir otro escenario). */
  fitKey: string;
  children: ReactNode;
  overlay?: ReactNode;
  handle?: Ref<FlowCanvasHandle>;
  /** Punto a mostrar en pantallas angostas, donde ajustar todo dejaría el texto ilegible. */
  focus?: { x: number; y: number };
};
const MIN = 0.25;
const MAX = 1.75;
const clamp = (k: number) => Math.min(MAX, Math.max(MIN, k));
const isEditable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Lienzo infinito al estilo n8n: arrastra el fondo para moverte, rueda para
 * desplazarte, Ctrl/⌘ + rueda o pellizco para acercar. Teclas: 1 ajusta, 0 al 100 %, + y −.
 */
export function FlowCanvas({ width, height, fitKey, children, overlay, handle, focus }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; }, [view]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; view: View; distance?: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    setView(current => {
      const k = clamp(current.k * factor);
      return { k, x: px - (px - current.x) * (k / current.k), y: py - (py - current.y) * (k / current.k) };
    });
  }, []);
  const fit = useCallback(() => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const k = clamp(Math.min((rect.width - 80) / width, (rect.height - 120) / height, 1));
    if (k < 0.55 && focus) {
      const readable = 0.6;
      setView({ k: readable, x: 12 - (focus.x - 20) * readable, y: rect.height / 2 - focus.y * readable });
      return;
    }
    setView({ k, x: Math.max(24, (rect.width - width * k) / 2), y: Math.max(24, (rect.height - height * k) / 2 - 10) });
  }, [width, height, focus]);
  useImperativeHandle(handle, () => ({
    fit,
    centerOn: (x, y) => {
      const rect = viewport.current?.getBoundingClientRect();
      if (!rect) return;
      setView(current => ({ ...current, x: rect.width / 2 - x * current.k, y: rect.height / 2 - y * current.k }));
    },
    // Convierte coordenadas de pantalla a coordenadas del lienzo (para arrastrar conexiones).
    toWorld: (clientX, clientY) => {
      const rect = viewport.current?.getBoundingClientRect();
      const current = viewRef.current;
      return { x: (clientX - (rect?.left || 0) - current.x) / current.k, y: (clientY - (rect?.top || 0) - current.y) / current.k };
    },
  }), [fit]);

  // Ajusta al abrir y cuando el lienzo cambia de tamaño por primera vez.
  const fittedFor = useRef("");
  useEffect(() => {
    if (fittedFor.current === fitKey) return;
    const frame = requestAnimationFrame(() => { fit(); fittedFor.current = fitKey; });
    return () => cancelAnimationFrame(frame);
  }, [fitKey, fit]);

  // La rueda debe registrarse como no pasiva para poder evitar el desplazamiento de la página.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) zoomAt(Math.exp(-event.deltaY * 0.0022), event.clientX - rect.left, event.clientY - rect.top);
      else setView(current => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "1") fit();
      else if (event.key === "0") setView(current => ({ ...current, k: 1 }));
      else if (event.key === "+" || event.key === "=") zoomAt(1.2);
      else if (event.key === "-") zoomAt(1 / 1.2);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fit, zoomAt]);

  const startGesture = () => {
    const points = [...pointers.current.values()];
    if (!points.length) { gesture.current = null; setPanning(false); return; }
    const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    gesture.current = { ...center, view: viewRef.current, distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : undefined };
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Solo el fondo mueve el lienzo; tarjetas y botones reciben su clic.
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-canvas-item], button, a, input, textarea, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setPanning(true);
    startGesture();
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const start = gesture.current;
    const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    let k = start.view.k;
    if (points.length > 1 && start.distance) k = clamp(start.view.k * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / start.distance);
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = start.x - rect.left;
    const sy = start.y - rect.top;
    setView({
      k,
      x: center.x - rect.left - (sx - start.view.x) * (k / start.view.k),
      y: center.y - rect.top - (sy - start.view.y) * (k / start.view.k),
    });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    startGesture();
  };

  const grid = 22 * view.k;
  return <div
    ref={viewport}
    className={`flow-canvas-viewport${panning ? " is-panning" : ""}`}
    style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
  >
    <div className="flow-canvas-world" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
      {children}
    </div>
    {overlay}
    <div className="flow-canvas-zoom" role="toolbar" aria-label="Vista del lienzo">
      <button type="button" onClick={fit} title="Ajustar a la vista (1)" aria-label="Ajustar a la vista">⤢</button>
      <button type="button" onClick={() => zoomAt(1.2)} title="Acercar (+)" aria-label="Acercar">＋</button>
      <button type="button" onClick={() => zoomAt(1 / 1.2)} title="Alejar (−)" aria-label="Alejar">－</button>
      <button type="button" className="flow-canvas-zoom-value" onClick={() => setView(current => ({ ...current, k: 1 }))} title="Tamaño real (0)">{Math.round(view.k * 100)} %</button>
    </div>
  </div>;
}
