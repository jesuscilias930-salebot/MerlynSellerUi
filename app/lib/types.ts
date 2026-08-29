export type Chat = {
  id: string;
  phone_number: string;
  name: string | null;
  last_message: string | null;
  updated_at: string;
  unreadCount: number;
  leadColumnId?: string;
  lastDirection?: "inbound" | "outbound" | null;
  needsResponse?: boolean;
  autoReplyEnabled?: boolean;

export type AutomationIntent = { id: string; key: string; name: string; responseBody: string | null; action: "text" | "send_catalog"; examples: string[]; isActive: boolean; priority: number };
};

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
};

export type LeadColumn = { id: string; name: string; position: number; leads: Chat[] };
export type User = { email: string; role: string };
export type RemarketingPreset = { id: string; name: string; body: string | null; mediaId: string | null; filename: string | null; updated_at: string };
export type DocumentOption = { mediaId: string; filename: string; caption: string | null; created_at: string };
export type ConversationFilter = "all" | "unread" | "needs-response" | `column:${string}`;
export type ScenarioBranch = { id: string; name: string; examples: string[]; nextStepId: string };
export type ScenarioMedia = { mediaId: string; filename?: string; caption?: string; type?: "image" | "document" };
export type ScenarioStep = { id: string; type: "send_text" | "send_catalog" | "send_media" | "wait_reply" | "move_column" | "end"; label: string; body?: string; caption?: string; items?: ScenarioMedia[]; branches?: ScenarioBranch[]; fallbackStepId?: string; nextStepId?: string; columnId?: string };
export type AutomationScenario = { id: string; key: string; name: string; isActive: boolean; triggerExamples: string[]; steps: ScenarioStep[]; updatedAt: string };
