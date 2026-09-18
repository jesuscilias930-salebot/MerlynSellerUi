export const shippingDraftKey = "merlynseller:shipping-draft";
export type ShippingDraft = {
  source?: "order";
  conversationId?: string;
  orderId?: string;
  orderFolio?: string;
  orderLines?: { name: string; quantity: number }[];
  pairs?: number;
  destination?: { name?: string; phone?: string; street?: string; city?: string; state?: string; country?: string; postalCode?: string; district?: string; number?: string; email?: string; interiorNumber?: string; references?: string };
  package?: { type: string; content: string; amount: number; declaredValue: number; weight: number; dimensions: { length: number; width: number; height: number } };
};
