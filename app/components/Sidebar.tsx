import type { User } from "../lib/types";

type View = "inbox" | "pipeline" | "remarketing" | "automations";
type Props = { user: User; view: View; onViewChange: (view: View) => void; onLogout: () => void };

export function Sidebar({ user, view, onViewChange, onLogout }: Props) {
  return <aside><div className="brand"><b className="mark">M</b><strong>Merlyn Sales</strong></div><nav><button type="button" className={view === "inbox" ? "selected" : ""} onClick={() => onViewChange("inbox")}>◉ Inbox</button><button type="button" className={view === "pipeline" ? "selected" : ""} onClick={() => onViewChange("pipeline")}>▦ Leads</button><button type="button" className={view === "remarketing" ? "selected" : ""} onClick={() => onViewChange("remarketing")}>↗ Remarketing</button><button type="button" className={view === "automations" ? "selected" : ""} onClick={() => onViewChange("automations")}>⚙ Automatizaciones</button><button type="button" disabled>◌ Contactos</button></nav><div className="profile"><b>{user.email[0].toUpperCase()}</b><span>{user.email}<small>{user.role}</small></span><button type="button" onClick={onLogout} aria-label="Cerrar sesión">↪</button></div></aside>;
}
