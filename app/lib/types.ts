export type Chat = {
  id: string;
  contactId?: string;
  phone_number: string;
  name: string | null;
  /** WhatsApp, Messenger o Instagram. En Messenger/Instagram phone_number es «fb:…»/«ig:…». */
  channel?: "whatsapp" | "messenger" | "instagram";
  username?: string | null;
  last_message: string | null;
  updated_at: string;
  /** Hora del último mensaje enviado o recibido. */
  lastMessageAt?: string | null;
  /** Ya no se usa: el fijado se quitó (siempre null). */
  columnPinnedAt?: string | null;
  columnPinnedRule?: string | null;
  unreadCount: number;
  leadColumnId?: string;
  lastDirection?: "inbound" | "outbound" | null;
  needsResponse?: boolean;
  autoReplyEnabled?: boolean;
  scenarioEnabled?: boolean;
  /** Paquete (bundle de Control) con el que abre el cotizador del chat; lo fija el escenario o la persona. */
  quoteBundleId?: string | null;
  quoteBundleName?: string | null;
};

export type AutomationIntent = { id: string; key: string; name: string; responseBody: string | null; action: "text" | "send_catalog" | "send_shipping_info"; examples: string[]; isActive: boolean; priority: number };

export type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_id: string | null;
  filename?: string | null;
  type: string;
  status: string;
  deletedForEveryone?: boolean;
  error_code?: string | null;
  created_at: string;
  /** Vista previa local de una foto que todavía se está enviando. */
  localPreviewUrl?: string;
  /** Avance de subida de un video que todavía se está enviando. */
  localProgress?: { phase: string; fraction: number };
  replyToMessageId?: string | null;
  replyToBody?: string | null;
  replyToType?: string | null;
  replyToDirection?: "inbound" | "outbound" | null;
  /** El mensaje respondido tiene foto/video/archivo (para mostrar su miniatura en la cita). */
  replyToHasMedia?: boolean;
  replyToFilename?: string | null;
  reactions?: { emoji: string; actorDirection: "inbound" | "outbound" }[];
  referral?: {
    sourceUrl?: string;
    sourceId?: string;
    sourceType?: string;
    headline?: string;
    body?: string;
    mediaType?: string;
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    ctwaClid?: string;
  } | null;
  messageMetadata?: {
    contacts?: { name?: string; phones?: { phone?: string; waId?: string; type?: string }[]; emails?: string[] }[];
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    /** Mensaje cuyo contenido WhatsApp no comparte con apps de empresa (encuesta, mensaje editado, álbum…). */
    unsupported?: { type?: string; code?: number; title?: string; details?: string };
    order?: { catalogId?: string; items?: { retailerId?: string; quantity?: number; itemPrice?: number; currency?: string }[] };
    button?: { text?: string; payload?: string };
    interactive?: { kind?: "button" | "list" | "flow"; id?: string; title?: string; description?: string; name?: string; body?: string; responseJson?: string };
    system?: { body?: string; type?: string; newWaId?: string };
  } | null;
};

export type CtaUrlMessage = {
  header?: string;
  headerImageUrl?: string;
  body: string;
  footer?: string;
  buttonText: string;
  url: string;
};
export type CtaUrlTemplate = CtaUrlMessage & {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};
export type InteractiveOptionsFormat = "auto" | "buttons" | "list";
export type InteractiveOption = { id?: string; title: string; description?: string };
export type InteractiveOptionsMessage = {
  format?: InteractiveOptionsFormat;
  header?: string;
  body: string;
  footer?: string;
  buttonText?: string;
  sectionTitle?: string;
  options: InteractiveOption[];
};
export type InteractiveOptionsTemplate = InteractiveOptionsMessage & {
  id: string;
  name: string;
  format: "buttons" | "list";
  created_at: string;
  updated_at: string;
};
export type WhatsAppTemplateVariable = { component: "body" | "header"; position: number };
export type WhatsAppTemplateMapping = { component: "body" | "header"; position: number; source: "contact.name" | "contact.phone" | "fixed" | "manual"; value?: string; label?: string };
export type WhatsAppTemplate = { id: string; metaTemplateId: string; name: string; language: string; status: string; category: string | null; components: { type: string; text?: string }[]; variables: WhatsAppTemplateVariable[]; mappings: WhatsAppTemplateMapping[]; updatedAt: string };

export type LeadColumn = { id: string; name: string; position: number; leads: Chat[]; /** Leads ya cargados (sin el filtro local), para pedir la siguiente página. */ loadedCount?: number; boardId?: string; boardName?: string; shortName?: string; leadCount?: number; scenariosPaused?: number };
/** Multi dashboard: un dashboard por producto y zona, con contadores ligeros de sus columnas. */
export type BoardColumnSummary = { id: string; name: string; position: number; boardId: string; leadCount: number; scenariosPaused: number; unreadLeads: number };
export type LeadBoardSummary = { id: string; name: string; product: string | null; zone: string | null; position: number; isDefault: boolean; leadCount: number; unreadLeads: number; columns: BoardColumnSummary[] };
export type User = { email: string; role: string };
export type RemarketingPreset = { id: string; name: string; body: string | null; mediaId: string | null; filename: string | null; updated_at: string };
export type DocumentOption = { mediaId: string; filename: string; caption: string | null; created_at: string };
export type DocumentTemplate = { id: string; mediaId: string; filename: string; caption: string | null; isCatalog: boolean; created_at: string; updated_at: string };
export type EntrepreneurPackageImage = { id: string; mediaId: string; filename: string | null; caption: string | null; position: number };
export type EntrepreneurPackage = { id: string; name: string; mediaId: string | null; filename: string | null; caption: string | null; bundleType?: string | null; imageCategory?: string | null; controlBundleId?: number | null; /** Botón de atajo debajo del cuadro de texto del chat. */ chatShortcut?: boolean; position: number; created_at: string; updated_at: string; images: EntrepreneurPackageImage[] };
export type QuickReply = { id: string; shortcut: string; name: string; body: string; kind: "text" | "cta_url"; ctaUrlTemplateId?: string | null; /** Fotos de Imágenes guardadas que se envían con el texto. */ imageIds?: string[]; created_at: string; updated_at: string };
export type SavedSticker = { id: string; name: string; mediaId: string; filename: string | null; position: number; created_at: string };
export type ConversationFilter = "all" | "unread" | "needs-response" | `column:${string}` | "channel:whatsapp" | "channel:messenger" | "channel:instagram";
export type ScenarioBranch = { id: string; name: string; aiDescription?: string; examples: string[]; nextStepId: string };
export type ScenarioMedia = { mediaId: string; filename?: string; caption?: string; type?: "image" | "document" | "video" };
/** Imagen de un producto con «Tallas disponibles: …» calculadas con el inventario al enviar. Sin mediaId usa la foto del E-commerce. */
/** Video de «Videos guardados» en un paso; caption opcional = mensaje junto al video. */
export type ScenarioSavedVideo = { videoId: string; caption?: string; label?: string };
export type ScenarioProductImage = { productId: number; mediaId?: string; caption?: string; label?: string };
export type ScenarioBudgetOption = { id: string; label: string; min?: number; max?: number; examples?: string[]; packageIds: string[]; items?: ScenarioMedia[]; recommendationBody: string };
export type ScenarioOption = InteractiveOption & { nextStepId?: string };
export type ScenarioStep = { id: string; type: "send_text" | "send_catalog" | "send_media" | "wait_reply" | "send_options" | "budget_recommendation" | "move_column" | "end"; label: string; channels?: ("whatsapp" | "messenger" | "instagram")[]; body?: string; header?: string; footer?: string; format?: InteractiveOptionsFormat; buttonText?: string; sectionTitle?: string; options?: ScenarioOption[]; caption?: string; fallbackBody?: string; resendCatalog?: boolean; items?: ScenarioMedia[]; products?: ScenarioProductImage[]; packageIds?: string[]; savedVideos?: ScenarioSavedVideo[]; branches?: ScenarioBranch[]; budgetOptions?: ScenarioBudgetOption[]; fallbackStepId?: string; nextStepId?: string; columnId?: string };
export type AutomationScenario = { id: string; key: string; name: string; isActive: boolean; triggerExamples: string[]; aiDescription?: string | null; priority: number; canInterrupt: boolean; position: number; steps: ScenarioStep[]; updatedAt: string; quoteBundle?: QuoteBundleRef | null; /** Solo lo inicia una respuesta a esta plantilla de Meta. */ templateTrigger?: { templateId: string; templateName: string } | null; /** Campaña para agrupar en la lista (p. ej. «Campaña 120»). */ campaign?: string | null };
/** Bundle de Control elegido para cotizar (se guarda su nombre para mostrarlo sin consultar Control). */
export type QuoteBundleRef = { id: string; name: string };
