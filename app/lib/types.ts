export type Chat = {
  id: string;
  phone_number: string;
  name: string | null;
  last_message: string | null;
  updated_at: string;
};

export type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_id: string | null;
  type: string;
  status: string;
  error_code?: string | null;
  created_at: string;
};

export type LeadColumn = { id: string; name: string; position: number; leads: Chat[] };
export type User = { email: string; role: string };
export type RemarketingPreset = { id: string; name: string; body: string | null; mediaId: string | null; filename: string | null; updated_at: string };
export type DocumentOption = { mediaId: string; filename: string; caption: string | null; created_at: string };
