import { useState } from "react";
import type { User } from "../lib/types";
import styles from "./Sidebar.module.css";

type View = "ecommerce-testimonials" | "feature" | "inbox" | "pipeline" | "remarketing" | "automations" | "quick-replies" | "stickers" | "documents" | "collections" | "cta-buttons" | "templates" | "scenarios" | "shipping" | "control" | "ecommerce-orders" | "ecommerce-bundles" | "ecommerce-products";
type ControlTab = import("./ControlPanel").ControlTab;
type Item = { label: string; view: View; tab?: ControlTab };
const groups: { id: string; label: string; icon: string; items: Item[] }[] = [
  { id: "ecommerce", label: "E-commerce", icon: "▣", items: [
    { label: "Pedidos", view: "ecommerce-orders" }, { label: "Bundles", view: "ecommerce-bundles" },
    { label: "Productos", view: "ecommerce-products" }, { label: "Envíos", view: "shipping" },
    { label: "Testimonios", view: "ecommerce-testimonials" },
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
    { label: "Bundles", view: "control", tab: "bundles" },
  ] },
];
type Props = { user: User; view: View; controlTab: ControlTab; onViewChange: (view: View) => void; onControlTabChange: (tab: ControlTab) => void; onLogout: () => void };

export function Sidebar({ user, view, controlTab, onViewChange, onControlTabChange, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isActive = (item: Item) => view === item.view && (!item.tab || controlTab === item.tab);
  function navigate(item: Item) {
    if (item.tab) onControlTabChange(item.tab); else onViewChange(item.view);
  }
  function link(label: string, target: View, icon: string) {
    return <button type="button" title={label} aria-label={label} aria-current={view === target ? "page" : undefined} className={view === target ? "selected" : ""} onClick={() => onViewChange(target)}><span aria-hidden="true">{icon}</span><span className="sidebar-label">{label}</span></button>;
  }
  return <aside className={`sidebarMain${collapsed ? " collapsed" : ""}`}>
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
  </aside>;
}
