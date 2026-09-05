"use client";

import { createClient } from "@supabase/supabase-js";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api, request } from "./lib/api";
import type { AutomationIntent, AutomationScenario, Chat, ConversationFilter, DocumentOption, DocumentTemplate, EntrepreneurPackage, LeadColumn, Message, QuickReply, RemarketingPreset, SavedSticker, User } from "./lib/types";
import { AutomationsPanel } from "./components/AutomationsPanel";
import { DocumentTemplatesPanel } from "./components/DocumentTemplatesPanel";
import { ConversationModal } from "./components/ConversationModal";
import { Inbox } from "./components/Inbox";
import { LeadBoard } from "./components/LeadBoard";
import { LoginScreen } from "./components/LoginScreen";
import { RemarketingPanel } from "./components/RemarketingPanel";
import { Sidebar } from "./components/Sidebar";
import { ScenariosPanel } from "./components/ScenariosPanel";
import { ControlPanel } from "./components/ControlPanel";
import { EntrepreneurPackagesPanel } from "./components/EntrepreneurPackagesPanel";
import { QuickRepliesPanel } from "./components/QuickRepliesPanel";
import { StickersPanel } from "./components/StickersPanel";

type View = "inbox" | "pipeline" | "remarketing" | "automations" | "scenarios" | "control";
type ControlTab = "summary" | "customers" | "categories" | "inventory" | "prices" | "bundles" | "sales" | "purchases" | "reports";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("inbox");
  const [controlTab, setControlTab] = useState<ControlTab>("summary");
  const [chats, setChats] = useState<Chat[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [modalChat, setModalChat] = useState<Chat | null>(null);
  const [modalMessages, setModalMessages] = useState<Message[]>([]);
  const [pipeline, setPipeline] = useState<LeadColumn[]>([]);
  const [draft, setDraft] = useState("");
  const [modalDraft, setModalDraft] = useState("");
  const [number, setNumber] = useState("");
  const [columnName, setColumnName] = useState("");
  const [remarketingColumnId, setRemarketingColumnId] = useState("");
  const [remarketingBody, setRemarketingBody] = useState("");
  const [remarketingImage, setRemarketingImage] = useState<{
    mediaId: string;
    filename: string;
  } | null>(null);
  const [presets, setPresets] = useState<RemarketingPreset[]>([]);
  const [automationIntents, setAutomationIntents] = useState<AutomationIntent[]>([]);
  const [automationScenarios, setAutomationScenarios] = useState<AutomationScenario[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [stickers, setStickers] = useState<SavedSticker[]>([]);
  const [presetName, setPresetName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [entrepreneurPackages, setEntrepreneurPackages] = useState<EntrepreneurPackage[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentCaption, setDocumentCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<ConversationFilter>("all");
  const [dashboardFilter, setDashboardFilter] = useState<ConversationFilter>("all");
  const soundContext = useRef<AudioContext | null>(null);

  const loadChats = async () =>
    setChats(await request<Chat[]>("/conversations"));
  const loadMessages = (item: Chat) =>
    request<Message[]>(`/conversations/${item.id}/messages`);
  const loadDocumentOptions = async (item: Chat, selectLatest = false) => {
    const options = await request<DocumentOption[]>(`/conversations/${item.id}/document-options`);
    setDocumentOptions(options);
    setSelectedDocumentId((current) => {
      const nextId = selectLatest || !options.some((option) => option.mediaId === current)
        ? options[0]?.mediaId || ""
        : current;
      setDocumentCaption(options.find((option) => option.mediaId === nextId)?.caption || "");
      return nextId;
    });
  };
  const loadPresets = async () =>
    setPresets(await request<RemarketingPreset[]>("/remarketing/presets"));
  const loadAutomations = async () => setAutomationIntents(await request<AutomationIntent[]>("/automations"));
  const loadQuickReplies = async () => setQuickReplies(await request<QuickReply[]>("/quick-replies"));
  const loadStickers = async () => setStickers(await request<SavedSticker[]>("/settings/stickers"));
  const loadScenarios = async () => setAutomationScenarios(await request<AutomationScenario[]>("/scenarios"));
  const loadDocumentTemplates = async () => setDocumentTemplates(await request<DocumentTemplate[]>("/settings/document-templates"));
  const loadEntrepreneurPackages = async () => setEntrepreneurPackages(await request<EntrepreneurPackage[]>("/settings/entrepreneur-packages"));
  const loadPipeline = async () => {
    const columns = await request<LeadColumn[]>("/leads/board");
    setPipeline(columns);
    setRemarketingColumnId((current) => {
      if (columns.some((column) => column.id === current)) return current;
      const remarketing = columns.find(
        (column) =>
          column.name.toLocaleLowerCase("es-MX").replace(/[^a-z]/g, "") ===
          "remarketing",
      );
      return remarketing?.id || columns[0]?.id || "";
    });
  };
  const openInbox = async (item: Chat) => {
    setMessages([]);
    setChat(item);
    setReplyToMessage(null);
    const [nextMessages] = await Promise.all([loadMessages(item), loadDocumentOptions(item), request(`/conversations/${item.id}/read`, { method: "POST" })]);
    setMessages(nextMessages);
    await Promise.all([loadChats(), loadPipeline()]);
  };
  const openModal = async (item: Chat) => {
    setModalMessages([]);
    setModalChat(item);
    setReplyToMessage(null);
    setModalDraft("");
    const [nextMessages] = await Promise.all([loadMessages(item), loadDocumentOptions(item), request(`/conversations/${item.id}/read`, { method: "POST" })]);
    setModalMessages(nextMessages);
    await Promise.all([loadChats(), loadPipeline()]);
  };
  const refreshData = async () => {
    await Promise.all([loadChats(), loadPipeline(), loadPresets(), loadAutomations(), loadQuickReplies(), loadStickers(), loadScenarios(), loadDocumentTemplates(), loadEntrepreneurPackages()]);
    if (chat) setMessages(await loadMessages(chat));
    if (modalChat) setModalMessages(await loadMessages(modalChat));
  };
  const canEditPipeline = user?.role === "owner" || user?.role === "admin";
  const setAutoReply = async (target: Chat | null, enabled: boolean) => {
    if (!target) return;
    try {
      await request(`/conversations/${target.id}/automation`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      setChats((items) => items.map((item) => item.id === target.id ? { ...item, autoReplyEnabled: enabled } : item));
      setPipeline((columns) => columns.map((column) => ({ ...column, leads: column.leads.map((lead) => lead.id === target.id ? { ...lead, autoReplyEnabled: enabled } : lead) })));
      if (chat?.id === target.id) setChat({ ...chat, autoReplyEnabled: enabled });
      if (modalChat?.id === target.id) setModalChat({ ...modalChat, autoReplyEnabled: enabled });
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible actualizar el bot."); }
  };
  const setScenarioEnabled = async (target: Chat | null, enabled: boolean) => {
    if (!target) return;
    try {
      await request(`/conversations/${target.id}/scenarios`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      const update = (item: Chat) => item.id === target.id ? { ...item, scenarioEnabled: enabled } : item;
      setChats((items) => items.map(update));
      setPipeline((columns) => columns.map((column) => ({ ...column, leads: column.leads.map(update) })));
      if (chat?.id === target.id) setChat({ ...chat, scenarioEnabled: enabled });
      if (modalChat?.id === target.id) setModalChat({ ...modalChat, scenarioEnabled: enabled });
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible actualizar los escenarios."); }
  };
  const deleteConversation = async (target: Chat | null) => {
    if (!target || !window.confirm(`¿Borrar la conversación de ${target.name || target.phone_number}? Esta acción elimina sus mensajes y el progreso de escenarios para poder hacer pruebas.`)) return;
    try {
      await request(`/conversations/${target.id}`, { method: "DELETE" });
      if (chat?.id === target.id) { setChat(null); setMessages([]); setDraft(""); }
      if (modalChat?.id === target.id) { setModalChat(null); setModalMessages([]); setModalDraft(""); }
      await Promise.all([loadChats(), loadPipeline()]);
      setNotice("Conversación eliminada. El próximo mensaje del número iniciará una prueba limpia.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible borrar la conversación."); }
  };
  const matchesFilter = (item: Chat, filter: ConversationFilter) => {
    if (filter === "unread") return item.unreadCount > 0;
    if (filter === "needs-response") return item.needsResponse === true;
    if (filter.startsWith("column:")) return item.leadColumnId === filter.slice("column:".length);
    return true;
  };
  const filteredChats = chats.filter((item) => matchesFilter(item, inboxFilter));
  const filteredPipeline = pipeline.map((column) => ({
    ...column,
    leads: column.leads.filter((lead) => matchesFilter(lead, dashboardFilter)),
  }));
  const playIncomingSound = () => {
    try {
      const BrowserAudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!BrowserAudioContext) return;
      const context = soundContext.current || new BrowserAudioContext();
      soundContext.current = context;
      context.resume().catch(() => undefined);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.23);
    } catch { /* Audio notifications can be blocked until a user interacts with the page. */ }
  };

  useEffect(() => {
    request<{ user: User }>("/auth/me")
      .then(async (session) => {
        setUser(session.user);
        await Promise.all([loadChats(), loadPipeline(), loadPresets(), loadAutomations(), loadQuickReplies(), loadStickers(), loadScenarios(), loadDocumentTemplates(), loadEntrepreneurPackages()]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    const stream = new EventSource(`${api}/realtime/events`, {
      withCredentials: true,
    });
    const refresh = () =>
      refreshData().catch(() =>
        setNotice("No fue posible actualizar los leads y conversaciones."),
      );
    const handleConversationUpdate = (event: Event) => {
      try {
        const update = JSON.parse((event as MessageEvent).data);
        if (update.type === "message.received") {
          playIncomingSound();
          const activeConversationId = chat?.id || modalChat?.id;
          if (activeConversationId === update.conversationId) {
            request(`/conversations/${activeConversationId}/read`, { method: "POST" })
              .then(refresh)
              .catch(refresh);
            return;
          }
        }
      } catch { /* Refresh still works if an unexpected event is received. */ }
      refresh();
    };
    stream.addEventListener("conversation.updated", handleConversationUpdate);
    return () => stream.close();
  }, [user, chat?.id, modalChat?.id]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setNotice("Falta configurar Supabase en .env.local.");
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session)
        throw new Error(error?.message || "No se pudo iniciar sesión.");
      const session = await request<{ user: User }>("/auth/session", {
        method: "POST",
        body: JSON.stringify({ accessToken: data.session.access_token }),
      });
      await supabase.auth.signOut();
      setUser(session.user);
      await Promise.all([loadChats(), loadPipeline(), loadPresets(), loadAutomations(), loadQuickReplies(), loadStickers(), loadScenarios(), loadDocumentTemplates(), loadEntrepreneurPackages()]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Error al iniciar sesión.",
      );
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
      await openInbox(item);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo crear el chat.",
      );
    }
  };

  const sendText = async (
    event: FormEvent,
    target: Chat | null,
    value: string,
    clear: () => void,
  ) => {
    event.preventDefault();
    if (!target || !value.trim()) return;
    try {
      await request(`/conversations/${target.id}/messages/text`, {
        method: "POST",
        body: JSON.stringify({ body: value, replyToMessageId: replyToMessage?.id || undefined }),
      });
      clear();
      setReplyToMessage(null);
      await refreshData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar.");
    }
  };

  const uploadAudio = async (
    target: Chat | null,
    audio: Blob,
    filename: string,
  ) => {
    if (!target) return;
    const rawContentType = audio.type.toLowerCase();
    const baseContentType = rawContentType.split(";", 1)[0];
    const contentType = baseContentType === "audio/x-m4a" ? "audio/mp4" : baseContentType;
    const allowedTypes = [
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "audio/opus",
      "audio/webm",
    ];
    if (!allowedTypes.includes(contentType))
      throw new Error("Selecciona un audio compatible.");
    if (audio.size > 16 * 1024 * 1024)
      throw new Error("El audio no puede superar 16 MB.");
    setUploadingAudio(true);
    try {
      const response = await fetch(
        `${api}/conversations/${target.id}/messages/audio`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": contentType,
            "X-Upload-Filename": encodeURIComponent(filename),
          },
          body: audio,
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "No fue posible enviar el audio.");
      await refreshData();
    } finally {
      setUploadingAudio(false);
    }
  };
  const uploadSelectedAudio =
    (target: Chat | null) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        await uploadAudio(target, file, file.name);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "No fue posible enviar el audio.",
        );
      }
    };

  const uploadMedia = async (target: Chat | null, type: "image" | "video" | "document", file: File) => {
    if (!target) return;
    const allowedTypes = type === "image" ? ["image/jpeg", "image/png", "image/webp"] : type === "document" ? ["application/pdf"] : ["video/mp4", "video/3gpp"];
    const maxSize = type === "image" ? 5 * 1024 * 1024 : type === "document" ? 25 * 1024 * 1024 : 16 * 1024 * 1024;
    const isPdf = type === "document" && /\.pdf$/i.test(file.name);
    if (!allowedTypes.includes(file.type) && !isPdf) throw new Error(type === "image" ? "Selecciona una imagen JPEG, PNG o WebP." : type === "document" ? "Selecciona un archivo PDF." : "Selecciona un video MP4 o 3GPP.");
    if (file.size > maxSize) throw new Error(type === "image" ? "La imagen no puede superar 5 MB." : type === "document" ? "El PDF no puede superar 25 MB." : "El video no puede superar 16 MB.");
    setUploadingMedia(true);
    try {
      const endpoint = type === "document" ? "document/upload" : type;
      const response = await fetch(`${api}/conversations/${target.id}/messages/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": isPdf ? "application/pdf" : file.type, "X-Upload-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `No fue posible enviar el ${type === "document" ? "PDF" : type === "image" ? "archivo" : "video"}.`);
      await refreshData();
      if (type === "document") await loadDocumentOptions(target, true);
    } finally { setUploadingMedia(false); }
  };
  const uploadSelectedMedia = (target: Chat | null, type: "image" | "video" | "document") => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { await uploadMedia(target, type, file); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el archivo."); }
  };
  const sendDocument = async (target: Chat | null) => {
    const document = documentOptions.find((option) => option.mediaId === selectedDocumentId);
    if (!target || !document) return;
    setUploadingMedia(true);
    try {
      await request(`/conversations/${target.id}/messages/document`, {
        method: "POST",
        body: JSON.stringify({ mediaId: document.mediaId, filename: document.filename, caption: documentCaption.trim() || undefined }),
      });
      await refreshData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el catálogo."); } finally { setUploadingMedia(false); }
  };

  const addColumn = async (event: FormEvent) => {
    event.preventDefault();
    if (!columnName.trim()) return;
    try {
      await request("/leads/columns", {
        method: "POST",
        body: JSON.stringify({ name: columnName }),
      });
      setColumnName("");
      await loadPipeline();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo agregar la columna.",
      );
    }
  };
  const removeColumn = async (column: LeadColumn) => {
    if (
      !window.confirm(
        `Se eliminará “${column.name}”. Sus leads pasarán a otra columna.`,
      )
    )
      return;
    try {
      await request(`/leads/columns/${column.id}`, { method: "DELETE" });
      await loadPipeline();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la columna.",
      );
    }
  };
  const dropLead = async (event: DragEvent<HTMLElement>, columnId: string) => {
    event.preventDefault();
    const leadId =
      event.dataTransfer.getData("text/merlynsales-conversation") ||
      draggingLeadId;
    setDraggingLeadId(null);
    if (!leadId) return;
    try {
      await request(`/leads/${leadId}/column`, {
        method: "PATCH",
        body: JSON.stringify({ columnId }),
      });
      await Promise.all([loadPipeline(), loadChats()]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo mover el lead.",
      );
    }
  };

  const dropColumn = async (event: DragEvent<HTMLElement>, destinationId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/merlynsales-column") || draggingColumnId;
    setDraggingColumnId(null);
    if (!sourceId || sourceId === destinationId) return;
    const from = pipeline.findIndex((column) => column.id === sourceId);
    const to = pipeline.findIndex((column) => column.id === destinationId);
    if (from < 0 || to < 0) return;
    const reordered = [...pipeline];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setPipeline(reordered);
    try {
      await request("/leads/columns/order", { method: "PUT", body: JSON.stringify({ columnIds: reordered.map((column) => column.id) }) });
      await loadPipeline();
    } catch (error) {
      await loadPipeline();
      setNotice(error instanceof Error ? error.message : "No se pudo reordenar las columnas.");
    }
  };

  const uploadRemarketingImage = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return setNotice("Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.");
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
      if (!response.ok)
        throw new Error(result.error || "No fue posible cargar la imagen.");
      setRemarketingImage(result);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible cargar la imagen.",
      );
    } finally {
      setUploadingImage(false);
    }
  };
  const sendRemarketing = async (event: FormEvent) => {
    event.preventDefault();
    if (!remarketingColumnId || (!remarketingBody.trim() && !remarketingImage))
      return;
    try {
      const result = await request<{ queued: number; skipped: number }>(
        "/remarketing/campaigns",
        {
          method: "POST",
          body: JSON.stringify({
            columnId: remarketingColumnId,
            body: remarketingBody.trim() || undefined,
            mediaId: remarketingImage?.mediaId,
            filename: remarketingImage?.filename,
          }),
        },
      );
      setNotice(
        `Campaña encolada para ${result.queued} leads.${result.skipped ? ` ${result.skipped} quedaron fuera de la ventana de 24 horas.` : ""}`,
      );
      setRemarketingBody("");
      setRemarketingImage(null);
      await refreshData();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la campaña.",
      );
    }
  };
  const savePreset = async () => {
    if (!presetName.trim() || (!remarketingBody.trim() && !remarketingImage))
      return;
    try {
      await request("/remarketing/presets", {
        method: "POST",
        body: JSON.stringify({
          name: presetName,
          body: remarketingBody.trim() || undefined,
          mediaId: remarketingImage?.mediaId,
          filename: remarketingImage?.filename,
        }),
      });
      setPresetName("");
      await loadPresets();
      setNotice("Mensaje de remarketing guardado.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el mensaje.",
      );
    }
  };
  const usePreset = (preset: RemarketingPreset) => {
    setRemarketingBody(preset.body || "");
    setRemarketingImage(
      preset.mediaId
        ? { mediaId: preset.mediaId, filename: preset.filename || "imagen" }
        : null,
    );
    setPresetName(preset.name);
  };
  const deletePreset = async (preset: RemarketingPreset) => {
    if (!window.confirm(`¿Eliminar el mensaje guardado “${preset.name}”?`))
      return;
    try {
      await request(`/remarketing/presets/${preset.id}`, { method: "DELETE" });
      await loadPresets();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el mensaje.",
      );
    }
  };
  const saveAutomation = async (intent: Omit<AutomationIntent, "id">, id?: string) => {
    try {
      await request(id ? `/automations/${id}` : "/automations", { method: id ? "PATCH" : "POST", body: JSON.stringify(intent) });
      await loadAutomations();
      setNotice("Automatización guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar la automatización."); }
  };
  const deleteAutomation = async (id: string) => {
    if (!window.confirm("¿Eliminar esta automatización?")) return;
    try { await request(`/automations/${id}`, { method: "DELETE" }); await loadAutomations(); } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo eliminar la automatización."); }
  };
  const saveQuickReply = async (reply: Omit<QuickReply, "id" | "created_at" | "updated_at">, id?: string) => {
    await request(id ? `/quick-replies/${id}` : "/quick-replies", { method: id ? "PUT" : "POST", body: JSON.stringify(reply) });
    await loadQuickReplies();
  };
  const deleteQuickReply = async (id: string) => {
    if (!window.confirm("¿Eliminar esta respuesta rápida?")) return;
    await request(`/quick-replies/${id}`, { method: "DELETE" });
    await loadQuickReplies();
  };
  const uploadSticker = async (file: File, name: string) => {
    const response = await fetch(`${api}/settings/stickers/upload`, { method: "POST", credentials: "include", headers: { "Content-Type": "image/webp", "X-Upload-Filename": encodeURIComponent(file.name), "X-Sticker-Name": encodeURIComponent(name) }, body: file });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "No fue posible subir el sticker.");
    await loadStickers();
  };
  const deleteSticker = async (sticker: SavedSticker) => { if (!window.confirm(`¿Eliminar el sticker “${sticker.name}”?`)) return; await request(`/settings/stickers/${sticker.id}`, { method: "DELETE" }); await loadStickers(); };
  const uploadDocumentTemplate = async (file: File) => {
    try {
      const response = await fetch(`${api}/settings/document-templates/upload`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/pdf", "X-Upload-Filename": encodeURIComponent(file.name) }, body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No fue posible subir el PDF.");
      await loadDocumentTemplates();
      setNotice("Documento guardado. Ahora puedes editar su mensaje predeterminado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible subir el PDF."); }
  };
  const saveDocumentTemplate = async (template: DocumentTemplate, changes: { filename: string; caption: string; isCatalog: boolean }) => {
    try {
      await request(`/settings/document-templates/${template.id}`, { method: "PATCH", body: JSON.stringify(changes) });
      await Promise.all([loadDocumentTemplates(), chat ? loadDocumentOptions(chat) : Promise.resolve(), modalChat ? loadDocumentOptions(modalChat) : Promise.resolve()]);
      setNotice("Plantilla de documento guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el documento."); }
  };
  const deleteDocumentTemplate = async (template: DocumentTemplate) => {
    if (!window.confirm(`¿Eliminar “${template.filename}”? Ya no estará disponible para enviar.`)) return;
    try { await request(`/settings/document-templates/${template.id}`, { method: "DELETE" }); await loadDocumentTemplates(); setNotice("Documento eliminado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el documento."); }
  };
  const createEntrepreneurPackage = async (name: string) => {
    const group = await request<EntrepreneurPackage>("/settings/entrepreneur-packages", { method: "POST", body: JSON.stringify({ name }) });
    await loadEntrepreneurPackages(); setNotice("Conjunto creado. Ahora agrega sus imágenes."); return group;
  };
  const createBundleImageSet = async (name: string, bundleType: string, controlBundleId: number) => {
    const group = await request<EntrepreneurPackage>("/settings/entrepreneur-packages", { method: "POST", body: JSON.stringify({ name, bundleType, controlBundleId }) });
    await loadEntrepreneurPackages();
    setNotice("Bundle listo. Ahora agrega sus fotografías.");
    return group;
  };
  const uploadEntrepreneurPackage = async (packageId: string, file: File) => {
    try {
      const response = await fetch(`${api}/settings/entrepreneur-packages/upload`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": file.type, "X-Upload-Filename": encodeURIComponent(file.name), "X-Package-Id": packageId },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No fue posible subir la imagen del paquete.");
      await loadEntrepreneurPackages();
      setNotice("Imagen agregada al conjunto.");
    } catch (error) { const message = error instanceof Error ? error.message : "No fue posible subir la imagen del conjunto."; setNotice(message); throw new Error(message); }
  };
  const saveEntrepreneurPackage = async (item: EntrepreneurPackage, changes: { name: string; caption: string }) => {
    try {
      await request(`/settings/entrepreneur-packages/${item.id}`, { method: "PATCH", body: JSON.stringify(changes) });
      await loadEntrepreneurPackages();
      setNotice("Paquete actualizado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el paquete."); }
  };
  const deleteEntrepreneurPackage = async (item: EntrepreneurPackage) => {
    if (!window.confirm(`¿Eliminar “${item.name}”? Ya no estará disponible en el chat.`)) return;
    try { await request(`/settings/entrepreneur-packages/${item.id}`, { method: "DELETE" }); await loadEntrepreneurPackages(); setNotice("Paquete eliminado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el paquete."); }
  };
  const sendEntrepreneurPackages = async (target: Chat | null, packageIds: string[]) => {
    if (!target || !packageIds.length) return;
    try {
      await request(`/conversations/${target.id}/messages/entrepreneur-packages`, { method: "POST", body: JSON.stringify({ packageIds }) });
      await refreshData();
    } catch (error) { const message = error instanceof Error ? error.message : "No fue posible enviar los paquetes."; setNotice(message); throw error; }
  };
  const sendSticker = async (target: Chat | null, stickerId: string) => {
    if (!target) return;
    try {
      await request(`/conversations/${target.id}/messages/sticker`, { method: "POST", body: JSON.stringify({ stickerId }) });
      await refreshData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el sticker."); }
  };
  const saveScenario = async (value: Omit<AutomationScenario, "id" | "key" | "updatedAt" | "position">, id?: string) => {
    try {
      await request(id ? `/scenarios/${id}` : "/scenarios", { method: id ? "PUT" : "POST", body: JSON.stringify(value) });
      await loadScenarios();
      setNotice("Escenario guardado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el escenario."); }
  };
  const reorderScenarios = async (scenarioIds: string[]) => {
    try {
      await request("/scenarios/order", { method: "PUT", body: JSON.stringify({ scenarioIds }) });
      await loadScenarios();
    } catch (error) {
      await loadScenarios();
      setNotice(error instanceof Error ? error.message : "No se pudo reordenar los escenarios.");
      throw error;
    }
  };
  const learnIntent = async (target: Chat | null, messageId: string, intentId: string) => {
    if (!target) return;
    try {
      const result = await request<{ intentName: string }>(`/conversations/${target.id}/messages/${messageId}/learn-intent`, { method: "POST", body: JSON.stringify({ intentId }) });
      await loadAutomations();
      setNotice(`Ejemplo guardado para “${result.intentName}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el ejemplo."); }
  };
  const logout = async () => {
    await request("/auth/session", { method: "DELETE" });
    setUser(null);
    setChats([]);
    setChat(null);
    setModalChat(null);
    setMessages([]);
    setModalMessages([]);
    setPipeline([]);
    setPresets([]);
    setAutomationIntents([]);
  };

  if (!user)
    return (
      <LoginScreen
        email={email}
        password={password}
        busy={busy}
        notice={notice}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={login}
      />
    );
  return (
    <main className={view === "inbox" ? "shell" : "shell pipeline-mode"}>
      <Sidebar
        user={user}
        view={view}
        controlTab={controlTab}
        onViewChange={(nextView) => setView(nextView)}
        onControlTabChange={(tab) => { setControlTab(tab); setView("control"); }}
        onLogout={logout}
      />
      {view === "inbox" ? (
        <Inbox
          chats={filteredChats}
          columns={pipeline}
          filter={inboxFilter}
          chat={chat}
          messages={messages}
          number={number}
          draft={draft}
          uploadingAudio={uploadingAudio}
          uploadingMedia={uploadingMedia}
          documentOptions={documentOptions}
          selectedDocumentId={selectedDocumentId}
          documentCaption={documentCaption}
          entrepreneurPackages={entrepreneurPackages}
          quickReplies={quickReplies}
          stickers={stickers}
          onNumberChange={setNumber}
          onDraftChange={setDraft}
          onCreate={create}
          onOpen={openInbox}
          onFilterChange={setInboxFilter}
          onSendText={(event) => sendText(event, chat, draft, () => setDraft(""))}
          replyToMessage={replyToMessage}
          onReplyToChange={setReplyToMessage}
          onUploadAudio={uploadSelectedAudio(chat)}
          onUploadImage={uploadSelectedMedia(chat, "image")}
          onUploadVideo={uploadSelectedMedia(chat, "video")}
          onUploadDocument={uploadSelectedMedia(chat, "document")}
          onDocumentChange={(mediaId) => {
            setSelectedDocumentId(mediaId);
            setDocumentCaption(documentOptions.find((option) => option.mediaId === mediaId)?.caption || "");
          }}
          onDocumentCaptionChange={setDocumentCaption}
          onSendDocument={() => sendDocument(chat)}
          onSendEntrepreneurPackages={(packageIds) => sendEntrepreneurPackages(chat, packageIds)}
          onSendSticker={(stickerId) => sendSticker(chat, stickerId)}
          onRecordAudio={(audio, filename) =>
            uploadAudio(chat, audio, filename)
          }
          onAutoReplyChange={(enabled) => setAutoReply(chat, enabled)}
          onScenarioChange={(enabled) => setScenarioEnabled(chat, enabled)}
          automationIntents={automationIntents}
          onLearnIntent={(messageId, intentId) => learnIntent(chat, messageId, intentId)}
          onDeleteConversation={() => deleteConversation(chat)}
        />
      ) : view === "pipeline" ? (
        <LeadBoard
          columns={filteredPipeline}
          filter={dashboardFilter}
          canEdit={canEditPipeline}
          columnName={columnName}
          draggingLeadId={draggingLeadId}
          draggingColumnId={draggingColumnId}
          onColumnNameChange={setColumnName}
          onFilterChange={setDashboardFilter}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onOpenLead={openModal}
          onDragStart={(event, leadId) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/merlynsales-conversation", leadId);
            setDraggingLeadId(leadId);
          }}
          onDragEnd={() => setDraggingLeadId(null)}
          onDrop={dropLead}
          onColumnDragStart={(event, columnId) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/merlynsales-column", columnId);
            setDraggingColumnId(columnId);
          }}
          onColumnDragEnd={() => setDraggingColumnId(null)}
          onColumnDrop={dropColumn}
        />
      ) : view === "remarketing" ? (
        <RemarketingPanel
          columns={pipeline}
          selectedColumnId={remarketingColumnId}
          body={remarketingBody}
          image={remarketingImage}
          presets={presets}
          presetName={presetName}
          uploadingImage={uploadingImage}
          onColumnChange={setRemarketingColumnId}
          onBodyChange={setRemarketingBody}
          onPresetNameChange={setPresetName}
          onUploadImage={uploadRemarketingImage}
          onRemoveImage={() => setRemarketingImage(null)}
          onUsePreset={usePreset}
          onDeletePreset={deletePreset}
          onSavePreset={savePreset}
          onSend={sendRemarketing}
        />
      ) : view === "automations" ? (
        <div className="automation-workspace"><QuickRepliesPanel replies={quickReplies} onSave={saveQuickReply} onDelete={deleteQuickReply} /><StickersPanel stickers={stickers} onUpload={uploadSticker} onDelete={deleteSticker} /><DocumentTemplatesPanel templates={documentTemplates} onUpload={uploadDocumentTemplate} onSave={saveDocumentTemplate} onDelete={deleteDocumentTemplate} /><EntrepreneurPackagesPanel packages={entrepreneurPackages} onCreate={createEntrepreneurPackage} onUpload={uploadEntrepreneurPackage} onSave={saveEntrepreneurPackage} onDelete={deleteEntrepreneurPackage} /><AutomationsPanel intents={automationIntents} onSave={saveAutomation} onDelete={deleteAutomation} /></div>
      ) : view === "scenarios" ? (
        <ScenariosPanel scenarios={automationScenarios} columns={pipeline} onSave={saveScenario} onReorder={reorderScenarios} onDelete={async (id) => { await request(`/scenarios/${id}`, { method: "DELETE" }); await loadScenarios(); setNotice("Escenario eliminado."); }} />
      ) : view === "control" ? (
        <ControlPanel chats={chats} tab={controlTab} onTabChange={setControlTab} entrepreneurPackages={entrepreneurPackages} onCreateBundleImageSet={createBundleImageSet} onUploadBundleImage={uploadEntrepreneurPackage} />
      ) : null}
      <ConversationModal
        chat={modalChat}
        messages={modalMessages}
        draft={modalDraft}
        uploadingAudio={uploadingAudio}
        uploadingMedia={uploadingMedia}
        documentOptions={documentOptions}
        selectedDocumentId={selectedDocumentId}
        documentCaption={documentCaption}
        entrepreneurPackages={entrepreneurPackages}
        quickReplies={quickReplies}
        stickers={stickers}
        replyToMessage={replyToMessage}
        onDraftChange={setModalDraft}
        onSendText={(event) => sendText(event, modalChat, modalDraft, () => setModalDraft(""))}
        onReplyToChange={setReplyToMessage}
        onUploadAudio={uploadSelectedAudio(modalChat)}
        onUploadImage={uploadSelectedMedia(modalChat, "image")}
        onUploadVideo={uploadSelectedMedia(modalChat, "video")}
        onUploadDocument={uploadSelectedMedia(modalChat, "document")}
        onDocumentChange={(mediaId) => {
          setSelectedDocumentId(mediaId);
          setDocumentCaption(documentOptions.find((option) => option.mediaId === mediaId)?.caption || "");
        }}
        onDocumentCaptionChange={setDocumentCaption}
        onSendDocument={() => sendDocument(modalChat)}
        onSendEntrepreneurPackages={(packageIds) => sendEntrepreneurPackages(modalChat, packageIds)}
        onSendSticker={(stickerId) => sendSticker(modalChat, stickerId)}
        onRecordAudio={(audio, filename) =>
          uploadAudio(modalChat, audio, filename)
        }
        onAutoReplyChange={(enabled) => setAutoReply(modalChat, enabled)}
        onScenarioChange={(enabled) => setScenarioEnabled(modalChat, enabled)}
        automationIntents={automationIntents}
        onLearnIntent={(messageId, intentId) => learnIntent(modalChat, messageId, intentId)}
        onDeleteConversation={() => deleteConversation(modalChat)}
        onClose={() => {
          setModalChat(null);
          setModalMessages([]);
          setModalDraft("");
        }}
      />
      {notice && (
        <div className="toast">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
    </main>
  );
}
