import { useRef, useState } from "react";
import type { User } from "../lib/types";
import styles from "./Sidebar.module.css";

type View = "ecommerce-presentation" | "ecommerce-testimonials" | "feature" | "inbox" | "pipeline" | "remarketing" | "automations" | "quick-replies" | "stickers" | "documents" | "collections" | "cta-buttons" | "templates" | "scenarios" | "shipping" | "control" | "ecommerce-orders" | "ecommerce-bundles" | "ecommerce-products";
type ControlTab = import("./ControlPanel").ControlTab;
type Item = { label: string; view: View; tab?: ControlTab };
const groups: { id: string; label: string; icon: string; items: Item[] }[] = [
  { id: "ecommerce", label: "E-commerce", icon: "▣", items: [
    { label: "Pedidos", view: "ecommerce-orders" }, { label: "Bundles", view: "ecommerce-bundles" },
    { label: "Productos", view: "ecommerce-products" }, { label: "Envíos", view: "shipping" },
    { label: "Testimonios", view: "ecommerce-testimonials" },
    { label: "Imagen de presentación", view: "ecommerce-presentation" },
  ] },
  { id: "whatsapp", label: "WhatsApp", icon: "◉", items: [
    { label: "Remarketing", view: "remarketing" }, { label: "Respuestas automáticas", view: "automations" },
    { label: "Respuestas rápidas", view: "quick-replies" }, { label: "Plantillas oficiales", view: "templates" }, { label: "Stickers", view: "stickers" },
    { label: "Invitaciones con botón", view: "cta-buttons" },
  ] },
  { id: "documents", label: "Documentos", icon: "▤", items: [
    { label: "Plantillas de documentos", view: "documents" }, { label: "Conjuntos reutilizables", view: "collections" },
  ] },
  { id: "sales", label: "Control de ventas", icon: "◌", items: (
    [["summary", "Resumen"], ["customers", "Clientes"], ["categories", "Categorías"], ["products", "Productos"], ["inventory", "Inventario"],
      ["prices", "Precios"], ["sales", "Ventas"], ["purchases", "Adquisición de mercancía"], ["reports", "Reportes"]] as [ControlTab, string][]
  ).map(([tab, label]) => ({ label, view: "control", tab })) },
  { id: "settings", label: "Configuración", icon: "⚙", items: [
    { label: "Configuración de paquetes", view: "control", tab: "packing" },
    { label: "Peso de productos", view: "control", tab: "weights" },
    { label: "Medidas de pilas", view: "control", tab: "stack-measures" },
    { label: "Bundles", view: "control", tab: "bundles" },
  ] },
];
type Props = { user: User; view: View; controlTab: ControlTab; onViewChange: (view: View) => void; onControlTabChange: (tab: ControlTab) => void; onLogout: () => void };

export function Sidebar({ user, view, controlTab, onViewChange, onControlTabChange, onLogout }: Props) {
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isActive = (item: Item) => view === item.view && (!item.tab || controlTab === item.tab);
  function navigate(item: Item) {
    if (item.tab) onControlTabChange(item.tab); else onViewChange(item.view);
    mobileDialog.current?.close();
  }
  function link(label: string, target: View, icon: string) {
    return <button type="button" title={label} aria-label={label} aria-current={view === target ? "page" : undefined} className={view === target ? "selected" : ""} onClick={() => onViewChange(target)}><span aria-hidden="true">{icon}</span><span className="sidebar-label">{label}</span></button>;
  }
  return <><div className="mobile-app-heading"><b className="mobile-app-mark">M</b><span>MERLYN SELLER</span><button type="button" onClick={() => mobileDialog.current?.showModal()} aria-label="Abrir todas las secciones">Menú ☰</button></div>
  <aside className={`sidebarMain${collapsed ? " collapsed" : ""}`}>
    <div className="brand"><b className="mark">M</b><strong className="sidebar-label">Merlyn Sales</strong>
      <button type="button" className="sidebar-collapse-toggle" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Desplegar menú" : "Contraer menú"} aria-expanded={!collapsed}>{collapsed ? "›" : "‹"}</button>
    </div>
    <nav aria-label="Menú principal">
      {["owner", "admin"].includes(user.role) && link("Feature", "feature", "⚑")}
      {link("Inbox", "inbox", "◉")}
      {link("Leads", "pipeline", "▦")}
      {groups.map(group => {
        const active = group.items.some(isActive);
        const open = !collapsed && (expanded[group.id] ?? active);
        return <div key={group.id} className={styles.group}>
          <button type="button" className={`${styles.heading} ${active ? "selected" : ""}`} title={group.label} aria-label={group.label} aria-expanded={open} aria-controls={`sidebar-${group.id}`} onClick={() => { setExpanded(current => ({ ...current, [group.id]: collapsed || !open })); setCollapsed(false); }}>
            <span aria-hidden="true">{group.icon}</span><span className="sidebar-label">{group.label}</span><span className={`${styles.chevron} sidebar-label`} aria-hidden="true">{open ? "⌄" : "›"}</span>
          </button>
          <div id={`sidebar-${group.id}`} className={styles.items} hidden={!open}>
            {group.items.map(item => <button type="button" key={item.tab || item.view} title={item.label} aria-current={isActive(item) ? "page" : undefined} className={isActive(item) ? "selected" : ""} onClick={() => navigate(item)}>{item.label}</button>)}
          </div>
        </div>;
      })}
      {link("Escenarios", "scenarios", "◇")}
    </nav>
    <div className="profile"><b>{user.email[0].toUpperCase()}</b><span className="sidebar-label">{user.email}<small>{user.role}</small></span><button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">↪</button></div>
  </aside>
  <nav className="mobile-app-tabs" aria-label="Navegación móvil">
    {([{ label: "Chats", view: "inbox", path: "M4 4h16v12H9l-5 4V4Z" }, { label: "Leads", view: "pipeline", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-4M17 3a4 4 0 0 1 0 8" }, { label: "Envíos", view: "shipping", path: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9v10M3 8l9 4 9-4M7 5l10 5" }, { label: "Control", view: "control", path: "M5 20V10M12 20V4M19 20v-7" }] as const).map(item => <button key={item.view} type="button" aria-current={view === item.view ? "page" : undefined} onClick={() => onViewChange(item.view)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={item.path} /></svg><span>{item.label}</span></button>)}
    <button type="button" onClick={() => mobileDialog.current?.showModal()} aria-label="Cuenta y todas las secciones"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span>Cuenta</span></button>
  </nav>
  <dialog ref={mobileDialog} className="mobile-app-menu" aria-labelledby="mobile-menu-title">
    <header><div><small>MERLYN SELLER</small><h2 id="mobile-menu-title">Tu cuenta y secciones</h2></div><button type="button" onClick={() => mobileDialog.current?.close()} aria-label="Cerrar menú">×</button></header>
    <div className="mobile-account-card"><strong>{user.email}</strong><span>{user.role}</span></div>
    <nav aria-label="Todas las secciones">
      {["owner", "admin"].includes(user.role) && <button type="button" onClick={() => navigate({ label: "Features", view: "feature" })}>Features</button>}
      {groups.map(group => <details key={group.id} open={group.items.some(isActive) || undefined}><summary>{group.label}</summary><div>{group.items.map(item => <button type="button" key={item.tab || item.view} aria-current={isActive(item) ? "page" : undefined} onClick={() => navigate(item)}>{item.label}</button>)}</div></details>)}
      <button type="button" onClick={() => navigate({ label: "Escenarios", view: "scenarios" })}>Escenarios</button>
    </nav>
    <button type="button" className="mobile-logout" onClick={() => { mobileDialog.current?.close(); onLogout(); }}>Cerrar sesión</button>
  </dialog></>;
}
