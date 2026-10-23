import { ChangeEvent, FormEvent, useId, useRef, useState } from "react";
import { initials } from "../lib/format";
import { filterInboxContacts, inboxTimestamp } from "../lib/inbox-presentation";
import { ChatIcon } from "./ChatIcon";
import type {
  AutomationIntent,
  Chat,
  ConversationFilter,
  CtaUrlMessage,
  DocumentOption,
  EntrepreneurPackage,
  LeadColumn,
  Message,
  QuickReply,
  SavedSticker,
} from "../lib/types";
import { ConversationPanel, type PendingChatImage } from "./ConversationPanel";
import { InternalChatPanel, InternalChatRow, useInternalUnread } from "./InternalChat";

type Props = {
  chats: Chat[];
  columns: LeadColumn[];
  filter: ConversationFilter;
  chat: Chat | null;
  messages: Message[];
  number: string;
  draft: string;
  uploadingAudio: boolean;
  uploadingMedia: boolean;
  pendingImages: PendingChatImage[];
  documentOptions: DocumentOption[];
  selectedDocumentId: string;
  documentCaption: string;
  entrepreneurPackages: EntrepreneurPackage[];
  quickReplies: QuickReply[];
  stickers: SavedSticker[];
  onNumberChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onSendQuickReplyCta: (templateId: string) => Promise<void>;
  onCreate: (event: FormEvent) => void;
  onOpen: (chat: Chat) => void;
  onFilterChange: (filter: ConversationFilter) => void;
  onSendText: (event: FormEvent) => void;
  replyToMessage: Message | null;
  onReplyToChange: (message: Message | null) => void;
  onUploadAudio: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadVideo: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadDocument: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingImage: (id: string) => void;
  onDocumentChange: (mediaId: string) => void;
  onDocumentCaptionChange: (caption: string) => void;
  onSendDocument: () => void;
  onSendCtaUrl: (data: CtaUrlMessage) => Promise<void>;
  onSendEntrepreneurPackages: (selection: { packageIds?: string[]; imageIds?: string[] }) => Promise<void>;
  onRecordAudio: (audio: Blob, filename: string) => Promise<void>;
  onSendSticker: (stickerId: string) => Promise<void>;
  onAutoReplyChange: (enabled: boolean) => void;
  onScenarioChange: (enabled: boolean) => void;
  automationIntents: AutomationIntent[];
  onLearnIntent: (messageId: string, intentId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onDeleteMessage: (messageId: string, scope: "for_me" | "for_everyone") => Promise<void>;
  onMoveLead: (columnId: string) => Promise<void>;
  onOpenShipping: () => void;
  onDeleteConversation: () => void;
};

export function Inbox({
  chats,
  columns,
  filter,
  chat,
  messages,
  number,
  draft,
  uploadingAudio,
  uploadingMedia,
  pendingImages,
  documentOptions,
  selectedDocumentId,
  documentCaption,
  entrepreneurPackages,
  quickReplies,
  stickers,
  onNumberChange,
  onDraftChange,
  onSendQuickReplyCta,
  onCreate,
  onOpen,
  onFilterChange,
  onSendText,
  replyToMessage,
  onReplyToChange,
  onUploadAudio,
  onUploadImage,
  onUploadVideo,
  onUploadDocument,
  onRemovePendingImage,
  onDocumentChange,
  onDocumentCaptionChange,
  onSendDocument,
  onSendCtaUrl,
  onSendEntrepreneurPackages,
  onRecordAudio,
  onSendSticker,
  onAutoReplyChange,
  onScenarioChange,
  automationIntents,
  onLearnIntent,
  onReact,
  onDeleteMessage,
  onMoveLead,
  onOpenShipping,
  onDeleteConversation,
}: Props) {
  const [mobileConversation, setMobileConversation] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalUnread] = useInternalUnread(internalOpen);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const newNumber = useRef<HTMLInputElement>(null);
  const filterToggle = useRef<HTMLButtonElement>(null);
  const newChatToggle = useRef<HTMLButtonElement>(null);
  const filtersId = useId();
  const newChatId = useId();
  const visibleChats = filterInboxContacts(chats, search);
  const columnFilter = filter.startsWith("column:") ? columns.find(column => `column:${column.id}` === filter) : null;
  return (
    <>
      <div className="mobile-inbox-state" data-conversation={mobileConversation && (internalOpen || Boolean(chat))} />
      <section className="list inbox-list" aria-label="Conversaciones">
        <header>
          <div>
            <p>MERLYN SELLER</p>
            <h2>Chats <span className="inbox-chat-count">{chats.length}</span></h2>
          </div>
          <div className="inbox-header-actions">
          <button ref={newChatToggle} className="inbox-icon-button inbox-new-chat-toggle" type="button" title="Nueva conversación" aria-label="Nueva conversación" aria-expanded={newChatOpen} aria-controls={newChatId} onClick={() => { setNewChatOpen(open => !open); if (!newChatOpen) requestAnimationFrame(() => newNumber.current?.focus()); }}><ChatIcon name="new" /></button>
          <button
            ref={filterToggle}
            className="inbox-icon-button mobile-inbox-filter-toggle"
            type="button"
            aria-label={filter !== "all" || search ? "Filtros de conversaciones (activos)" : "Filtros de conversaciones"}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen(open => !open)}
          >
            <ChatIcon name="filter" />
            {(filter !== "all" || search) && <span className="inbox-filter-active-dot" />}
          </button>
          </div>
        </header>
        <div className="inbox-search"><ChatIcon name="search" /><input aria-label="Buscar conversación" placeholder="Buscar nombre o teléfono" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")}><ChatIcon name="close" /></button>}</div>
        <div className="inbox-quick-filters" aria-label="Filtros rápidos">
          {([['all', 'Todos'], ['unread', 'No leídos'], ['needs-response', 'Pendientes']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => onFilterChange(value)}>{label}</button>)}
        </div>
        <div id={filtersId} className="inbox-filter-menu" data-open={filtersOpen} onKeyDown={event => { if (event.key === "Escape") { setFiltersOpen(false); filterToggle.current?.focus(); } }}>
        <div className="inbox-filter">
          <select
            value={filter}
            onChange={(event) =>
              onFilterChange(event.target.value as ConversationFilter)
            }
            aria-label="Filtrar conversaciones"
          >
            <option value="all">Todos</option>
            <option value="unread">No leídos</option>
            <option value="needs-response">Pendientes de respuesta</option>
            {columns.map((column) => (
              <option key={column.id} value={`column:${column.id}`}>
                Columna: {column.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mobile-inbox-filter-actions">
          <button type="button" disabled={filter === "all" && !search} onClick={() => { setSearch(""); onFilterChange("all"); }}>Limpiar filtros</button>
          <button type="button" onClick={() => setFiltersOpen(false)}>Ver conversaciones</button>
        </div>
        </div>
        <form id={newChatId} className="inbox-new-chat" hidden={!newChatOpen} onSubmit={onCreate} onKeyDown={event => { if (event.key === "Escape") { setNewChatOpen(false); newChatToggle.current?.focus(); } }}>
          <label htmlFor={`${newChatId}-number`}>Iniciar conversación</label>
          <input
            ref={newNumber}
            id={`${newChatId}-number`}
            value={number}
            onChange={(event) => onNumberChange(event.target.value)}
            placeholder="Número con código de país"
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <button type="submit">Abrir chat</button>
        </form>
        {columnFilter && <div className="inbox-current-filter"><span>{columnFilter.name}</span><button type="button" aria-label="Quitar filtro de columna" onClick={() => onFilterChange("all")}><ChatIcon name="close" /></button></div>}
        <div className="rows">
          {(!search.trim() || "recordatorios".includes(search.trim().toLowerCase())) && <InternalChatRow active={internalOpen} unread={internalUnread} onOpen={() => { setInternalOpen(true); setMobileConversation(true); setFiltersOpen(false); setNewChatOpen(false); }} />}
          {visibleChats.length === 0 && (
            <div className="inbox-list-empty"><ChatIcon name="chat" /><strong>{search ? "Sin resultados" : "No hay conversaciones"}</strong><p>{search ? "Prueba con otro nombre o número de teléfono." : "Selecciona otro filtro o inicia una conversación."}</p></div>
          )}
          {visibleChats.map((item) => (
            <button
              type="button"
              aria-current={!internalOpen && item.id === chat?.id ? "true" : undefined}
              onClick={() => { setInternalOpen(false); onOpen(item); setMobileConversation(true); setFiltersOpen(false); setNewChatOpen(false); }}
              className={`${!internalOpen && item.id === chat?.id ? "row active" : "row"}${item.unreadCount > 0 ? " has-unread" : ""}`}
              key={item.id}
            >
              <b>{initials(item.name || item.phone_number)}</b>
              <span className="inbox-contact-copy"><strong>{item.name || item.phone_number}</strong><small>{item.lastDirection === "outbound" && <span aria-label="Tu último mensaje">Tú: </span>}{item.last_message || "Sin mensajes aún"}</small></span>
              <span className="inbox-row-meta"><time dateTime={item.updated_at}>{inboxTimestamp(item.updated_at)}</time>
              {item.unreadCount > 0 && (
                <b
                  className="unread-badge"
                  aria-label={`${item.unreadCount} mensajes pendientes`}
                >
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </b>
              )}
              {item.needsResponse && <span className="inbox-needs-response" title="Pendiente de respuesta" aria-label="Pendiente de respuesta" />}
              </span>
            </button>
          ))}
        </div>
      </section>
      {internalOpen ? <InternalChatPanel onMobileBack={() => setMobileConversation(false)} /> : <ConversationPanel
        inboxLayout
        onMobileBack={() => setMobileConversation(false)}
        chat={chat}
        messages={messages}
        draft={draft}
        uploadingAudio={uploadingAudio}
        uploadingMedia={uploadingMedia}
        pendingImages={pendingImages}
        documentOptions={documentOptions}
        selectedDocumentId={selectedDocumentId}
        documentCaption={documentCaption}
        entrepreneurPackages={entrepreneurPackages}
        quickReplies={quickReplies}
        stickers={stickers}
        onDraftChange={onDraftChange}
        onSendQuickReplyCta={onSendQuickReplyCta}
        onSendText={onSendText}
        replyToMessage={replyToMessage}
        onReplyToChange={onReplyToChange}
        onUploadAudio={onUploadAudio}
        onUploadImage={onUploadImage}
        onUploadVideo={onUploadVideo}
        onUploadDocument={onUploadDocument}
        onRemovePendingImage={onRemovePendingImage}
        onDocumentChange={onDocumentChange}
        onDocumentCaptionChange={onDocumentCaptionChange}
        onSendDocument={onSendDocument}
        onSendCtaUrl={onSendCtaUrl}
        onSendEntrepreneurPackages={onSendEntrepreneurPackages}
        onRecordAudio={onRecordAudio}
        onSendSticker={onSendSticker}
        onAutoReplyChange={onAutoReplyChange}
        onScenarioChange={onScenarioChange}
        automationIntents={automationIntents}
        onLearnIntent={onLearnIntent}
        onReact={onReact}
        onDeleteMessage={onDeleteMessage}
        columns={columns}
        onMoveLead={onMoveLead}
        onOpenShipping={onOpenShipping}
        onDeleteConversation={onDeleteConversation}
      />}
    </>
  );
}
