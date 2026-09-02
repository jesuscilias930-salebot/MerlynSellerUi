"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { controlApi, controlRequest, controlSession } from "../lib/control-api";
import type { Chat } from "../lib/types";

type Customer = { id: number; name: string; phone: string | null; externalId: string | null };
type Product = { id: number; name: string; basePrice: number; currentStock: number; minStockAlert: number; gender?: string | null };
type Sale = { id: number; customer?: Customer | null; saleItemDtoList?: { quantity: number; unitPriceAtSale: number; product?: { name?: string } }[] };
type Page<T> = { content: T[]; totalElements: number };
type Report = { productId: number; productName: string; totalQuantity: number; totalSales: number; totalNetProfit: number };
type Tab = "summary" | "customers" | "inventory" | "sales" | "reports";

const money = (value?: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export function ControlPanel({ chats }: { chats: Chat[] }) {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [report, setReport] = useState<Report[]>([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", externalId: "" });
  const [saleDraft, setSaleDraft] = useState({ customerId: "", productId: "", quantity: "1" });

  const load = async () => {
    setLoading(true); setNotice("");
    try {
      const [nextCustomers, nextProducts, nextSales, nextReport] = await Promise.all([
        controlRequest<Customer[]>("/customers"), controlRequest<Product[]>("/products/all"), controlRequest<Page<Sale>>("/sales?page=0&size=40"), controlRequest<Report[]>(`/financial-reports/product-breakdown?start=${start}&end=${end}`),
      ]);
      setCustomers(nextCustomers); setProducts(nextProducts); setSales(nextSales.content || []); setReport(nextReport);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible cargar el Control."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const saved = controlSession.get(); setToken(saved); if (saved) void load(); }, []);
  const login = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setNotice(""); try { const result = await controlRequest<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }); controlSession.set(result.token); setToken(result.token); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible iniciar sesión."); } finally { setLoading(false); } };
  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirmation) { setNotice("Las contraseñas no coinciden."); return; }
    setLoading(true); setNotice("");
    try {
      const result = await controlRequest<{ token: string }>("/auth/register", { method: "POST", body: JSON.stringify({ username, email, password }) });
      controlSession.set(result.token); setToken(result.token); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible crear la cuenta."); }
    finally { setLoading(false); }
  };
  const saveCustomer = async (event: FormEvent) => { event.preventDefault(); try { await controlRequest<Customer>("/customers", { method: "POST", body: JSON.stringify(customerDraft) }); setCustomerDraft({ name: "", phone: "", externalId: "" }); await load(); setNotice("Cliente creado y vinculado."); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible guardar el cliente."); } };
  const createSale = async (event: FormEvent) => { event.preventDefault(); try { await controlRequest<Sale>("/sales", { method: "POST", body: JSON.stringify({ customerId: Number(saleDraft.customerId), productsSold: [{ productId: Number(saleDraft.productId), quantity: Number(saleDraft.quantity) }], bundlesSold: [] }) }); setSaleDraft({ customerId: "", productId: "", quantity: "1" }); await load(); setNotice("Venta registrada e inventario actualizado."); } catch (error) { setNotice(error instanceof Error ? error.message : "No fue posible registrar la venta."); } };
  const lowStock = useMemo(() => products.filter((product) => product.currentStock <= product.minStockAlert), [products]);

  if (!token) return <section className="control-login"><div><p>CONTROL DE VENTAS</p><h1>{authMode === "login" ? "Conecta tu sistema de ventas" : "Crea tu espacio de ventas"}</h1><span>{authMode === "login" ? "Inicia sesión con las credenciales de Sock Control." : "Tu cuenta tendrá un espacio independiente para clientes, ventas e inventario."}</span><small>API configurada: {controlApi}</small></div><form onSubmit={authMode === "login" ? login : register}><div className="control-auth-toggle"><button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setNotice(""); }}>Iniciar sesión</button><button type="button" className={authMode === "register" ? "selected" : ""} onClick={() => { setAuthMode("register"); setNotice(""); }}>Registrarme</button></div>{authMode === "register" && <><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nombre de usuario" minLength={3} maxLength={50} autoComplete="username" required /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Correo electrónico" autoComplete="email" required /></>} {authMode === "login" && <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Usuario o correo" autoComplete="username" required />}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Contraseña (mínimo 8 caracteres)" minLength={8} autoComplete={authMode === "login" ? "current-password" : "new-password"} required />{authMode === "register" && <input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" placeholder="Confirmar contraseña" minLength={8} autoComplete="new-password" required />}<button disabled={loading}>{loading ? "Procesando…" : authMode === "login" ? "Conectar" : "Crear cuenta"}</button>{notice && <em>{notice}</em>}</form></section>;
  return <section className="control-panel"><header><div><p>CONTROL DE VENTAS</p><h1>Operación comercial</h1><span>Inventario, clientes, ventas y reportes conectados a Sock Control.</span></div><div><button type="button" className="plain-button" onClick={() => void load()} disabled={loading}>{loading ? "Actualizando…" : "↻ Actualizar"}</button><button type="button" className="plain-button" onClick={() => { controlSession.clear(); setToken(null); }}>Desconectar</button></div></header><nav className="control-tabs">{([['summary','Resumen'],['customers','Clientes'],['inventory','Inventario'],['sales','Ventas'],['reports','Reportes']] as [Tab,string][]).map(([key,label]) => <button key={key} type="button" className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>{notice && <div className="control-notice">{notice}</div>}
    {tab === "summary" && <div className="control-summary"><article><small>Clientes</small><b>{customers.length}</b></article><article><small>Productos</small><b>{products.length}</b></article><article><small>Stock bajo</small><b className={lowStock.length ? "warning" : ""}>{lowStock.length}</b></article><article><small>Ventas cargadas</small><b>{sales.length}</b></article><section><h2>Productos que requieren atención</h2>{lowStock.length ? lowStock.map((product) => <div className="stock-row" key={product.id}><span>{product.name}</span><b>{product.currentStock} disponibles</b></div>) : <p>No hay alertas de inventario.</p>}</section></div>}
    {tab === "customers" && <div className="control-customers"><form className="customer-form" onSubmit={saveCustomer}><h2>Nuevo cliente</h2><input value={customerDraft.name} onChange={(event) => setCustomerDraft({ ...customerDraft, name: event.target.value })} placeholder="Nombre" required /><input value={customerDraft.phone} onChange={(event) => setCustomerDraft({ ...customerDraft, phone: event.target.value })} placeholder="Teléfono" /><select value={customerDraft.externalId} onChange={(event) => { const selected = chats.find((chat) => (chat.contactId || chat.id) === event.target.value); setCustomerDraft({ name: customerDraft.name || selected?.name || "", phone: customerDraft.phone || selected?.phone_number || "", externalId: event.target.value }); }}><option value="">Sin vínculo con Merlyn Seller</option>{chats.map((chat) => <option key={chat.id} value={chat.contactId || chat.id}>{chat.name || chat.phone_number}</option>)}</select><button>Guardar cliente</button></form><section className="control-table"><h2>Clientes</h2>{customers.map((customer) => <div key={customer.id}><strong>{customer.name}</strong><span>{customer.phone || "Sin teléfono"}</span><small>{customer.externalId ? "Vinculado a Merlyn Seller" : "Sin vínculo"}</small></div>)}</section></div>}
    {tab === "inventory" && <section className="control-table"><h2>Inventario</h2>{products.map((product) => <div key={product.id} className={product.currentStock <= product.minStockAlert ? "low" : ""}><strong>{product.name}</strong><span>{product.gender || "Sin género"}</span><span>{money(product.basePrice)}</span><b>{product.currentStock} disponibles</b></div>)}</section>}
    {tab === "sales" && <div className="control-customers"><form className="customer-form" onSubmit={createSale}><h2>Registrar venta</h2><select value={saleDraft.customerId} onChange={(event) => setSaleDraft({ ...saleDraft, customerId: event.target.value })} required><option value="">Selecciona cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select value={saleDraft.productId} onChange={(event) => setSaleDraft({ ...saleDraft, productId: event.target.value })} required><option value="">Selecciona producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.currentStock} disponibles</option>)}</select><input min="1" type="number" value={saleDraft.quantity} onChange={(event) => setSaleDraft({ ...saleDraft, quantity: event.target.value })} required /><button>Registrar venta</button></form><section className="control-table"><h2>Ventas recientes</h2>{sales.map((sale) => <div key={sale.id}><strong>Venta #{sale.id}</strong><span>{sale.customer?.name || "Cliente"}</span><b>{sale.saleItemDtoList?.reduce((sum, item) => sum + Number(item.unitPriceAtSale || 0) * Number(item.quantity || 0), 0) ? money(sale.saleItemDtoList.reduce((sum, item) => sum + Number(item.unitPriceAtSale || 0) * Number(item.quantity || 0), 0)) : "Sin detalles"}</b></div>)}</section></div>}
    {tab === "reports" && <section className="control-table"><div className="report-controls"><h2>Utilidad por producto</h2><label>Inicio<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Fin<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><button type="button" onClick={() => void load()}>Consultar</button></div>{report.map((item) => <div key={item.productId}><strong>{item.productName}</strong><span>{item.totalQuantity} vendidos</span><span>Ventas: {money(item.totalSales)}</span><b>Utilidad: {money(item.totalNetProfit)}</b></div>)}</section>}
  </section>;
}
