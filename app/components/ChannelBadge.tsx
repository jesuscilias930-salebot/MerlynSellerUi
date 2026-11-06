import { CHANNEL_LABELS, channelOf, type Channel } from "../lib/channels";

// Íconos genéricos y pequeños por canal (no son los logotipos de las marcas):
// teléfono = WhatsApp, globo de chat = Messenger, cámara = Instagram.
const ICONS: Record<Channel, React.ReactNode> = {
  whatsapp: <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />,
  messenger: <path d="M12 3C6.9 3 3 6.6 3 11.2c0 2.5 1.2 4.7 3.1 6.2V21l3.2-1.8c.85.24 1.75.36 2.7.36 5.1 0 9-3.6 9-8.2S17.1 3 12 3z" />,
  instagram: <path d="M9.2 4 7.8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.8l-1.4-2zM12 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fillRule="evenodd" />,
};

/** Insignia chiquita del canal sobre el avatar del chat. */
export function ChannelBadge({ contact }: { contact: { channel?: Channel | null } }) {
  const channel = channelOf(contact);
  return <i className={`channel-badge ${channel}`} role="img" aria-label={CHANNEL_LABELS[channel]} title={CHANNEL_LABELS[channel]}>
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{ICONS[channel]}</svg>
  </i>;
}
