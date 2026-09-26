// Only shared data lives here. Self-contained panels fetch on mount.
export type CrmResource = "chats" | "pipeline" | "presets" | "automations" | "quickReplies" | "stickers" | "ctaTemplates" | "templates" | "scenarios" | "documents" | "collections";
export function crmResources(view: string, controlTab: string, conversationOpen = false): CrmResource[] {
  const resources = new Set<CrmResource>();
  if (view === "inbox") { resources.add("chats"); resources.add("pipeline"); }
  if (view === "pipeline" || view === "remarketing" || view === "scenarios") resources.add("pipeline");
  if (view === "remarketing") resources.add("presets");
  if (view === "automations") resources.add("automations");
  if (view === "quick-replies") { resources.add("quickReplies"); resources.add("ctaTemplates"); }
  if (view === "stickers") resources.add("stickers");
  if (view === "cta-buttons") resources.add("ctaTemplates");
  if (view === "templates") resources.add("templates");
  if (view === "documents") resources.add("documents");
  if (view === "collections" || view === "scenarios" || (view === "control" && controlTab === "bundles")) resources.add("collections");
  if (view === "scenarios") resources.add("scenarios");
  if (view === "control" && controlTab === "customers") resources.add("chats");
  // These are also used by the conversation composer, not just their management pages.
  if (conversationOpen) for (const resource of ["pipeline", "automations", "quickReplies", "stickers", "collections"] as const) resources.add(resource);
  return [...resources].sort();
}

export type ControlResource = "customers" | "products" | "categories" | "sales" | "purchases" | "report";
export function controlResources(tab: string): ControlResource[] {
  switch (tab) {
    case "summary": return ["customers", "products", "sales"];
    case "customers": return ["customers"];
    case "categories": return ["categories"];
    case "products": return ["products", "categories"];
    case "inventory": case "weights": case "prices": case "bundles": return ["products"];
    case "sales": return ["customers", "products", "sales"];
    case "purchases": return ["products", "purchases"];
    case "reports": return ["report"];
    default: return [];
  }
}
