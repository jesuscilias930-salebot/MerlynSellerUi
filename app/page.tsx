"use client";

import { createClient } from "@supabase/supabase-js";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { api, request } from "./lib/api";
import type { Chat, DocumentOption, LeadColumn, Message, RemarketingPreset, User } from "./lib/types";
import { ConversationModal } from "./components/ConversationModal";
import { Inbox } from "./components/Inbox";
import { LeadBoard } from "./components/LeadBoard";
import { LoginScreen } from "./components/LoginScreen";
import { RemarketingPanel } from "./components/RemarketingPanel";
import { Sidebar } from "./components/Sidebar";

type View = "inbox" | "pipeline" | "remarketing";
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [presetName, setPresetName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  const loadChats = async () =>
    setChats(await request<Chat[]>("/conversations"));
  const loadMessages = (item: Chat) =>
    request<Message[]>(`/conversations/${item.id}/messages`);
  const loadDocumentOptions = async (item: Chat, selectLatest = false) => {
    const options = await request<DocumentOption[]>(`/conversations/${item.id}/document-options`);
    setDocumentOptions(options);
    setSelectedDocumentId((current) => selectLatest || !options.some((option) => option.mediaId === current) ? options[0]?.mediaId || "" : current);
  };
  const loadPresets = async () =>
    setPresets(await request<RemarketingPreset[]>("/remarketing/presets"));
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
    setChat(item);
    const [nextMessages] = await Promise.all([loadMessages(item), loadDocumentOptions(item)]);
    setMessages(nextMessages);
  };
  const openModal = async (item: Chat) => {
    setModalChat(item);
    setModalDraft("");
    const [nextMessages] = await Promise.all([loadMessages(item), loadDocumentOptions(item)]);
    setModalMessages(nextMessages);
  };
  const refreshData = async () => {
    await Promise.all([loadChats(), loadPipeline(), loadPresets()]);
    if (chat) setMessages(await loadMessages(chat));
    if (modalChat) setModalMessages(await loadMessages(modalChat));
  };
  const canEditPipeline = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    request<{ user: User }>("/auth/me")
      .then(async (session) => {
        setUser(session.user);
        await Promise.all([loadChats(), loadPipeline(), loadPresets()]);
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
    stream.addEventListener("conversation.updated", refresh);
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
      await Promise.all([loadChats(), loadPipeline(), loadPresets()]);
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
        body: JSON.stringify({ body: value }),
      });
      clear();
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
    const allowedTypes = [
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "audio/opus",
      "audio/webm",
    ];
    if (!allowedTypes.includes(audio.type))
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
            "Content-Type": audio.type,
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
    const allowedTypes = type === "image" ? ["image/jpeg", "image/png", "image/webp"] : type === "document" ? ["application/pdf"] : ["video/mp4", "video/3gpp", "video/quicktime"];
    const maxSize = type === "image" ? 5 * 1024 * 1024 : type === "document" ? 25 * 1024 * 1024 : 16 * 1024 * 1024;
    const isMov = type === "video" && /\.mov$/i.test(file.name);
    const isPdf = type === "document" && /\.pdf$/i.test(file.name);
    if (!allowedTypes.includes(file.type) && !isMov && !isPdf) throw new Error(type === "image" ? "Selecciona una imagen JPEG, PNG o WebP." : type === "document" ? "Selecciona un archivo PDF." : "Selecciona un video MP4, 3GPP o MOV.");
    if (file.size > maxSize) throw new Error(type === "image" ? "La imagen no puede superar 5 MB." : type === "document" ? "El PDF no puede superar 25 MB." : "El video no puede superar 16 MB.");
    setUploadingMedia(true);
    try {
      const endpoint = type === "document" ? "document/upload" : type;
      const response = await fetch(`${api}/conversations/${target.id}/messages/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": isMov ? "video/quicktime" : isPdf ? "application/pdf" : file.type, "X-Upload-Filename": encodeURIComponent(file.name) },
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
        body: JSON.stringify({ mediaId: document.mediaId, filename: document.filename, caption: document.caption || undefined }),
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
        onViewChange={setView}
        onLogout={logout}
      />
      {view === "inbox" ? (
        <Inbox
          chats={chats}
          chat={chat}
          messages={messages}
          number={number}
          draft={draft}
          uploadingAudio={uploadingAudio}
          uploadingMedia={uploadingMedia}
          documentOptions={documentOptions}
          selectedDocumentId={selectedDocumentId}
          onNumberChange={setNumber}
          onDraftChange={setDraft}
          onCreate={create}
          onOpen={openInbox}
          onSendText={(event) =>
            sendText(event, chat, draft, () => setDraft(""))
          }
          onUploadAudio={uploadSelectedAudio(chat)}
          onUploadImage={uploadSelectedMedia(chat, "image")}
          onUploadVideo={uploadSelectedMedia(chat, "video")}
          onUploadDocument={uploadSelectedMedia(chat, "document")}
          onDocumentChange={setSelectedDocumentId}
          onSendDocument={() => sendDocument(chat)}
          onRecordAudio={(audio, filename) =>
            uploadAudio(chat, audio, filename)
          }
        />
      ) : view === "pipeline" ? (
        <LeadBoard
          columns={pipeline}
          canEdit={canEditPipeline}
          columnName={columnName}
          draggingLeadId={draggingLeadId}
          onColumnNameChange={setColumnName}
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
        />
      ) : (
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
      )}
      <ConversationModal
        chat={modalChat}
        messages={modalMessages}
        draft={modalDraft}
        uploadingAudio={uploadingAudio}
        uploadingMedia={uploadingMedia}
        documentOptions={documentOptions}
        selectedDocumentId={selectedDocumentId}
        onDraftChange={setModalDraft}
        onSendText={(event) =>
          sendText(event, modalChat, modalDraft, () => setModalDraft(""))
        }
        onUploadAudio={uploadSelectedAudio(modalChat)}
        onUploadImage={uploadSelectedMedia(modalChat, "image")}
        onUploadVideo={uploadSelectedMedia(modalChat, "video")}
        onUploadDocument={uploadSelectedMedia(modalChat, "document")}
        onDocumentChange={setSelectedDocumentId}
        onSendDocument={() => sendDocument(modalChat)}
        onRecordAudio={(audio, filename) =>
          uploadAudio(modalChat, audio, filename)
        }
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
