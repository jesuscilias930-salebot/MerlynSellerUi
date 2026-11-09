"use client";

import { useEffect, useState } from "react";
import { controlRequest, controlSession } from "../lib/control-api";
import type { ShippingBundle } from "../lib/shipping-package";

// Los bundles cambian poco: se comparten entre el selector del chat, el cotizador y los escenarios.
let cache: { at: number; bundles: ShippingBundle[] } | null = null;
const TTL_MS = 60_000;

export function useControlBundles(enabled = true) {
  const [bundles, setBundles] = useState<ShippingBundle[]>(() => cache?.bundles || []);
  const [loading, setLoading] = useState(enabled && !cache);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const fresh = cache && Date.now() - cache.at < TTL_MS && !revision ? cache.bundles : null;
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      if (fresh) return fresh;
      setLoading(true); setError("");
      if (!controlSession.get()) throw new Error("Inicia sesión en Control de ventas para ver los bundles.");
      return controlRequest<ShippingBundle[]>("/bundles", { signal: controller.signal, cache: "no-store" });
    }).then(data => {
      if (controller.signal.aborted || data === null) return;
      if (!Array.isArray(data)) throw new Error("La lista de bundles no es válida.");
      if (data !== fresh) cache = { at: Date.now(), bundles: data };
      setBundles(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No fue posible cargar los bundles."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, revision]);
  return { bundles, loading, error, retry: () => setRevision(value => value + 1) };
}
