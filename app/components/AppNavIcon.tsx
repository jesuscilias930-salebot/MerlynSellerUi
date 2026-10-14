type IconName = "finance" | "features" | "chat" | "leads" | "store" | "whatsapp" | "documents" | "video" | "sales" | "settings" | "scenarios" | "logout" | "expand" | "collapse";

const paths: Record<IconName, string> = {
  finance: "M3 6h17v14H3V6Zm0 0V4h15v2M16 10h6v6h-6v-6Zm2 3h1",
  features: "M4 7h16M4 17h16M8 4v6M16 14v6",
  chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5A8.5 8.5 0 1 1 21 11.5Z",
  leads: "M3 5h5v14H3V5Zm7 0h5v9h-5V5Zm7 0h4v11h-4V5Z",
  store: "M4 9h16l-1 12H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2",
  whatsapp: "M20 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5ZM8 8c0 4 4 8 8 8l1-2-3-1-1 1-3-3 1-1-1-3-2 1Z",
  documents: "M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6",
  video: "M3 5h12v14H3V5Zm12 5 6-4v12l-6-4v-4Z",
  sales: "M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20",
  settings: "m10 3-.7 2.4-2 .9L5 5.5 3 9l1.7 1.6v2.8L3 15l2 3.5 2.3-.8 2 .9L10 21h4l.7-2.4 2-.9 2.3.8 2-3.5-1.7-1.6v-2.8L21 9l-2-3.5-2.3.8-2-.9L14 3h-4ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  scenarios: "M12 3v5M5 16v-5h14v5M3 16h4v5H3v-5Zm14 0h4v5h-4v-5ZM10 3h4v5h-4V3Z",
  logout: "M9 4H4v16h5M9 12h12m-4-4 4 4-4 4",
  expand: "m9 6 6 6-6 6",
  collapse: "m15 6-6 6 6 6",
};

export function AppNavIcon({ name }: { name: IconName }) {
  return <svg className="app-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export type { IconName as AppNavIconName };
