export type ShippingAddress = {
  name: string; phone: string; street: string; city: string; state: string;
  country: string; postalCode: string; district?: string; number?: string;
  email?: string; interiorNumber?: string; references?: string;
};
export type ShippingParcel = {
  type: string; content: string; amount: string; declaredValue: string;
  weight: string; length: string; width: string; height: string;
};
export type ChatShippingDraft = {
  version: 1;
  conversationId: string;
  pastedInfo: string;
  destination: ShippingAddress;
  origin?: ShippingAddress;
  parcel?: ShippingParcel;
};
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const addressKeys = ["name", "phone", "street", "city", "state", "country", "postalCode"] as const;
const optionalAddressKeys = ["district", "number", "email", "interiorNumber", "references"] as const;
const parcelKeys = ["type", "content", "amount", "declaredValue", "weight", "length", "width", "height"] as const;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export const chatShippingDraftKey = (conversationId: string) => `merlynseller:chat-shipping-draft:v1:${encodeURIComponent(conversationId)}`;
const browserStorage = (): DraftStorage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};
function address(value: unknown): ShippingAddress | null {
  if (!record(value) || addressKeys.some(key => typeof value[key] !== "string")) return null;
  const result = Object.fromEntries(addressKeys.map(key => [key, value[key]])) as ShippingAddress;
  for (const key of optionalAddressKeys) if (typeof value[key] === "string") result[key] = value[key];
  return result;
}
function parcel(value: unknown): ShippingParcel | null {
  if (!record(value) || parcelKeys.some(key => typeof value[key] !== "string")) return null;
  return Object.fromEntries(parcelKeys.map(key => [key, value[key]])) as ShippingParcel;
}
export function readChatShippingDraft(conversationId: string, storage = browserStorage()): ChatShippingDraft | null {
  try {
    const raw = storage?.getItem(chatShippingDraftKey(conversationId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || value.conversationId !== conversationId || typeof value.pastedInfo !== "string") return null;
    const destination = address(value.destination);
    if (!destination) return null;
    const origin = address(value.origin);
    const storedParcel = parcel(value.parcel);
    return { version: 1, conversationId, pastedInfo: value.pastedInfo.slice(0, 10000), destination, ...(origin ? {origin} : {}), ...(storedParcel ? {parcel: storedParcel} : {}) };
  } catch { return null; }
}
export function writeChatShippingDraft(draft: ChatShippingDraft, storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    // Only editable fields belong in storage; never cache rates or a generated guide.
    const destination=address(draft.destination);
    if(!destination)return false;
    const origin=address(draft.origin);
    const storedParcel=parcel(draft.parcel);
    const value: ChatShippingDraft = {version: 1, conversationId: draft.conversationId, pastedInfo: draft.pastedInfo.slice(0,10000), destination, ...(origin ? {origin} : {}), ...(storedParcel ? {parcel:storedParcel} : {})};
    storage.setItem(chatShippingDraftKey(draft.conversationId), JSON.stringify(value));
    return true;
  } catch { return false; }
}
