type Name = "inventory" | "search" | "new" | "filter" | "tools" | "more" | "back" | "close" | "attach" | "send" | "audio" | "chat";
const paths: Record<Name, React.ReactNode> = {
  inventory: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  new: <><path d="M14 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9M15 3l6 6M11 13l2-5 5-5 3 3-5 5-5 2Z" /></>,
  filter: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" /></>,
  tools: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M14 4v16M17 8h1M17 12h1M17 16h1" /></>,
  more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  back: <path d="m14 5-7 7 7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  attach: <path d="m9 7 6-5a4 4 0 0 1 6 6L10 19a6 6 0 0 1-8-8L13 1M6 13l9-9a2 2 0 0 1 3 3l-9 9" />,
  send: <><path d="m3 3 18 9-18 9 3-9-3-9ZM6 12h15" /></>,
  audio: <><path d="M9 18V5l10-2v13M9 7l10-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="16" cy="16" rx="3" ry="2" /></>,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-13 7.3L3 21l2-5a8.5 8.5 0 1 1 16-4.5Z" /><path d="M8 10h8M8 14h5" /></>,
};
export function ChatIcon({ name }: { name: Name }) {
  return <svg className="chat-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
