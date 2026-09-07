import { useState } from "react";
import type { User } from "../lib/types";

type View = "inbox" | "pipeline" | "remarketing" | "automations" | "scenarios" | "control";
type ControlTab = "summary" | "customers" | "categories" | "inventory" | "prices" | "bundles" | "sales" | "purchases" | "reports";
type Props = {
  user: User;
  view: View;
  controlTab: ControlTab;
  onViewChange: (view: View) => void;
  onControlTabChange: (tab: ControlTab) => void;
  onLogout: () => void;
};

export function Sidebar({ user, view, controlTab, onViewChange, onControlTabChange, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const switchView =
    (nextView: View) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onViewChange(nextView);
    };
  return (
    <aside className={`sidebarMain${collapsed ? " collapsed" : ""}`}>
      <div className="brand">
        <b className="mark">M</b>
        <strong className="sidebar-label">Merlyn Sales</strong>
        <button type="button" className="sidebar-collapse-toggle" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? "Desplegar menú" : "Contraer menú"} aria-expanded={!collapsed} title={collapsed ? "Desplegar menú" : "Contraer menú"}>{collapsed ? "›" : "‹"}</button>
      </div>
      <nav>
        <button
          type="button"
          className={view === "inbox" ? "selected" : ""}
          onClick={switchView("inbox")}
        >
          <span aria-hidden="true">◉</span><span className="sidebar-label">Inbox</span>
        </button>
        <button
          type="button"
          className={view === "pipeline" ? "selected" : ""}
          onClick={switchView("pipeline")}
        >
          <span aria-hidden="true">▦</span><span className="sidebar-label">Leads</span>
        </button>
        <button
          type="button"
          className={view === "remarketing" ? "selected" : ""}
          onClick={switchView("remarketing")}
        >
          <span aria-hidden="true">↗</span><span className="sidebar-label">Remarketing</span>
        </button>
        <button
          type="button"
          className={view === "automations" ? "selected" : ""}
          onClick={switchView("automations")}
        >
          <span aria-hidden="true">⚙</span><span className="sidebar-label">Automatizaciones</span>
        </button>
        <button
          type="button"
          className={view === "scenarios" ? "selected" : ""}
          onClick={switchView("scenarios")}
        >
          <span aria-hidden="true">◇</span><span className="sidebar-label">Escenarios</span>
        </button>
        <button
          type="button"
          className={view === "control" ? "selected" : ""}
          onClick={switchView("control")}
        >
          <span aria-hidden="true">◌</span><span className="sidebar-label">Control de ventas</span>
        </button>
        <div className="control-aside-menu" aria-label="Opciones de control de ventas">
          {([['summary', 'Resumen'], ['customers', 'Clientes'], ['categories', 'Categorías'], ['inventory', 'Inventario'], ['prices', 'Precios'], ['bundles', 'Bundles'], ['sales', 'Ventas'], ['purchases', 'Compras'], ['reports', 'Reportes']] as [ControlTab, string][]).map(([tab, label]) => <button key={tab} type="button" className={controlTab === tab ? "selected" : ""} onClick={() => onControlTabChange(tab)}><span className="sidebar-label">{label}</span></button>)}
        </div>
      </nav>
      <div className="profile">
        <b>{user.email[0].toUpperCase()}</b>
        <span className="sidebar-label">
          {user.email}
          <small>{user.role}</small>
        </span>
        <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
          ↪
        </button>
      </div>
    </aside>
  );
}
