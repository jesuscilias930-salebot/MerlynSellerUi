"use client";

import { createClient } from "@supabase/supabase-js";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";

type Chat = {
  id: string;
  phone_number: string;
  name: string | null;
  last_message: string | null;
  updated_at: string;
};
type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  type: string;
  status: string;
  created_at: string;
};
type LeadColumn = { id: string; name: string; position: number; leads: Chat[] };

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const initials = (value: string) => value
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No fue posible completar la solicitud.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [view, setView] = useState<"inbox" | "pipeline" | "remarketing">("inbox");
  const [chats, setChats] = useState<Chat[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pipeline, setPipeline] = useState<LeadColumn[]>([]);
  const [draft, setDraft] = useState("");
  const [number, setNumber] = useState("");
  const [columnName, setColumnName] = useState("");
  const [remarketingColumnId, setRemarketingColumnId] = useState("");
  const [remarketingBody, setRemarketingBody] = useState("");
  const [remarketingImage, setRemarketingImage] = useState<{ mediaId: string; filename: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  const loadChats = async () => setChats(await request<Chat[]>("/conversations"));
  const loadPipeline = async () => {
    const columns = await request<LeadColumn[]>("/leads/board");
    setPipeline(columns);
    setRemarketingColumnId((current) => {
      if (columns.some((column) => column.id === current)) return current;
      const remarketing = columns.find((column) => column.name.toLocaleLowerCase("es-MX").replace(/[^a-z]/g, "") === "remarketing");
      return remarketing?.id || columns[0]?.id || "";
    });
  };
  const open = async (item: Chat) => {
    setChat(item);
    setMessages(await request<Message[]>(`/conversations/${item.id}/messages`));
  };
  const openLead = async (lead: Chat) => {
    setView("inbox");
    await open(lead);
  };
  const canEditPipeline = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    request<{ user: { email: string; role: string } }>("/auth/me")
      .then(async (session) => {
        setUser(session.user);
        await Promise.all([loadChats(), loadPipeline()]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    const stream = new EventSource(`${api}/realtime/events`, { withCredentials: true });
    const refresh = async () => {
      try {
        await Promise.all([loadChats(), loadPipeline()]);
        if (chat) await open(chat);
      } catch {
        setNotice("No fue posible actualizar los leads y conversaciones.");
      }
    };
    stream.addEventListener("conversation.updated", refresh);
    return () => stream.close();
  }, [user, chat?.id]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setNotice("Falta configurar Supabase en .env.local.");
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message || "No se pudo iniciar sesión.");
      const session = await request<{ user: { email: string; role: string } }>("/auth/session", {
        method: "POST",
        body: JSON.stringify({ accessToken: data.session.access_token }),
      });
      await supabase.auth.signOut();
      setUser(session.user);
      await Promise.all([loadChats(), loadPipeline()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Error al iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const item = await request<Chat>("/conversations", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: number }),
      });
      setNumber("");
      await Promise.all([loadChats(), loadPipeline()]);
      await open(item);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear el chat.");
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!chat || !draft.trim()) return;
    try {
      await request(`/conversations/${chat.id}/messages/text`, {
        method: "POST",
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      await Promise.all([open(chat), loadChats(), loadPipeline()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar.");
    }
  };

  const addColumn = async (event: FormEvent) => {
    event.preventDefault();
    if (!columnName.trim()) return;
    try {
      await request("/leads/columns", { method: "POST", body: JSON.stringify({ name: columnName }) });
      setColumnName("");
      await loadPipeline();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo agregar la columna.");
    }
  };

  const removeColumn = async (column: LeadColumn) => {
    if (!window.confirm(`Se eliminará “${column.name}”. Sus leads pasarán a otra columna.`)) return;
    try {
      await request(`/leads/columns/${column.id}`, { method: "DELETE" });
      await loadPipeline();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar la columna.");
    }
  };

  const moveLead = async (conversationId: string, columnId: string) => {
    try {
      await request(`/leads/${conversationId}/column`, { method: "PATCH", body: JSON.stringify({ columnId }) });
      await Promise.all([loadPipeline(), loadChats()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo mover el lead.");
    }
  };

  const dropLead = async (event: DragEvent<HTMLElement>, columnId: string) => {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/merlynsales-conversation") || draggingLeadId;
    setDraggingLeadId(null);
    if (leadId) await moveLead(leadId, columnId);
  };

  const uploadRemarketingImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice("Selecciona una imagen JPEG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice("La imagen no puede superar 5 MB.");
      return;
    }
    setUploadingImage(true);
    try {
      const response = await fetch(`${api}/remarketing/images`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No fue posible cargar la imagen.");
      setRemarketingImage(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible cargar la imagen.");
    } finally {
      setUploadingImage(false);
    }
  };

  const sendRemarketing = async (event: FormEvent) => {
    event.preventDefault();
    if (!remarketingColumnId || (!remarketingBody.trim() && !remarketingImage)) return;
    try {
      const result = await request<{ queued: number; skipped: number }>("/remarketing/campaigns", {
        method: "POST",
        body: JSON.stringify({
          columnId: remarketingColumnId,
          body: remarketingBody.trim() || undefined,
          mediaId: remarketingImage?.mediaId,
          filename: remarketingImage?.filename,
        }),
      });
      setNotice(`Campaña encolada para ${result.queued} leads.${result.skipped ? ` ${result.skipped} quedaron fuera de la ventana de 24 horas.` : ""}`);
      setRemarketingBody("");
      setRemarketingImage(null);
      await Promise.all([loadChats(), loadPipeline()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar la campaña.");
    }
  };

  const logout = async () => {
    await request("/auth/session", { method: "DELETE" });
    setUser(null);
    setChats([]);
    setChat(null);
    setMessages([]);
    setPipeline([]);
  };

  if (!user) return (
    <main className="login">
      <section>
        <b className="mark">M</b><p>MERLYN SALES</p><h1>Conversaciones que se convierten en ventas.</h1>
        <span>Inicia sesión para atender WhatsApp desde un solo lugar.</span>
        <form onSubmit={login}>
          <label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="tu@empresa.com" /></label>
          <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" /></label>
          <button disabled={busy}>{busy ? "Ingresando…" : "Iniciar sesión"}</button>
        </form>
        {notice && <i>{notice}</i>}
      </section>
    </main>
  );

  return (
    <main className={view === "inbox" ? "shell" : "shell pipeline-mode"}>
      <aside>
        <div className="brand"><b className="mark">M</b><strong>Merlyn Sales</strong></div>
        <nav>
          <button className={view === "inbox" ? "selected" : ""} onClick={() => setView("inbox")}>◉ Inbox</button>
          <button className={view === "pipeline" ? "selected" : ""} onClick={() => setView("pipeline")}>▦ Leads</button>
          <button className={view === "remarketing" ? "selected" : ""} onClick={() => setView("remarketing")}>↗ Remarketing</button>
          <button disabled>◌ Contactos</button><button disabled>▤ Plantillas</button>
        </nav>
        <div className="profile"><b>{user.email[0].toUpperCase()}</b><span>{user.email}<small>{user.role}</small></span><button onClick={logout} aria-label="Cerrar sesión">↪</button></div>
      </aside>

      {view === "pipeline" ? (
        <section className="pipeline" aria-label="Tablero de leads">
          <header className="pipeline-header">
            <div><p>PIPELINE COMERCIAL</p><h1>Leads</h1><span>Arrastra una tarjeta para actualizar su proceso comercial.</span></div>
            {canEditPipeline && <form onSubmit={addColumn} className="add-column"><input value={columnName} onChange={(event) => setColumnName(event.target.value)} maxLength={80} placeholder="Nueva columna" /><button>Agregar columna</button></form>}
          </header>
          <div className="kanban" role="list">
            {pipeline.map((column) => (
              <section className="lead-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropLead(event, column.id)}>
                <header><div><h2>{column.name}</h2><span>{column.leads.length} {column.leads.length === 1 ? "lead" : "leads"}</span></div>{canEditPipeline && <button className="remove-column" onClick={() => removeColumn(column)} aria-label={`Eliminar ${column.name}`}>×</button>}</header>
                <div className="lead-stack">
                  {column.leads.map((lead) => (
                    <button className={draggingLeadId === lead.id ? "lead-card dragging" : "lead-card"} key={lead.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/merlynsales-conversation", lead.id); setDraggingLeadId(lead.id); }} onDragEnd={() => setDraggingLeadId(null)} onClick={() => openLead(lead)}>
                      <span className="lead-avatar" aria-hidden="true">{initials(lead.name || lead.phone_number)}</span>
                      <span><strong>{lead.name || lead.phone_number}</strong><small>{lead.phone_number}</small><em>{lead.last_message || "Sin mensajes aún"}</em></span>
                    </button>
                  ))}
                  {column.leads.length === 0 && <p className="empty-column">Arrastra leads aquí</p>}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : view === "remarketing" ? (
        <section className="remarketing" aria-label="Campaña de remarketing">
          <header className="remarketing-header"><div><p>CAMPAÑAS</p><h1>Remarketing</h1><span>Envía una imagen, un mensaje o ambos a los leads con una conversación abierta.</span></div></header>
          <form className="remarketing-form" onSubmit={sendRemarketing}>
            <label>Columna de destinatarios<select value={remarketingColumnId} onChange={(event) => setRemarketingColumnId(event.target.value)}>{pipeline.map((column) => <option key={column.id} value={column.id}>{column.name} · {column.leads.length} leads</option>)}</select></label>
            <label>Mensaje personalizado <span className="optional">Opcional si cargas una imagen</span><textarea value={remarketingBody} onChange={(event) => setRemarketingBody(event.target.value)} maxLength={remarketingImage ? 1024 : 4096} placeholder="Hola, tenemos información que puede interesarte…" /></label>
            <div className="image-picker"><div><strong>Imagen</strong><span>JPEG, PNG o WebP · máximo 5 MB</span></div>{remarketingImage ? <div className="image-ready"><span>✓ {remarketingImage.filename}</span><button type="button" onClick={() => setRemarketingImage(null)}>Quitar</button></div> : <label className="upload-button">{uploadingImage ? "Cargando…" : "Seleccionar fotografía"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadRemarketingImage} disabled={uploadingImage} /></label>}</div>
            <div className="remarketing-rule">Solo se enviará a leads cuyo último mensaje entrante fue hace menos de 24 horas. Para los demás necesitas una plantilla aprobada por Meta.</div>
            <button className="launch-campaign" disabled={uploadingImage || !remarketingColumnId || (!remarketingBody.trim() && !remarketingImage)}>Enviar a los leads elegibles</button>
          </form>
        </section>
      ) : <>
        <section className="list">
          <header><div><p>BANDEJA</p><h2>Conversaciones</h2></div><b>＋</b></header>
          <form onSubmit={create}><input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Número con código de país" /><button>Nuevo</button></form>
          <div className="rows">{chats.length === 0 && <em>Aún no hay conversaciones.</em>}{chats.map((item) => <button onClick={() => open(item)} className={item.id === chat?.id ? "row active" : "row"} key={item.id}><b>{initials(item.name || item.phone_number)}</b><span><strong>{item.name || item.phone_number}</strong><small>{item.phone_number} · {item.last_message || "Sin mensajes aún"}</small></span></button>)}</div>
        </section>
        <section className="panel">
          <header><b className="avatar">{chat ? initials(chat.name || chat.phone_number) : "M"}</b><div><h2>{chat ? chat.name || chat.phone_number : "Tu bandeja está lista"}</h2><small>{chat?.phone_number || "Selecciona un chat para comenzar"}</small></div></header>
          <div className="thread">{!chat && <div className="empty"><b className="mark">M</b><h2>Atiende desde un solo lugar</h2><p>Crea una conversación o espera un mensaje entrante.</p></div>}{messages.map((message) => <article className={message.direction} key={message.id}><p>{message.body || `[${message.type}]`}</p><small>{new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {message.status}</small></article>)}</div>
          <form className="composer" onSubmit={send}><button type="button">⌕</button><textarea disabled={!chat} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={chat ? "Escribe un mensaje…" : "Selecciona una conversación"} /><button disabled={!chat || !draft.trim()} className="send">↑</button></form>
        </section>
      </>}
      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    </main>
  );
}
