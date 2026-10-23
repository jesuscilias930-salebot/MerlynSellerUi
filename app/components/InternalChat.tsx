"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { request } from "../lib/api";
import type { InternalMessage } from "../lib/reminders";
import { ChatIcon } from "./ChatIcon";
import { ReminderForm, ReminderLinks } from "./RemindersPanel";

export const INTERNAL_CHAT_EVENT = "merlyn:internal-chat";
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const date = new Date(iso), today = new Date();
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  return diff === 0 ? "Hoy" : diff === 1 ? "Ayer" : date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
};

/** Mensajes sin leer del chat interno: al abrir, cada minuto y con cada aviso en tiempo real. */
export function useInternalUnread(paused: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (paused) return;
    let active = true;
    const refresh = () => { request<{ unread: number }>("/internal-chat/unread").then(data => { if (active) setUnread(data.unread || 0); }).catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(INTERNAL_CHAT_EVENT, refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener(INTERNAL_CHAT_EVENT, refresh); };
  }, [paused]);
  return [paused ? 0 : unread, setUnread] as const;
}

/** Chat fijo «Recordatorios» al inicio de la lista del inbox. */
export function InternalChatRow({ active, unread, onOpen }: { active: boolean; unread: number; onOpen: () => void }) {
  return <button type="button" className={`row internal-chat-row${active ? " active" : ""}${unread ? " has-unread" : ""}`} aria-current={active ? "true" : undefined} onClick={onOpen}>
    <b className="internal-chat-avatar" aria-hidden="true">⏰</b>
    <span className="inbox-contact-copy"><strong>Recordatorios</strong><small>Chat interno · no se envía a WhatsApp</small></span>
    <span className="inbox-row-meta">{unread > 0 && <b className="unread-badge" aria-label={`${unread} avisos sin leer`}>{unread > 99 ? "99+" : unread}</b>}</span>
  </button>;
}

/** Chat interno de apoyo: avisos de recordatorios (con botones a WhatsApp) y notas del equipo. */
export function InternalChatPanel({ onMobileBack }: { onMobileBack?: () => void }) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await request<{ messages: InternalMessage[]; hasMore: boolean }>("/internal-chat/messages");
      setMessages(data.messages || []); setHasMore(Boolean(data.hasMore)); setError("");
      if ((data.messages || []).some(message => !message.readAt)) {
        await request("/internal-chat/read", { method: "POST" });
        window.dispatchEvent(new Event(INTERNAL_CHAT_EVENT));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el chat interno."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => { void load(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("merlyn:internal-chat-updated", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("merlyn:internal-chat-updated", refresh); };
  }, [load]);
  useEffect(() => {
    if (stickToBottom.current) thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [messages]);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    try {
      const data = await request<{ messages: InternalMessage[]; hasMore: boolean }>(`/internal-chat/messages?before=${encodeURIComponent(first.createdAt)}`);
      stickToBottom.current = false;
      setMessages(current => [...(data.messages || []), ...current]); setHasMore(Boolean(data.hasMore));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar más mensajes."); }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true); setError("");
    try {
      const message = await request<InternalMessage>("/internal-chat/messages", { method: "POST", body: JSON.stringify({ body }) });
      stickToBottom.current = true;
      setMessages(current => [...current, message]); setDraft("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la nota."); }
    finally { setSending(false); }
  };
  const markDone = async (message: InternalMessage) => {
    if (!message.reminderId) return;
    try {
      await request(`/reminders/${message.reminderId}/status`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
      setMessages(current => current.map(item => item.reminderId === message.reminderId ? { ...item, reminderStatus: "done" } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo marcar como hecho."); }
  };

  return <section className="panel compact-chat-panel internal-chat-panel">
    <header className="chat-header">
      {onMobileBack && <button className="mobile-chat-control" type="button" aria-label="Volver a conversaciones" onClick={onMobileBack}><ChatIcon name="back" /></button>}
      <b className="avatar internal-chat-avatar" aria-hidden="true">⏰</b>
      <div className="chat-title"><h2>Recordatorios</h2><small>Chat interno de apoyo · no está conectado a WhatsApp</small></div>
      <button type="button" className="inbox-icon-button inbox-tools-trigger" onClick={() => setCreating(true)}>＋ <span>Nuevo recordatorio</span></button>
    </header>
    {error && <p className="inbox-chat-notice" role="alert">{error}<button type="button" aria-label="Cerrar aviso" onClick={() => setError("")}><ChatIcon name="close" /></button></p>}
    <div className="thread" ref={thread} role="log" aria-label="Mensajes internos" aria-live="polite"
      onScroll={event => { const el = event.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {hasMore && <button type="button" className="internal-chat-more" onClick={() => void loadOlder()}>Ver mensajes anteriores</button>}
      {loading && !messages.length && <div className="inbox-thread-empty"><p>Cargando…</p></div>}
      {!loading && !messages.length && <div className="inbox-thread-empty"><p>Aquí llegan tus recordatorios</p><small>Crea uno en WhatsApp → Recordatorios o con «Nuevo recordatorio». También puedes dejar notas para tu equipo.</small></div>}
      {messages.map((message, index) => <div key={message.id} className="internal-chat-item">
        {(index === 0 || dayKey(message.createdAt) !== dayKey(messages[index - 1].createdAt)) && <div className="inbox-day-separator"><span>{dayLabel(message.createdAt)}</span></div>}
        {message.kind === "reminder" ? <article className={`inbound internal-reminder${message.reminderStatus === "done" ? " done" : ""}`}>
          <p>{message.body}</p>
          {message.payload?.phone && <div className="internal-reminder-actions">
            <ReminderLinks contactName={message.payload.contactName} phone={message.payload.phone} products={message.payload.products} />
            {message.reminderId && message.reminderStatus === "scheduled" && <button type="button" className="reminder-link subtle" onClick={() => void markDone(message)}>✓ Marcar hecho</button>}
            {message.reminderStatus === "done" && <span className="internal-reminder-done">✓ Hecho</span>}
          </div>}
          <div className="message-meta"><small><time dateTime={message.createdAt}>{time(message.createdAt)}</time></small></div>
        </article> : <article className="outbound internal-note">
          <p>{message.body}</p>
          <div className="message-meta"><small>{message.authorName || message.authorEmail?.split("@")[0] || "Nota"} · <time dateTime={message.createdAt}>{time(message.createdAt)}</time></small></div>
        </article>}
      </div>)}
    </div>
    <div className="chat-compose-area">
      <form className="internal-composer" onSubmit={event => void send(event)}>
        <textarea aria-label="Nota interna" rows={1} maxLength={4000} value={draft} placeholder="Escribe una nota interna (no se envía a WhatsApp)…" onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <button className="send" aria-label="Guardar nota" disabled={sending || !draft.trim()}><ChatIcon name="send" /></button>
      </form>
    </div>
    {creating && <ReminderForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); window.dispatchEvent(new Event("merlyn:internal-chat-updated")); window.dispatchEvent(new Event(INTERNAL_CHAT_EVENT)); }} />}
  </section>;
}
