'use client';
import { createClient } from '@supabase/supabase-js';
import { FormEvent, useEffect, useState } from 'react';

type Chat = { id: string; phone_number: string; name: string | null; last_message: string | null; updated_at: string };
type Message = { id: string; direction: 'inbound' | 'outbound'; body: string | null; type: string; status: string; created_at: string };
const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'No fue posible completar la solicitud.'); }
  return response.status === 204 ? undefined as T : response.json();
}

export default function Home() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]); const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [draft, setDraft] = useState(''); const [number, setNumber] = useState('');
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const loadChats = async () => setChats(await request<Chat[]>('/conversations'));
  const open = async (item: Chat) => { setChat(item); setMessages(await request<Message[]>(`/conversations/${item.id}/messages`)); };
  useEffect(() => { request<{ user: { email: string; role: string } }>('/auth/me').then(async s => { setUser(s.user); await loadChats(); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!user) return;
    const stream = new EventSource(`${api}/realtime/events`, { withCredentials: true });
    const refresh = async () => {
      try {
        await loadChats();
        if (chat) await open(chat);
      } catch { setNotice('No fue posible actualizar las conversaciones.'); }
    };
    stream.addEventListener('conversation.updated', refresh);
    return () => stream.close();
  }, [user, chat?.id]);
  const login = async (event: FormEvent) => { event.preventDefault(); if (!supabase) return setNotice('Falta configurar Supabase en .env.local.'); setBusy(true); setNotice(''); try { const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error || !data.session) throw new Error(error?.message || 'No se pudo iniciar sesión.'); const s = await request<{ user: { email: string; role: string } }>('/auth/session', { method: 'POST', body: JSON.stringify({ accessToken: data.session.access_token }) }); await supabase.auth.signOut(); setUser(s.user); await loadChats(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Error al iniciar sesión.'); } finally { setBusy(false); } };
  const create = async (event: FormEvent) => { event.preventDefault(); try { const item = await request<Chat>('/conversations', { method: 'POST', body: JSON.stringify({ phoneNumber: number }) }); setNumber(''); await loadChats(); await open(item); } catch (e) { setNotice(e instanceof Error ? e.message : 'No se pudo crear el chat.'); } };
  const send = async (event: FormEvent) => { event.preventDefault(); if (!chat || !draft.trim()) return; try { await request(`/conversations/${chat.id}/messages/text`, { method: 'POST', body: JSON.stringify({ body: draft }) }); setDraft(''); await open(chat); await loadChats(); } catch (e) { setNotice(e instanceof Error ? e.message : 'No se pudo enviar.'); } };
  const logout = async () => { await request('/auth/session', { method: 'DELETE' }); setUser(null); setChats([]); setChat(null); };
  if (!user) return <main className="login"><section><b className="mark">M</b><p>MERLYN SALES</p><h1>Conversaciones que se convierten en ventas.</h1><span>Inicia sesión para atender WhatsApp desde un solo lugar.</span><form onSubmit={login}><label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@empresa.com" /></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" /></label><button disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button></form>{notice && <i>{notice}</i>}</section></main>;
  return <main className="shell"><aside><div className="brand"><b className="mark">M</b><strong>Merlyn Sales</strong></div><nav><button className="selected">◉ Inbox</button><button>◌ Contactos</button><button>▤ Plantillas</button></nav><div className="profile"><b>{user.email[0].toUpperCase()}</b><span>{user.email}<small>{user.role}</small></span><button onClick={logout}>↪</button></div></aside><section className="list"><header><div><p>BANDEJA</p><h2>Conversaciones</h2></div><b>＋</b></header><form onSubmit={create}><input value={number} onChange={e => setNumber(e.target.value)} placeholder="Número con código de país" /><button>Nuevo</button></form><div className="rows">{chats.length === 0 && <em>Aún no hay conversaciones.</em>}{chats.map(item => <button onClick={() => open(item)} className={item.id === chat?.id ? 'row active' : 'row'} key={item.id}><b>{(item.name || item.phone_number)[0]}</b><span><strong>{item.name || item.phone_number}</strong><small>{item.last_message || 'Sin mensajes aún'}</small></span></button>)}</div></section><section className="panel"><header><b className="avatar">{chat ? (chat.name || chat.phone_number)[0] : 'M'}</b><div><h2>{chat ? chat.name || chat.phone_number : 'Tu bandeja está lista'}</h2><small>{chat?.phone_number || 'Selecciona un chat para comenzar'}</small></div></header><div className="thread">{!chat && <div className="empty"><b className="mark">M</b><h2>Atiende desde un solo lugar</h2><p>Crea una conversación o espera un mensaje entrante.</p></div>}{messages.map(message => <article className={message.direction} key={message.id}><p>{message.body || `[${message.type}]`}</p><small>{new Date(message.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {message.status}</small></article>)}</div><form className="composer" onSubmit={send}><button type="button">⌕</button><textarea disabled={!chat} value={draft} onChange={e => setDraft(e.target.value)} placeholder={chat ? 'Escribe un mensaje…' : 'Selecciona una conversación'} /><button disabled={!chat || !draft.trim()} className="send">↑</button></form>{notice && <div className="toast">{notice}<button onClick={() => setNotice('')}>×</button></div>}</section></main>;
}
