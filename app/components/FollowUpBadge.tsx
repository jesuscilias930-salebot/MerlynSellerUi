"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { followUpStatusLabel, type FollowUpStatus } from "../lib/follow-ups";

/** Estado del seguimiento automático del chat, con botón para detenerlo. */
export function FollowUpBadge({ conversationId, refreshKey }: { conversationId: string; refreshKey: string }) {
  const [status, setStatus] = useState<FollowUpStatus | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request<FollowUpStatus>(`/follow-ups/conversations/${conversationId}`).then(next => { if (active) { setStatus(next); setNow(Date.now()); } }).catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, [conversationId, refreshKey]);
  const label = status && now ? followUpStatusLabel(status, now) : null;
  if (!status?.enabled || !label) return null;
  const stop = async () => {
    setBusy(true);
    try { setStatus(await request<FollowUpStatus>(`/follow-ups/conversations/${conversationId}/stop`, { method: "POST" })); setNow(Date.now()); }
    catch { /* el aviso queda igual */ }
    finally { setBusy(false); }
  };
  return <div className={`follow-up-badge ${status.status}`} role="status">
    <span>⏱ {label}</span>
    {status.status === "active" && !status.waitingForCustomer && <button type="button" disabled={busy} onClick={() => void stop()}>{busy ? "Deteniendo…" : "Detener"}</button>}
  </div>;
}
