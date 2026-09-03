import type { User } from "../lib/types";

type View = "inbox" | "pipeline" | "remarketing" | "automations" | "control";
type ControlTab = "summary" | "customers" | "categories" | "inventory" | "sales" | "purchases" | "reports";
type Props = {
  user: User;
  view: View;
  controlTab: ControlTab;
  onViewChange: (view: View) => void;
  onControlTabChange: (tab: ControlTab) => void;
  onLogout: () => void;
};

export function Sidebar({ user, view, controlTab, onViewChange, onControlTabChange, onLogout }: Props) {
  const switchView =
    (nextView: View) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onViewChange(nextView);
    };
  return (
    <aside>
      <div className="brand">
        <b className="mark">M</b>
        <strong>Merlyn Sales</strong>
      </div>
      <nav>
        <button
          type="button"
          className={view === "inbox" ? "selected" : ""}
          onClick={switchView("inbox")}
        >
          ◉ Inbox
        </button>
        <button
          type="button"
          className={view === "pipeline" ? "selected" : ""}
          onClick={switchView("pipeline")}
        >
          ▦ Leads
        </button>
        <button
          type="button"
          className={view === "remarketing" ? "selected" : ""}
          onClick={switchView("remarketing")}
        >
          ↗ Remarketing
        </button>
        <button
          type="button"
          className={view === "automations" ? "selected" : ""}
          onClick={switchView("automations")}
        >
          ⚙ Automatizaciones
        </button>
        <button
          type="button"
          className={view === "control" ? "selected" : ""}
          onClick={switchView("control")}
        >
          ◌ Control de ventas
        </button>
        <div className="control-aside-menu" aria-label="Opciones de control de ventas">
          {([['summary', 'Resumen'], ['customers', 'Clientes'], ['categories', 'Categorías'], ['inventory', 'Inventario'], ['sales', 'Ventas'], ['purchases', 'Compras'], ['reports', 'Reportes']] as [ControlTab, string][]).map(([tab, label]) => <button key={tab} type="button" className={controlTab === tab ? "selected" : ""} onClick={() => onControlTabChange(tab)}>{label}</button>)}
        </div>
      </nav>
      <div className="profile">
        <b>{user.email[0].toUpperCase()}</b>
        <span>
          {user.email}
          <small>{user.role}</small>
        </span>
        <button type="button" onClick={onLogout} aria-label="Cerrar sesión">
          ↪
        </button>
      </div>
    </aside>
  );
}
