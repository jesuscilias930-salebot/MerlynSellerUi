export type Chat = {
  id: string;
  contactId?: string;
  phone_number: string;
  name: string | null;
  last_message: string | null;
  updated_at: string;
  unreadCount: number;
  leadColumnId?: string;
  lastDirection?: "inbound" | "outbound" | null;
  needsResponse?: boolean;
  autoReplyEnabled?: boolean;
  scenarioEnabled?: boolean;
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
  error_code?: string | null;
  created_at: string;
  replyToMessageId?: string | null;
  replyToBody?: string | null;
  replyToType?: string | null;
  replyToDirection?: "inbound" | "outbound" | null;
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
export type WhatsAppTemplateVariable = { component: "body" | "header"; position: number };
export type WhatsAppTemplateMapping = { component: "body" | "header"; position: number; source: "contact.name" | "contact.phone" | "fixed" | "manual"; value?: string; label?: string };
export type WhatsAppTemplate = { id: string; metaTemplateId: string; name: string; language: string; status: string; category: string | null; components: { type: string; text?: string }[]; variables: WhatsAppTemplateVariable[]; mappings: WhatsAppTemplateMapping[]; updatedAt: string };

export type LeadColumn = { id: string; name: string; position: number; leads: Chat[] };
export type User = { email: string; role: string };
export type RemarketingPreset = { id: string; name: string; body: string | null; mediaId: string | null; filename: string | null; updated_at: string };
export type DocumentOption = { mediaId: string; filename: string; caption: string | null; created_at: string };
export type DocumentTemplate = { id: string; mediaId: string; filename: string; caption: string | null; isCatalog: boolean; created_at: string; updated_at: string };
export type EntrepreneurPackageImage = { id: string; mediaId: string; filename: string | null; caption: string | null; position: number };
export type EntrepreneurPackage = { id: string; name: string; mediaId: string | null; filename: string | null; caption: string | null; bundleType?: string | null; imageCategory?: string | null; controlBundleId?: number | null; position: number; created_at: string; updated_at: string; images: EntrepreneurPackageImage[] };
export type QuickReply = { id: string; shortcut: string; name: string; body: string; kind: "text" | "cta_url"; ctaUrlTemplateId?: string | null; created_at: string; updated_at: string };
export type SavedSticker = { id: string; name: string; mediaId: string; filename: string | null; position: number; created_at: string };
export type ConversationFilter = "all" | "unread" | "needs-response" | `column:${string}`;
export type ScenarioBranch = { id: string; name: string; aiDescription?: string; examples: string[]; nextStepId: string };
export type ScenarioMedia = { mediaId: string; filename?: string; caption?: string; type?: "image" | "document" };
export type ScenarioBudgetOption = { id: string; label: string; min?: number; max?: number; examples?: string[]; packageIds: string[]; recommendationBody: string };
export type ScenarioStep = { id: string; type: "send_text" | "send_catalog" | "send_media" | "wait_reply" | "budget_recommendation" | "move_column" | "end"; label: string; body?: string; caption?: string; fallbackBody?: string; resendCatalog?: boolean; items?: ScenarioMedia[]; branches?: ScenarioBranch[]; budgetOptions?: ScenarioBudgetOption[]; fallbackStepId?: string; nextStepId?: string; columnId?: string };
export type AutomationScenario = { id: string; key: string; name: string; isActive: boolean; triggerExamples: string[]; aiDescription?: string | null; priority: number; canInterrupt: boolean; position: number; steps: ScenarioStep[]; updatedAt: string };
