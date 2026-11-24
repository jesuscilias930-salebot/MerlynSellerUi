"use client";

import { ChannelBadge } from "./ChannelBadge";
import { ChangeEvent, FormEvent, Fragment, type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { api, request } from "../lib/api";
import { VIDEO_ACCEPT } from "../lib/video-upload";
import { initials } from "../lib/format";
import { contactDetail, contactName, contactPhone, isWhatsApp } from "../lib/channels";
import { deliveryLabel, messageDayKey, messageDayLabel, messageTime } from "../lib/inbox-presentation";
import { ChatIcon } from "./ChatIcon";
import { AdReferralCard } from "./AdReferralCard";
import type { AutomationIntent, Chat, CtaUrlMessage, InteractiveOptionsMessage, DocumentOption, EntrepreneurPackage, LeadColumn, Message, QuickReply, SavedSticker } from "../lib/types";
import { MobileChatSheet } from "./MobileChatSheet";
import { AudioRecorder } from "./AudioRecorder";
import { QuoteNoteGenerator } from "./QuoteNoteGenerator";
import { StoreOrders } from "./StoreOrders";
import { ChatSaleModal } from "./ChatSaleModal";
import { CtaUrlCard } from "./CtaUrlCard";
import { InteractiveOptionsCard } from "./InteractiveOptionsCard";
import { InventoryQuickSearch } from "./InventoryQuickSearch";
import { ChatDeliveriesCard } from "./DeliveriesPanel";
import optionStyles from "./InteractiveOptions.module.css";
import { ToolAccordion } from "./ToolAccordion";
import { WhatsAppTemplateCard } from "./WhatsAppTemplateCard";
import {ChatShippingModal} from "./ChatShippingModal";
import { QuoteDrawer } from "./QuoteDrawer";
import { ProductStockSender } from "./ProductStockImages";
import { LocationQuickCards, LocationSender } from "./LocationSender";
import { LocationMapCard } from "./LocationMapCard";
import { OutgoingContext, isLocalMessage, LOCAL_PREFIX } from "../lib/outgoing";
import { quotedLabel, quotedThumbnailKind } from "../lib/quoted";
import { progressLabel } from "../lib/media-upload-request";
import { unsupportedMessageInfo } from "../lib/unsupported-message";
import { useAutoDismiss } from "../lib/use-auto-dismiss";
import { SavedVideosPanel, sendSavedVideo, useSavedVideos, type SavedVideo } from "./SavedVideos";
import { QuickButtonsRow, QuickButtonsSettings, useQuickButtons } from "./QuickButtons";
import { QuoteBundlePicker } from "./QuoteBundlePicker";
import { chatQuoteBundle } from "../lib/quote";
import type { QuoteBundleRef } from "../lib/types";

export type PendingChatImage = { id: string; file: File; previewUrl: string };
type ToolTab = "share" | "sale";
type Props = {
  chat: Chat | null; messages: Message[]; draft: string; uploadingAudio: boolean; uploadingMedia: boolean; pendingImages: PendingChatImage[];
  documentOptions: DocumentOption[]; selectedDocumentId: string; documentCaption: string; entrepreneurPackages: EntrepreneurPackage[]; quickReplies: QuickReply[]; stickers: SavedSticker[];
  onDraftChange: (value: string) => void; onSendQuickReplyCta: (templateId: string) => Promise<void>; onSendText: (event: FormEvent) => void; replyToMessage: Message | null; onReplyToChange: (message: Message | null) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void; onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void; onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void; onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void; onRemovePendingImage: (id: string) => void;
  onDocumentChange: (mediaId: string) => void; onDocumentCaptionChange: (caption: string) => void; onSendDocument: () => void; onSendCtaUrl: (data: CtaUrlMessage) => Promise<void>;
  onSendEntrepreneurPackages: (selection: { packageIds?: string[]; imageIds?: string[]; caption?: string }) => Promise<void>; onSendSticker: (id: string) => Promise<void>; onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onAutoReplyChange: (enabled: boolean) => void; onScenarioChange: (enabled: boolean) => void; automationIntents: AutomationIntent[]; onLearnIntent: (messageId: string, intentId: string) => Promise<void>; onReact: (messageId: string, emoji: string) => Promise<void>; onDeleteMessage: (messageId: string, scope: "for_me" | "for_everyone") => Promise<void>;
  columns: LeadColumn[]; onMoveLead: (columnId: string) => Promise<void>; onOpenShipping: () => void; onDeleteConversation: () => void; onQuoteBundleChange?: (bundle: QuoteBundleRef | null) => Promise<void>; onClose?: () => void; onMobileBack?: () => void; inboxLayout?: boolean;
};
const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const composerEmojis = ["😀", "😊", "😍", "😂", "😉", "👍", "❤️", "🔥", "✨", "🙏", "🎉", "📦"];

function IntentLearner({ message, intents, onLearn }: { message: Message; intents: AutomationIntent[]; onLearn: (messageId: string, intentId: string) => Promise<void> }) {
  const [intentId, setIntentId] = useState(""); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  if (message.direction !== "inbound" || message.type !== "text" || !message.body || !intents.length) return null;
  return <div className="intent-learner"><button className="intent-learner-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-label="Entrenar bot">⋮</button>{open && <div className="intent-learner-menu"><select value={intentId} onChange={(event) => setIntentId(event.target.value)}><option value="">Este mensaje corresponde a…</option>{intents.map((intent) => <option key={intent.id} value={intent.id}>{intent.name}</option>)}</select><button type="button" disabled={!intentId || saving} onClick={async () => { setSaving(true); try { await onLearn(message.id, intentId); setOpen(false); } finally { setSaving(false); } }}>{saving ? "…" : "Aprender"}</button></div>}</div>;
}

export function ConversationPanel(props: Props) {
const { chat, messages, draft, uploadingAudio, uploadingMedia, pendingImages, documentOptions, selectedDocumentId, documentCaption, onDraftChange, onSendQuickReplyCta, onSendText, replyToMessage, onReplyToChange, onUploadAudio, onUploadImage, onUploadVideo, onUploadDocument, onRemovePendingImage, onDocumentChange, onDocumentCaptionChange, onSendDocument, onSendCtaUrl, entrepreneurPackages, quickReplies, stickers, onSendEntrepreneurPackages, onSendSticker, onRecordAudio, onAutoReplyChange, onScenarioChange, automationIntents, onLearnIntent, onReact, onDeleteMessage, columns, onMoveLead, onDeleteConversation, onClose, onMobileBack } = props;
  const [mobile, setMobile] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const optionsToggle = useRef<HTMLButtonElement>(null);
  const toolsToggle = useRef<HTMLButtonElement>(null);
  const optionsId = useId(); const toolsId = useId();
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => { setMobile(query.matches); setToolsOpen(false); setOptionsOpen(false); };
    let active = true;
    queueMicrotask(() => { if (active) update(); }); query.addEventListener("change", update);
    return () => { active = false; query.removeEventListener("change", update); };
  }, []);
  const threadRef = useRef<HTMLDivElement>(null); const lastChatId = useRef<string | null>(null);
  const outgoingActions = useContext(OutgoingContext);
  // Conjuntos de «Imágenes guardadas» abiertos en este chat (las fotos se cargan al abrirlos).
  const [openImageSets, setOpenImageSets] = useState<string[]>([]); const [showStickers, setShowStickers] = useState(false);
  // Atajos: conjuntos marcados que se envían completos con un botón debajo del cuadro de texto.
  const [shortcutOverrides, setShortcutOverrides] = useState<Record<string, boolean>>({}); const [sendingShortcut, setSendingShortcut] = useState<string | null>(null);
  const [toolsCollapsed, setToolsCollapsed] = useState(Boolean(props.inboxLayout)); const [tab, setTab] = useState<ToolTab>("share"); const [notice, setNotice] = useState(""); const [menuId, setMenuId] = useState<string | null>(null); const [chatMenuOpen, setChatMenuOpen] = useState(false); const [moving, setMoving] = useState(false); const [bundlePickerOpen, setBundlePickerOpen] = useState(false); const [bundleIds, setBundleIds] = useState<string[]>([]); const [selectedSavedImageIds, setSelectedSavedImageIds] = useState<string[]>([]); const [saleModalOpen, setSaleModalOpen] = useState(false); const [shippingOpen, setShippingOpen] = useState(false);
  // El aviso del chat se cierra solo a los 2 s (se mantiene mientras el puntero está encima).
  const noticeHover = useAutoDismiss(notice, () => setNotice(""));
  const quickMatches = draft.trim().startsWith("/") ? quickReplies.filter((reply) => reply.shortcut.includes(draft.trim().toLowerCase()) || reply.name.toLowerCase().includes(draft.trim().slice(1).toLowerCase())).slice(0, 6) : [];
  const bundles = useMemo(() => entrepreneurPackages.filter((item) => item.controlBundleId != null), [entrepreneurPackages]);
  const images = useMemo(() => entrepreneurPackages.filter((item) => item.controlBundleId == null), [entrepreneurPackages]);
  const isShortcut = (set: EntrepreneurPackage) => shortcutOverrides[set.id] ?? set.chatShortcut ?? false;
  const shortcutSets = images.filter((set) => set.images.length > 0 && isShortcut(set));
  const toggleShortcut = async (set: EntrepreneurPackage, value: boolean) => {
    setShortcutOverrides((current) => ({ ...current, [set.id]: value }));
    try { await request(`/settings/entrepreneur-packages/${set.id}`, { method: "PATCH", body: JSON.stringify({ chatShortcut: value }) }); }
    catch (error) { setShortcutOverrides((current) => ({ ...current, [set.id]: !value })); setNotice(error instanceof Error ? error.message : "No se pudo guardar el atajo."); }
  };
  const savedVideos = useSavedVideos();
  const quickButtons = useQuickButtons();
  // Fotos de una respuesta rápida: se envían con el texto del cuadro como pie de la primera.
  const [replyImageIds, setReplyImageIds] = useState<string[]>([]);
  const savedImage = (id: string) => entrepreneurPackages.flatMap((set) => set.images.map((image) => ({ ...image, setName: set.name }))).find((image) => image.id === id);
  const chooseQuickReply = (reply: QuickReply) => {
    if (reply.kind === "cta_url" && reply.ctaUrlTemplateId) { void onSendQuickReplyCta(reply.ctaUrlTemplateId); return; }
    onDraftChange(reply.body);
    setReplyImageIds((reply.imageIds || []).filter((id) => savedImage(id)));
  };
  const submitComposer = async (event: FormEvent) => {
    if (!replyImageIds.length || !chat) { onSendText(event); return; }
    event.preventDefault();
    const text = draft.trim(); const ids = replyImageIds;
    // El cuadro se libera al instante para no enviar dos veces.
    setReplyImageIds([]); onDraftChange("");
    try {
      // WhatsApp admite pies de foto de hasta 1,024 caracteres: si es más largo, el texto va antes como mensaje.
      if (text.length > 1024) { await request(`/conversations/${chat.id}/messages/text`, { method: "POST", body: JSON.stringify({ body: text }) }); await onSendEntrepreneurPackages({ imageIds: ids }); }
      else await onSendEntrepreneurPackages({ imageIds: ids, ...(text ? { caption: text } : {}) });
    } catch (error) { setReplyImageIds(ids); onDraftChange(text); setNotice(error instanceof Error ? error.message : "No fue posible enviar la respuesta rápida."); }
  };
  const videoShortcuts = savedVideos.videos.filter((video) => video.chatShortcut);
  const sendVideoShortcut = async (video: SavedVideo) => {
    if (!chat || sendingShortcut) return;
    if (!window.confirm(`¿Enviar el video «${video.name}» a ${contactName(chat)}?`)) return;
    setSendingShortcut(video.id);
    try { await sendSavedVideo(chat.id, video.id); setNotice(`Video «${video.name}» enviado.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el video."); }
    finally { setSendingShortcut(null); }
  };
  const sendShortcut = async (set: EntrepreneurPackage) => {
    if (!chat || sendingShortcut) return;
    const ids = set.images.map((image) => image.id);
    if (!window.confirm(`¿Enviar las ${ids.length} ${ids.length === 1 ? "foto" : "fotos"} de «${set.name}» a ${contactName(chat)}?`)) return;
    setSendingShortcut(set.id);
    try {
      // El servidor acepta hasta 50 por envío: los conjuntos grandes van en partes, en orden.
      for (let start = 0; start < ids.length; start += 50) await onSendEntrepreneurPackages({ imageIds: ids.slice(start, start + 50) });
      setNotice(`Se enviaron las ${ids.length} ${ids.length === 1 ? "foto" : "fotos"} de «${set.name}».`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el conjunto."); }
    finally { setSendingShortcut(null); }
  };
  useEffect(() => { if (!chat?.id || !messages.length || lastChatId.current === chat.id) return; const frame = requestAnimationFrame(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); lastChatId.current = chat.id; }); return () => cancelAnimationFrame(frame); }, [chat?.id, messages.length]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; setSelectedSavedImageIds([]); setChatMenuOpen(false); setOptionsOpen(false); setInventoryOpen(false); setToolsOpen(false); setMenuId(null); setShippingOpen(false); setSaleModalOpen(false); setBundlePickerOpen(false); setReplyImageIds([]); let openQuote = false; try { openQuote = Boolean(chat?.id) && window.sessionStorage.getItem("merlynseller:open-quote") === chat?.id; if (openQuote) window.sessionStorage.removeItem("merlynseller:open-quote"); } catch { /* opcional */ } setQuoteOpen(openQuote); if (openQuote) setToolsCollapsed(true); }); return () => { active = false; }; }, [chat?.id]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active && (shippingOpen || saleModalOpen || bundlePickerOpen)) setToolsOpen(false); }); return () => { active = false; }; }, [shippingOpen, saleModalOpen, bundlePickerOpen]);
  useEffect(() => {
    if (!inventoryOpen || mobile) return;
    const close = (event: PointerEvent) => { if (!inventoryRef.current?.contains(event.target as Node)) setInventoryOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [inventoryOpen, mobile]);
  useEffect(() => {
    if (!optionsOpen || mobile) return;
    const close = (event: PointerEvent) => { if (!optionsRef.current?.contains(event.target as Node)) setOptionsOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [optionsOpen, mobile]);
  // Tocar una cita lleva al mensaje original y lo resalta un momento (como WhatsApp).
  const jumpToMessage = (id: string) => {
    const target = document.getElementById(`message-${id}`);
    if (!target) { setNotice("El mensaje original ya no está en esta conversación."); return; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("message-highlight"); void target.offsetWidth; target.classList.add("message-highlight");
    window.setTimeout(() => target.classList.remove("message-highlight"), 1600);
  };
  const mediaUrl = (message: Message) => `${api}/conversations/${chat?.id}/messages/${message.id}/media`;
  const renderContent = (message: Message): ReactNode => {
    if (message.deletedForEveryone) return <p className="deleted-message">🚫 Este mensaje fue eliminado.</p>;
    if (message.type === "audio" && message.media_id) return <audio controls src={mediaUrl(message)} />;
    if (message.type === "sticker" && message.media_id) return <img className="sticker" src={mediaUrl(message)} alt="Sticker" />;
    if (message.type === "video" && message.localPreviewUrl) { const percent = Math.round((message.localProgress?.fraction || 0) * 100); const phase = message.localProgress?.phase; return <span className="chat-video-sending"><video className="chat-video" src={message.localPreviewUrl} muted playsInline preload="metadata" />{message.status === "pending" && <span className="chat-upload-overlay" role="progressbar" aria-label="Avance del envío del video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === "uploading" ? percent : undefined}><b>{phase === "uploading" ? `${percent}%` : phase === "processing" ? "✓ 100%" : "…"}</b><span className="chat-upload-bar"><span style={{ width: `${phase === "processing" ? 100 : phase === "uploading" ? percent : 0}%` }} className={phase === "processing" || phase === "checking" || !phase ? "indeterminate" : ""} /></span><small>{progressLabel(message.localProgress)}</small></span>}</span>; }
    if (message.type === "image" && message.localPreviewUrl) return <><span className="chat-image-sending"><img className="chat-image" src={message.localPreviewUrl} alt="Imagen en envío" />{message.status === "pending" && <span className="chat-image-spinner" aria-hidden="true" />}</span>{message.body && <p className="media-caption">{message.body}</p>}</>;
    if (message.type === "image" && message.media_id) return <><img className="chat-image" src={mediaUrl(message)} alt="Imagen" />{message.body && <p className="media-caption">{message.body}</p>}</>;
    // Video recibido por el servidor que aún se convierte y sube a Meta (o que falló al prepararse).
    if (message.type === "video" && !message.media_id && message.direction === "outbound" && (message.status === "processing" || message.status === "failed")) return <div className={`whatsapp-content-card video-processing-card ${message.status}`}>{message.status === "processing" ? <><b>🎥 Preparando video para WhatsApp…</b><span className="chat-upload-bar"><span className="indeterminate" /></span><small>Se envía solo en cuanto esté listo. Puedes seguir escribiendo.</small></> : <><b>⚠️ No se pudo enviar el video</b><small>{message.error_code || "Intenta enviarlo de nuevo."}</small></>}{message.body && <p className="media-caption">{message.body}</p>}</div>;
    if (message.type === "video" && message.media_id) return <video className="chat-video" playsInline preload="metadata" controls src={mediaUrl(message)} />;
    if (message.type === "document" && message.media_id) return <><a className="document-card" href={mediaUrl(message)} target="_blank" rel="noreferrer"><b className="document-icon">PDF</b><span><strong>{message.filename || "Documento adjunto"}</strong><small>Abrir documento</small></span></a>{message.body && <p className="media-caption">{message.body}</p>}</>;
    if (message.type === "contacts" && message.messageMetadata?.contacts?.length) return <div className="whatsapp-content-card contacts-card"><span className="whatsapp-content-kicker">Contacto compartido</span>{message.messageMetadata.contacts.map((contact, index) => <section key={index}><b>{contact.name || "Contacto"}</b>{contact.phones?.map((phone, key) => <span key={key}>☎ {phone.phone || phone.waId}</span>)}</section>)}</div>;
    if (message.type === "location" && message.messageMetadata?.location) return <LocationMapCard location={message.messageMetadata.location} />;
    if (message.type === "interactive" && message.direction === "inbound" && message.messageMetadata?.interactive) return <div className="whatsapp-content-card reply-card"><span className="whatsapp-content-kicker">Respuesta interactiva</span><b>{message.messageMetadata.interactive.title || message.messageMetadata.interactive.body || "Respuesta seleccionada"}</b></div>;
    if (message.type === "interactive") { try { const data = JSON.parse(message.body || "{}") as CtaUrlMessage & Partial<InteractiveOptionsMessage> & { kind?: string }; if (data.kind === "options") return <div className={optionStyles.chatPreview}>{data.header && <b>{data.header}</b>}<p>{data.body}</p><ul>{(data.options || []).map(option => <li key={option.id || option.title}>{option.title}{option.description && <small> · {option.description}</small>}</li>)}</ul><small>{data.format === "buttons" ? "Botones de respuesta" : `Lista · «${data.buttonText || "Ver opciones"}»`}</small></div>; return <div className="interactive-cta-preview"><p>{data.body}</p><span>{data.buttonText || "Abrir enlace"} ↗</span></div>; } catch { return <p>[Mensaje interactivo]</p>; } }
    if (message.type === "template") { try { const data = JSON.parse(message.body || "{}") as { templateName?: string }; return <div className="interactive-cta-preview"><p>Plantilla: {data.templateName || "WhatsApp"}</p><span>Enviada mediante plantilla oficial</span></div>; } catch { return <p>[Plantilla oficial]</p>; } }
    if (message.type === "unsupported" || message.type === "unknown") { const info = unsupportedMessageInfo(message.messageMetadata?.unsupported); return <div className="whatsapp-content-card system-card"><b>{info.title}</b><small>{info.hint}</small></div>; }
    return <p>{message.body || `[${message.type}]`}</p>;
  };
  const deleteMessage = async (message: Message, scope: "for_me" | "for_everyone") => { setMenuId(null); try { await onDeleteMessage(message.id, scope); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible eliminar el mensaje."); } };
  const submitImages = async (ids: string[]) => { if (!ids.length) return; try { await onSendEntrepreneurPackages({ imageIds: ids }); setSelectedSavedImageIds((current) => current.filter((id) => !ids.includes(id))); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar las imágenes."); } };
  const toggleSavedImage = (imageId: string) => setSelectedSavedImageIds((current) => current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId]);
  const toggleSavedImageSet = (imageIds: string[]) => setSelectedSavedImageIds((current) => imageIds.every((id) => current.includes(id)) ? current.filter((id) => !imageIds.includes(id)) : [...new Set([...current, ...imageIds])]);
  const submitBundles = async () => { if (!bundleIds.length) return; try { await onSendEntrepreneurPackages({ packageIds: bundleIds }); setBundleIds([]); setBundlePickerOpen(false); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible enviar el bundle."); } };
  const moveLead = async (columnId: string) => { if (!chat || !columnId || columnId === chat.leadColumnId) return; setMoving(true); try { await onMoveLead(columnId); } finally { setMoving(false); } };
const attachTools = <div className="tool-file-cards"><label><b>PDF</b><small>Documento</small><input type="file" accept="application/pdf,.pdf" onChange={event => { onUploadDocument(event); if (mobile && event.target.files?.length) setToolsOpen(false); }} disabled={!chat || uploadingMedia} /></label><label><b>▧</b><small>Imágenes</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { onUploadImage(event); if (mobile && event.target.files?.length) setToolsOpen(false); }} disabled={!chat || uploadingMedia} /></label><label><b>▶</b><small>Video</small><input type="file" accept={VIDEO_ACCEPT} onChange={event => { onUploadVideo(event); if (mobile && event.target.files?.length) setToolsOpen(false); }} disabled={!chat || uploadingMedia} /></label><LocationQuickCards chatId={chat?.id} onNotice={setNotice} onDone={() => setToolsOpen(false)} onConfigure={() => { setToolsOpen(false); setTab("share"); setToolsCollapsed(false); }} /></div>;
  const shareTools = (
    <>
      <ToolAccordion defaultOpen icon="▤" title="Catálogo" description="Comparte un catálogo con un mensaje personalizado.">
        <select value={selectedDocumentId} onChange={(event) => onDocumentChange(event.target.value)}>
          <option value="">Selecciona un catálogo</option>
          {documentOptions.map((document) => <option key={document.mediaId} value={document.mediaId}>{document.filename}</option>)}
        </select>
        <textarea value={documentCaption} onChange={(event) => onDocumentCaptionChange(event.target.value)} placeholder="Mensaje que acompaña el catálogo" disabled={!selectedDocumentId} />
        <button className="tool-primary-button" type="button" disabled={!chat || !selectedDocumentId || uploadingMedia} onClick={onSendDocument}>Enviar catálogo</button>
      </ToolAccordion>
      <ToolAccordion icon="👕" title="Producto con tallas" description="Envía fotos de productos con sus tallas disponibles del inventario.">{chat && <ProductStockSender key={chat.id} chatId={chat.id} />}</ToolAccordion>
      <ToolAccordion icon="📍" title="Ubicación" description="Envía tu ubicación actual o la de la bodega.">{chat && <LocationSender key={chat.id} chatId={chat.id} />}</ToolAccordion>
      <CtaUrlCard disabled={!chat} packages={entrepreneurPackages} onSend={onSendCtaUrl} />
      <InteractiveOptionsCard conversationId={chat?.id} disabled={!chat} />
      <>{chat && <StoreOrders key={chat.id} conversationId={chat.id}/>}</>{isWhatsApp(chat) ? <WhatsAppTemplateCard conversationId={chat?.id} disabled={!chat} /> : <p className="tool-notice">Las plantillas oficiales son solo para WhatsApp. En {contactDetail(chat!).split(" · ")[0]} puedes responder hasta 24 h después del último mensaje del cliente (7 días si vino de un anuncio o respondes como persona del equipo).</p>}
      <ToolAccordion icon="＋" title="Adjuntar archivos" description="Las imágenes se muestran antes de enviarse.">{attachTools}</ToolAccordion>
      <ToolAccordion icon="⚡" title="Botones rápidos" description="Invitación con enlace y 5 conjuntos de imágenes con un clic."><QuickButtonsSettings store={quickButtons} imageSets={entrepreneurPackages} /></ToolAccordion>
      <ToolAccordion icon="🎬" title="Videos guardados" description="Súbelos una vez y envíalos al instante.">{chat && <SavedVideosPanel chatId={chat.id} store={savedVideos} />}</ToolAccordion>
      <ToolAccordion icon="▦" title="Imágenes guardadas" description="Selecciona una o varias imágenes y envíalas juntas.">
        {selectedSavedImageIds.length > 0 && <div className="saved-image-selection-actions"><span>{selectedSavedImageIds.length} seleccionada{selectedSavedImageIds.length === 1 ? "" : "s"}</span><button className="tool-primary-button" type="button" disabled={!chat} onClick={() => void submitImages(selectedSavedImageIds)}>Enviar selección</button><button className="plain-button" type="button" onClick={() => setSelectedSavedImageIds([])}>Limpiar</button></div>}
        {/* Las fotos se piden al servidor solo al abrir su conjunto: abrir la herramienta no descarga nada. */}
        {images.map((set) => { const setImageIds = set.images.map((image) => image.id); const allSelected = setImageIds.length > 0 && setImageIds.every((id) => selectedSavedImageIds.includes(id)); const selectedInSet = setImageIds.filter((id) => selectedSavedImageIds.includes(id)).length; const expanded = openImageSets.includes(set.id); return <article className="saved-image-set" key={set.id}><div className="saved-image-set-header"><button type="button" className="saved-image-set-toggle" aria-expanded={expanded} onClick={() => setOpenImageSets((current) => current.includes(set.id) ? current.filter((id) => id !== set.id) : [...current, set.id])}><b>{set.name}</b><small>{set.images.length} {set.images.length === 1 ? "foto" : "fotos"}{selectedInSet ? ` · ${selectedInSet} seleccionada${selectedInSet === 1 ? "" : "s"}` : ""} · {expanded ? "Ocultar" : "Ver fotos"}</small></button>{set.images.length > 0 && <button className="plain-button" type="button" onClick={() => toggleSavedImageSet(setImageIds)}>{allSelected ? "Quitar todas" : "Seleccionar todas"}</button>}</div>{set.images.length > 0 && <label className="saved-image-shortcut"><input type="checkbox" checked={isShortcut(set)} onChange={(event) => void toggleShortcut(set, event.target.checked)} /> Botón de atajo en el chat <small>(envía todo el conjunto)</small></label>}{expanded && <div className="tool-gallery-grid">{set.images.map((image) => <button className={selectedSavedImageIds.includes(image.id) ? "selected" : ""} type="button" key={image.id} aria-pressed={selectedSavedImageIds.includes(image.id)} onClick={() => toggleSavedImage(image.id)}><img src={`${api}/settings/entrepreneur-packages/images/${image.id}/media`} alt={image.filename || set.name} loading="lazy" decoding="async" /><span>✓</span></button>)}</div>}</article>; })}
        {stickers.length > 0 && (showStickers ? <div className="tool-stickers">{stickers.map((sticker) => <button key={sticker.id} type="button" onClick={() => void onSendSticker(sticker.id)}><img src={`${api}/settings/stickers/${sticker.id}/media`} alt={sticker.name} loading="lazy" decoding="async" /></button>)}</div> : <button type="button" className="plain-button saved-stickers-toggle" onClick={() => setShowStickers(true)}>Ver stickers ({stickers.length})</button>)}
      </ToolAccordion>
    </>
  );
  const saleTools = (
    <>
      <ToolAccordion defaultOpen icon="✓" title="Registrar venta" description="Descuenta inventario y vincula la conversión al chat."><button className="tool-primary-button" type="button" disabled={!chat} onClick={() => setSaleModalOpen(true)}>Registrar orden</button></ToolAccordion>
      <ChatDeliveriesCard conversationId={chat?.id} prefill={{ customerName: chat ? contactName(chat) : "", customerPhone: chat ? contactPhone(chat) : "" }} />
      <ToolAccordion icon="▣" title="Generar envío" description="Captura los datos y cotiza sin salir del chat."><button className="tool-secondary-button" type="button" disabled={!chat} onClick={() => setShippingOpen(true)}>Capturar datos de envío</button></ToolAccordion>
      <ToolAccordion icon="🎁" title="Paquetes y promociones" description="Envía fotografías de un bundle."><button className="tool-secondary-button" type="button" disabled={!chat} onClick={() => setBundlePickerOpen(true)}>Enviar bundle</button></ToolAccordion>
      <ToolAccordion icon="🧾" title="Nota final" description="Genera un resumen de la venta."><QuoteNoteGenerator disabled={!chat} onUseNote={onDraftChange} /></ToolAccordion>
    </>
  );
  const tools = (
    <aside id={toolsId} className={`chat-tools-panel ${toolsCollapsed ? "collapsed" : ""}`} aria-label="Herramientas de conversación" onKeyDown={event => { if (event.key === "Escape" && !mobile) { setToolsCollapsed(true); toolsToggle.current?.focus(); } }}>
      <header><div><p>HERRAMIENTAS DEL CRM</p><h2>Enviar y preparar</h2></div><button className="chat-tools-toggle" type="button" aria-label={toolsCollapsed ? "Abrir herramientas" : "Cerrar herramientas"} aria-expanded={!toolsCollapsed} onClick={() => setToolsCollapsed((value) => !value)}><ChatIcon name={toolsCollapsed ? "tools" : "close"} /></button></header>
      {(!toolsCollapsed || mobile) && <><nav className="chat-tools-tabs"><button className={tab === "share" ? "selected" : ""} type="button" onClick={() => setTab("share")}>Compartir contenido</button><button className={tab === "sale" ? "selected" : ""} type="button" onClick={() => setTab("sale")}>Gestión de venta</button></nav>{notice && <p className="tool-notice">{notice}</p>}<div className="chat-tools-body">{tab === "share" ? shareTools : saleTools}</div></>}
    </aside>
  );
  const conversationOptions = <div className="mobile-chat-options inbox-conversation-options">
    <p className="inbox-options-title">Automatizaciones</p>
    {chat && <div className="chat-statuses"><button className={`status-badge ${chat.autoReplyEnabled !== false ? "on" : ""}`} type="button" aria-pressed={chat.autoReplyEnabled !== false} onClick={() => onAutoReplyChange(chat.autoReplyEnabled === false)}>Bot <span>{chat.autoReplyEnabled !== false ? "Activo" : "Pausado"}</span></button><button className={`status-badge ${chat.scenarioEnabled !== false ? "on" : ""}`} type="button" aria-pressed={chat.scenarioEnabled !== false} onClick={() => onScenarioChange(chat.scenarioEnabled === false)}>Escenarios <span>{chat.scenarioEnabled !== false ? "Activos" : "Pausados"}</span></button></div>}
    {chat && <label className="chat-column-select"><span>Columna de venta</span><select aria-label="Columna de venta" value={chat.leadColumnId || ""} disabled={moving} onChange={event => void moveLead(event.target.value)}><option value="" disabled>Selecciona columna</option>{columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>}
    {chat && <div className="chat-overflow"><button className="delete-chat-button" type="button" aria-expanded={chatMenuOpen} onClick={() => setChatMenuOpen(value => !value)}>Eliminar conversación</button>{chatMenuOpen && <div><button type="button" onClick={() => { setChatMenuOpen(false); onDeleteConversation(); }}>Confirmar borrar conversación</button></div>}</div>}
  </div>;
  return <>
    <section className="panel compact-chat-panel">
      <header className="chat-header">
        {(onMobileBack || onClose) && <button className="mobile-chat-control" type="button" aria-label="Volver a conversaciones" onClick={onMobileBack || onClose}><ChatIcon name="back" /></button>}
        <b className="avatar has-channel-badge">{chat ? initials(contactName(chat)) : "M"}{chat && <ChannelBadge contact={chat} />}</b>
        <div className="chat-title"><h2><span className="chat-title-name">{chat ? contactName(chat) : "Merlyn Seller"}</span>{chat && props.onQuoteBundleChange && <QuoteBundlePicker key={chat.id} value={chatQuoteBundle(chat)} onChange={props.onQuoteBundleChange} />}</h2><small>{chat ? contactDetail(chat) : "Tu espacio de atención al cliente"}</small></div>
        {chat && <div className="inbox-chat-header-actions">
          <div className="inbox-options-anchor" ref={inventoryRef}>
            <button className="inbox-icon-button inbox-inventory-trigger" type="button" title="Buscar disponibilidad en inventario" aria-label="Buscar disponibilidad en inventario" aria-expanded={inventoryOpen} onClick={() => setInventoryOpen(value => !value)}><ChatIcon name="inventory" /><span>Inventario</span></button>
            {inventoryOpen && !mobile && <div className="inbox-options-popover inventory-quick-popover" role="dialog" aria-label="Disponibilidad de inventario" onKeyDown={event => { if (event.key === "Escape") setInventoryOpen(false); }}>
              <p className="inbox-options-title">Disponibilidad</p>
              <InventoryQuickSearch onInsert={text => { onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${text}` : text); setInventoryOpen(false); }} />
            </div>}
          </div>
          <button className="inbox-icon-button inbox-quote-trigger" type="button" title="Cotizar envío" aria-label="Cotizar envío" aria-expanded={quoteOpen} onClick={() => { setInventoryOpen(false); setToolsOpen(false); if (!quoteOpen) setToolsCollapsed(true); setQuoteOpen(value => !value); }}><ChatIcon name="quote" /><span>Cotizar</span></button>
          {!onClose && <button className="inbox-icon-button inbox-tools-trigger" type="button" ref={toolsToggle} title="Herramientas del chat" aria-label="Herramientas del chat" aria-expanded={mobile ? toolsOpen : !toolsCollapsed} aria-controls={toolsId} onClick={() => { setQuoteOpen(false); if (mobile) setToolsOpen(value => !value); else setToolsCollapsed(value => !value); }}><ChatIcon name="tools" /><span>Herramientas</span></button>}
          <div className="inbox-options-anchor" ref={optionsRef}>
            <button className="inbox-icon-button" type="button" ref={optionsToggle} title="Opciones de conversación" aria-label="Opciones de conversación" aria-expanded={optionsOpen} aria-controls={optionsId} onClick={() => setOptionsOpen(value => !value)}><ChatIcon name="more" /></button>
            {optionsOpen && !mobile && <div id={optionsId} className="inbox-options-popover" onKeyDown={event => { if (event.key === "Escape") { setOptionsOpen(false); optionsToggle.current?.focus(); } }}>{conversationOptions}</div>}
          </div>
        </div>}
        {onClose && <button className="close-conversation" type="button" aria-label="Cerrar conversación" onClick={onClose}><ChatIcon name="close" /></button>}
      </header>
      {notice && <p className="inbox-chat-notice" role="status" {...noticeHover}>{notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><ChatIcon name="close" /></button></p>}
      <div className="thread" ref={threadRef} role="log" aria-label="Mensajes de la conversación" aria-live="polite" aria-relevant="additions">
        {!chat && <div className="empty inbox-chat-empty"><div className="inbox-empty-illustration"><ChatIcon name="chat" /></div><h2>Tu próximo cliente está a un mensaje</h2><p>Selecciona un chat para conversar, compartir tu catálogo y preparar la venta.</p><span>Mensajes · Catálogos · Ventas · Envíos</span></div>}
        {chat && messages.length === 0 && <div className="inbox-thread-empty"><p>Inicia la conversación</p><small>Escribe un mensaje o comparte un catálogo desde las herramientas.</small></div>}
        {messages.map((message, index) => <Fragment key={message.id}>
          {(index === 0 || messageDayKey(message.created_at) !== messageDayKey(messages[index - 1].created_at)) && <div className="inbox-day-separator"><span>{messageDayLabel(message.created_at)}</span></div>}
          {isLocalMessage(message) ? <article className={`outbound local-outgoing ${message.status}`}>
            {renderContent(message)}
            <div className="message-meta">
              {message.status === "failed"
                ? <span className="local-outgoing-failed" role="alert"><b>! No se envió</b>{message.error_code && <small>{message.error_code}</small>}<span><button type="button" onClick={() => outgoingActions?.retry(message.id.slice(LOCAL_PREFIX.length))}>Reintentar</button><button type="button" onClick={() => outgoingActions?.discard(message.id.slice(LOCAL_PREFIX.length))}>Descartar</button></span></span>
                : <small className="local-outgoing-status"><span className="delivery pending" aria-hidden="true">◷</span> {message.type === "image" ? "Enviando foto…" : message.type === "video" ? progressLabel(message.localProgress) : "Enviando…"}</small>}
            </div>
          </article> : <article className={message.direction} id={`message-${message.id}`}>
            {message.direction === "inbound" && <AdReferralCard referral={message.referral} />}
            {message.replyToMessageId && (() => { const thumb = quotedThumbnailKind(message.replyToType, message.replyToHasMedia); const src = `${api}/conversations/${chat?.id}/messages/${message.replyToMessageId}/media`; return <button type="button" className={`quoted-message${thumb ? " has-thumb" : ""}`} title="Ir al mensaje original" onClick={() => jumpToMessage(message.replyToMessageId!)}><span className="quoted-text"><b>{message.replyToDirection === "inbound" ? chat?.name || "Cliente" : "Tú"}</b><span>{quotedLabel(message.replyToType, message.replyToBody, message.replyToFilename)}</span></span>{thumb === "image" && <img className="quoted-thumb" src={src} alt="Foto respondida" loading="lazy" />}{thumb === "video" && <video className="quoted-thumb" src={src} muted playsInline preload="metadata" aria-label="Video respondido" />}</button>; })()}
            {renderContent(message)}
            {message.reactions?.length ? <div className="message-reactions">{message.reactions.map(reaction => <span key={`${reaction.actorDirection}-${reaction.emoji}`}>{reaction.emoji}</span>)}</div> : null}
            {message.direction === "inbound" && !message.deletedForEveryone && <div className="message-reaction-picker">{reactionEmojis.map(emoji => <button key={emoji} type="button" aria-label={`Reaccionar ${emoji}`} onClick={() => void onReact(message.id, emoji)}>{emoji}</button>)}</div>}
            <div className="message-meta">
              <small><time dateTime={message.created_at}>{messageTime(message.created_at)}</time></small>
              {message.direction === "outbound" && <span className={`delivery ${message.status}`} title={deliveryLabel(message.status)} aria-label={deliveryLabel(message.status)}>{message.status === "read" || message.status === "delivered" ? "✓✓" : message.status === "sent" ? "✓" : message.status === "failed" ? "!" : "◷"}</span>}
              <button type="button" className="reply-button" aria-label="Responder mensaje" onClick={() => onReplyToChange(message)}>↩</button>
              <button type="button" className="message-more-button" aria-label="Opciones del mensaje" aria-expanded={menuId === message.id} onClick={() => setMenuId(value => value === message.id ? null : message.id)}>⋮</button>
              {menuId === message.id && (mobile ? <MobileChatSheet title="Opciones del mensaje" onClose={() => setMenuId(null)}>
                <div className="mobile-message-actions">
                  <button type="button" onClick={() => { onReplyToChange(message); setMenuId(null); }}>Responder</button>
                  {message.direction === "inbound" && !message.deletedForEveryone && <div className="mobile-message-reactions">{reactionEmojis.map(emoji => <button type="button" key={emoji} aria-label={`Reaccionar ${emoji}`} onClick={() => { void onReact(message.id, emoji); setMenuId(null); }}>{emoji}</button>)}</div>}
                  <button type="button" onClick={() => void deleteMessage(message, "for_me")}>Eliminar para mí</button>
                  {message.direction === "outbound" && !message.deletedForEveryone && <button type="button" onClick={() => void deleteMessage(message, "for_everyone")}>Eliminar para todos</button>}
                </div>
              </MobileChatSheet> : <div className="message-delete-menu">
                <button type="button" onClick={() => { onReplyToChange(message); setMenuId(null); }}>Responder</button>
                <button type="button" onClick={() => void deleteMessage(message, "for_me")}>Eliminar para mí</button>
                {message.direction === "outbound" && !message.deletedForEveryone && <button type="button" onClick={() => void deleteMessage(message, "for_everyone")}>Eliminar para todos</button>}
              </div>)}
            </div>
            <IntentLearner message={message} intents={automationIntents} onLearn={onLearnIntent} />
          </article>}
        </Fragment>)}
      </div>
      {inventoryOpen && mobile && <MobileChatSheet title="Disponibilidad" onClose={() => setInventoryOpen(false)}><InventoryQuickSearch autoFocus={false} onInsert={text => { onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${text}` : text); setInventoryOpen(false); }} /></MobileChatSheet>}
      {bundlePickerOpen && <div className="bundle-picker-backdrop" onMouseDown={() => setBundlePickerOpen(false)}><section className="bundle-picker-modal" role="dialog" aria-modal="true" aria-label="Enviar bundle" onMouseDown={event => event.stopPropagation()}><header><h2>Enviar bundle</h2><button type="button" aria-label="Cerrar selección de bundles" onClick={() => setBundlePickerOpen(false)}>×</button></header>{bundles.map(item => <label key={item.id}><input type="checkbox" checked={bundleIds.includes(item.id)} onChange={() => setBundleIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /> {item.name} · {item.images.length} fotografías</label>)}<footer><button type="button" className="plain-button" onClick={() => setBundlePickerOpen(false)}>Cancelar</button><button type="button" disabled={!bundleIds.length} onClick={() => void submitBundles()}>Enviar fotografías</button></footer></section></div>}
      <div className="chat-compose-area">
        <form className="composer compact-composer" onSubmit={(event) => void submitComposer(event)}>
          {replyToMessage && <div className="reply-preview"><div><b>Respondiendo a {replyToMessage.direction === "inbound" ? chat?.name || "cliente" : "ti"}</b><span>{quotedLabel(replyToMessage.type, replyToMessage.body, replyToMessage.filename)}</span></div>{replyToMessage.media_id && (replyToMessage.type === "image" || replyToMessage.type === "sticker") && <img className="quoted-thumb" src={mediaUrl(replyToMessage)} alt="Foto a la que respondes" />}{replyToMessage.media_id && replyToMessage.type === "video" && <video className="quoted-thumb" src={mediaUrl(replyToMessage)} muted playsInline preload="metadata" />}<button type="button" aria-label="Cancelar respuesta" onClick={() => onReplyToChange(null)}>×</button></div>}
          {replyImageIds.length > 0 && <div className="composer-image-previews reply-image-previews">{replyImageIds.map(id => { const image = savedImage(id); return <figure key={id}><img src={`${api}/settings/entrepreneur-packages/images/${id}/media`} alt={image?.filename || image?.setName || "Imagen guardada"} /><button type="button" aria-label="Quitar imagen" onClick={() => setReplyImageIds(current => current.filter(value => value !== id))}>×</button><figcaption>{image?.setName || "Imagen guardada"}</figcaption></figure>; })}</div>}
          {pendingImages.length > 0 && <div className="composer-image-previews">{pendingImages.map(image => <figure key={image.id}><img src={image.previewUrl} alt={image.file.name} /><button type="button" aria-label={`Quitar imagen ${image.file.name}`} onClick={() => onRemovePendingImage(image.id)}>×</button><figcaption>{image.file.name}</figcaption></figure>)}</div>}
          <div className="composer-tools">
            <button className="composer-tools-button" aria-label="Adjuntar archivos y abrir herramientas" aria-expanded={toolsOpen} type="button" disabled={!chat} onClick={() => setToolsOpen(value => !value)}><ChatIcon name="attach" /></button>
            {toolsOpen && !mobile && <div className="composer-tools-popover">
              <button type="button" onClick={() => { setToolsOpen(false); setTab("share"); setToolsCollapsed(false); }}>▤ Catálogo y herramientas</button>
              <div className="composer-emoji-picker">{composerEmojis.map(emoji => <button key={emoji} type="button" aria-label={`Agregar ${emoji}`} onClick={() => { onDraftChange(`${draft}${emoji}`); setToolsOpen(false); }}>{emoji}</button>)}</div>{attachTools}
            </div>}
          </div>
          <textarea aria-label="Mensaje" rows={1} disabled={!chat} value={draft} onChange={event => { onDraftChange(event.target.value); event.currentTarget.style.height = "44px"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }} onKeyDown={event => { if (!mobile && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && (draft.trim() || pendingImages.length || replyImageIds.length)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={chat ? pendingImages.length ? "Agrega un texto para las imágenes (opcional)…" : "Escribe un mensaje…" : "Selecciona una conversación"} />
          {quickMatches.length > 0 && <div className="quick-reply-suggestions">{quickMatches.map(reply => <button key={reply.id} type="button" onClick={() => chooseQuickReply(reply)}><code>{reply.shortcut}</code><span><b>{reply.name}</b><small>{reply.imageIds?.length ? `📷 ${reply.imageIds.length} · ` : ""}{reply.body}</small></span></button>)}</div>}
          <label className={uploadingAudio ? "audio-upload loading" : "audio-upload"} title={uploadingAudio ? "Subiendo audio" : "Adjuntar audio"}>{uploadingAudio ? <span aria-label="Subiendo audio">…</span> : <ChatIcon name="audio" />}<input type="file" aria-label="Adjuntar audio" accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,audio/opus" onChange={onUploadAudio} disabled={!chat || uploadingAudio} /></label>
          <button disabled={!chat || (!draft.trim() && !pendingImages.length && !replyImageIds.length)} className="send" aria-label="Enviar mensaje"><ChatIcon name="send" /></button>
        </form>
        {chat && (shortcutSets.length > 0 || videoShortcuts.length > 0 || quickButtons.config.invitation || quickButtons.config.imageButtons.length > 0) && <div className="composer-shortcuts" role="group" aria-label="Botones rápidos y atajos"><QuickButtonsRow chatId={chat.id} store={quickButtons} imageSets={images} onSendSet={(packageId) => onSendEntrepreneurPackages({ packageIds: [packageId] })} onNotice={setNotice} />{videoShortcuts.map((video) => <button key={video.id} type="button" disabled={Boolean(sendingShortcut)} title={`Enviar el video «${video.name}»`} onClick={() => void sendVideoShortcut(video)}>{sendingShortcut === video.id ? "Enviando…" : <>🎬 {video.name}</>}</button>)}{shortcutSets.map((set) => <button key={set.id} type="button" disabled={Boolean(sendingShortcut)} title={`Enviar las ${set.images.length} fotos de «${set.name}»`} onClick={() => void sendShortcut(set)}>{sendingShortcut === set.id ? "Enviando…" : <>▦ {set.name} <small>{set.images.length}</small></>}</button>)}</div>}
        <AudioRecorder disabled={!chat || uploadingAudio} onSend={onRecordAudio} />
      </div>
    </section>
    {!mobile && !onClose && !toolsCollapsed && props.inboxLayout && <button className="inbox-tools-scrim" type="button" aria-label="Cerrar herramientas del chat" onClick={() => setToolsCollapsed(true)} />}
    {!mobile && !onClose && tools}
    {mobile && optionsOpen && <MobileChatSheet title="Opciones de conversación" onClose={() => setOptionsOpen(false)}>{conversationOptions}</MobileChatSheet>}
    {mobile && toolsOpen && <MobileChatSheet title="Compartir y vender" onClose={() => setToolsOpen(false)}>{attachTools}<label className="mobile-audio-file">Adjuntar audio<input type="file" accept="audio/*" onChange={onUploadAudio} disabled={!chat || uploadingAudio} /></label>{tools}</MobileChatSheet>}
    {shippingOpen && chat && <ChatShippingModal key={chat.id} chat={chat} onClose={() => setShippingOpen(false)} />}
    {quoteOpen && chat && !mobile && <>
      <button className="quote-drawer-scrim" type="button" aria-label="Cerrar cotizador" onClick={() => setQuoteOpen(false)} />
      <aside className="quote-drawer" aria-label="Cotizador de envío" onKeyDown={event => { if (event.key === "Escape") setQuoteOpen(false); }}>
        <header><div><p>COTIZADOR</p><h2>Cotizar envío</h2><span>{contactName(chat)}</span></div><button type="button" aria-label="Cerrar cotizador" onClick={() => setQuoteOpen(false)}><ChatIcon name="close" /></button></header>
        <QuoteDrawer key={chat.id} chat={chat} onQuoteBundleChange={props.onQuoteBundleChange} onInsert={text => onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${text}` : text)} />
      </aside>
    </>}
    {quoteOpen && chat && mobile && <MobileChatSheet title="Cotizar envío" onClose={() => setQuoteOpen(false)}><QuoteDrawer key={chat.id} chat={chat} onQuoteBundleChange={props.onQuoteBundleChange} onInsert={text => { onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${text}` : text); setQuoteOpen(false); }} /></MobileChatSheet>}
    {saleModalOpen && chat && <ChatSaleModal chat={chat} onClose={() => setSaleModalOpen(false)} onSaved={async () => undefined} />}
  </>;
}
