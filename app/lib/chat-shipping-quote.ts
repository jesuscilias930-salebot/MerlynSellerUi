import type { QuoteRate } from "./quote";

/** Cotización de envío del chat guardada en este navegador (temporal) y compartida entre ventanas del mismo chat. */
export type StoredShippingQuote = {
  version: 1;
  conversationId: string;
  savedAt: number;
  rates: QuoteRate[];
  quoted: { body: Record<string, unknown>; environment: string };
  productName: string;
  place: string;
  notice?: string;
};
type QuoteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Las tarifas cambian: se conservan 12 h y después hay que volver a cotizar. */
export const QUOTE_TTL_MS = 12 * 60 * 60 * 1000;
/** Más antigua que esto: se avisa antes de generar la guía. */
export const QUOTE_FRESH_MS = 2 * 60 * 60 * 1000;

export const chatShippingQuoteKey = (conversationId: string) => `merlynseller:chat-shipping-quote:v1:${encodeURIComponent(conversationId)}`;
const browserStorage = (): QuoteStorage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isRate = (value: unknown): value is QuoteRate => isRecord(value) && typeof value.carrier === "string" && typeof value.service === "string";

export function parseShippingQuote(raw: string | null | undefined, conversationId: string, now = Date.now()): StoredShippingQuote | null {
  try {
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || value.conversationId !== conversationId || typeof value.savedAt !== "number") return null;
    if (now - value.savedAt > QUOTE_TTL_MS || value.savedAt > now + 60_000) return null;
    if (!Array.isArray(value.rates) || !value.rates.every(isRate) || !isRecord(value.quoted) || !isRecord(value.quoted.body) || typeof value.quoted.environment !== "string") return null;
    return {
      version: 1, conversationId, savedAt: value.savedAt, rates: value.rates.slice(0, 60),
      quoted: { body: value.quoted.body, environment: value.quoted.environment },
      productName: typeof value.productName === "string" ? value.productName.slice(0, 200) : "Productos",
      place: typeof value.place === "string" ? value.place.slice(0, 200) : "",
      ...(typeof value.notice === "string" && value.notice ? { notice: value.notice.slice(0, 500) } : {}),
    };
  } catch { return null; }
}

export const readShippingQuote = (conversationId: string, storage = browserStorage(), now = Date.now()) => {
  try { return parseShippingQuote(storage?.getItem(chatShippingQuoteKey(conversationId)), conversationId, now); } catch { return null; }
};
export function writeShippingQuote(quote: StoredShippingQuote, storage = browserStorage()): boolean {
  try { if (!storage) return false; storage.setItem(chatShippingQuoteKey(quote.conversationId), JSON.stringify(quote)); return true; } catch { return false; }
}
export function clearShippingQuote(conversationId: string, storage = browserStorage()) {
  try { storage?.removeItem(chatShippingQuoteKey(conversationId)); } catch { /* opcional */ }
}
