"use client";

import { FormEvent, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { controlResources, type ControlResource } from "../lib/section-data";
import { controlApi, controlRequest, controlSession, loginControl } from "../lib/control-api";
import type { Chat, EntrepreneurPackage } from "../lib/types";
import { PriceRulesPanel } from "./PriceRulesPanel";
import { BundleConfiguration } from "./BundleConfiguration";
import { SalesWorkspace } from "./SalesWorkspace";
import { ProductWeightEditor } from "./ProductWeightEditor";
import { StackMeasurementsPanel } from "./StackMeasurementsPanel";
import { PackingRulesPanel } from "./PackingRulesPanel";
import { InventoryPanel } from "./InventoryPanel";
import { PurchasesWorkspace } from "./PurchasesWorkspace";
import { request } from "../lib/api";
import { COMMON_COLORS, colorSwatch, normalizeColor } from "../lib/product-colors";
import { detailMaps, groupModels, normalizeModel, uniqueValues, type ModelGroup, type ProductDetail } from "../lib/product-variants";
import { ModelStockCard, VariantGenerator, type VariantPrefill } from "./ProductVariants";
import { compareSizesDesc, groupBySize } from "../lib/size-groups";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  externalId: string | null;
};
type Category = { id: number; name: string };

type Product = {
  id: number;
  name: string;
  currentStock: number;
  minStockAlert: number;
  weightGrams?: number | string | null;
    category: Category;
  gender?: string | null;
  size?: string | null;

};
type Sale = {
  id: number;
  customer?: Customer | null;
  saleItemDtoList?: {
    quantity: number;
    unitPriceAtSale: number;
    product?: { name?: string };
  }[];
};
type Page<T> = { content: T[]; totalElements: number };
type Report = {
  productId: number;
  productName: string;
  totalQuantity: number;
  totalSales: number;
  totalNetProfit: number;
};
export type ControlTab =
  | "summary"
  | "customers"
  | "categories"
  | "inventory"
  | "products"
  | "packing"
  | "weights"
  | "stack-measures"
  | "prices"
  | "bundles"
  | "sales"
  | "purchases"
  | "reports";

const money = (value?: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(value || 0),
  );
const monthStart = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
export function ControlPanel({
  chats,
  tab,
  onTabChange,
  entrepreneurPackages,
  onCreateBundleImageSet,
  onUploadBundleImage,
}: {
  chats: Chat[];
  tab: ControlTab;
  onTabChange: (tab: ControlTab) => void;
  entrepreneurPackages: EntrepreneurPackage[];
  onCreateBundleImageSet: (name: string, bundleType: string, controlBundleId: number) => Promise<EntrepreneurPackage>;
  onUploadBundleImage: (packageId: string, file: File) => Promise<void>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const productCategories = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; products: Product[] }>();
    for (const product of products) {
      const id = product.category?.id == null ? "uncategorized" : String(product.category.id);
      const group = groups.get(id) ?? { id, name: product.category?.name?.trim() || "Sin categoría", products: [] };
      group.products.push(product);
      groups.set(id, group);
    }
    return [...groups.values()].sort((a, b) => a.id === "uncategorized" ? 1 : b.id === "uncategorized" ? -1 : a.name.localeCompare(b.name, "es"));
  }, [products]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [colors, setColors] = useState<Record<number, string>>({});
  const [models, setModels] = useState<Record<number, string>>({});
  const [productMode, setProductMode] = useState<"single" | "variants">("single");
  const [variantPrefill, setVariantPrefill] = useState<VariantPrefill | null>(null);
  const [variantRevision, setVariantRevision] = useState(0);
  const [report, setReport] = useState<Report[]>([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    name: "",
    phone: "",
    externalId: "",
  });
  const [productDraft, setProductDraft] = useState({
    name: "",
    categoryId: "",
    gender: "Hombre",
    size: "",
    color: "",
    model: "",
    minStockAlert: "12",
  });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );

  const loadController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const { signal } = controller;
    setLoading(true);
    setNotice("");
    try {
      const get = async <T,>(path: string, apply: (data: T) => void) => {
        const data = await controlRequest<T>(path, { signal });
        if (!signal.aborted) apply(data);
      };
      const loaders: Record<ControlResource, () => Promise<void>> = {
        customers: () => get<Customer[]>("/customers", setCustomers),
        products: () => get<Product[]>("/products/all", setProducts),
        categories: () => get<Category[]>("/category", setCategories),
        sales: () => get<Page<Sale>>("/sales?page=0&size=40", page => setSales(page.content || [])),
        report: () => get<Report[]>(`/financial-reports/product-breakdown?start=${start}&end=${end}`, setReport),
      };
      // Color y modelo viven en el CRM; si fallan, el catálogo sigue funcionando sin ellos.
      if (tab === "products" || tab === "purchases") void request<ProductDetail[]>("/product-details", { signal }).then(rows => {
        if (signal.aborted) return;
        const maps = detailMaps(rows);
        setColors(maps.colors);
        setModels(maps.models);
      }).catch(() => undefined);
      const results = await Promise.allSettled(controlResources(tab).map(resource => loaders[resource]()));
      const failed = results.find(result => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    } catch (error) {
      if (signal.aborted) return;
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el Control.",
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [tab, start, end]);
  const loadActiveSection = useEffectEvent(() => load());
  useEffect(() => {
    let active = true;
    void Promise.resolve(controlSession.get()).then(saved => { if (active) setToken(saved); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active && token) void loadActiveSection(); });
    return () => { active = false; loadController.current?.abort(); };
  }, [token, tab]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const nextToken = await loginControl(identifier, password);
      setPassword("");
      setToken(nextToken);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  };
  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setNotice("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const result = await controlRequest<{ token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      controlSession.set(result.token);
      setToken(result.token);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible crear la cuenta.",
      );
    } finally {
      setLoading(false);
    }
  };
  const saveCustomer = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await controlRequest<Customer>("/customers", {
        method: "POST",
        // Sin vínculo se envía null: un texto vacío chocaba con otros clientes sin vínculo.
        body: JSON.stringify({ name: customerDraft.name.trim(), phone: customerDraft.phone.trim() || null, externalId: customerDraft.externalId || null }),
      });
      const linked = Boolean(customerDraft.externalId);
      setCustomerDraft({ name: "", phone: "", externalId: "" });
      await load();
      setNotice(linked ? "Cliente creado y vinculado a Merlyn Seller." : "Cliente creado.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el cliente.",
      );
    }
  };
  const resetProductEditor = () => {
    setEditingProductId(null);
    setProductDraft({ name: "", categoryId: "", gender: "Hombre", size: "", color: "", model: "", minStockAlert: "12" });
  };
  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const product = {
        name: productDraft.name.trim(),
        size: productDraft.size.trim() || null,
        category: { id: Number(productDraft.categoryId) },
        gender: productDraft.gender,
        minStockAlert: Number(productDraft.minStockAlert),
        currentStock: 0,
      };
      const saved = await controlRequest<Product | Product[]>(editingProductId ? `/products/${editingProductId}` : "/products", {
        method: editingProductId ? "PUT" : "POST",
        body: JSON.stringify(editingProductId ? product : [product]),
      });
      const wasEditing = Boolean(editingProductId);
      const productId = editingProductId || (Array.isArray(saved) ? saved[0]?.id : saved?.id);
      const color = normalizeColor(productDraft.color);
      const model = normalizeModel(productDraft.model);
      let detailError = "";
      if (productId && (color !== (colors[productId] || "") || model !== (models[productId] || ""))) {
        try {
          await request<ProductDetail>(`/product-details/${productId}`, { method: "PUT", body: JSON.stringify({ color, model }) });
          setColors(current => { const next = { ...current }; if (color) next[productId] = color; else delete next[productId]; return next; });
          setModels(current => { const next = { ...current }; if (model) next[productId] = model; else delete next[productId]; return next; });
        } catch (error) {
          detailError = error instanceof Error ? error.message : "intenta de nuevo";
        }
      }
      resetProductEditor();
      await load();
      setNotice(detailError ? `Producto guardado, pero no se pudo guardar el color y modelo: ${detailError}` : wasEditing ? "Producto actualizado." : "Producto guardado. Registra una compra para agregar existencias.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el producto.",
      );
    }
  };
  const scrollToProductEditor = () => requestAnimationFrame(() => document.querySelector(".product-editor-column")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const editProduct = (product: Product) => {
    setProductMode("single");
    setEditingProductId(product.id);
    setProductDraft({ name: product.name, categoryId: String(product.category?.id || ""), gender: product.gender || "Unisex", size: product.size || "", color: colors[product.id] || "", model: models[product.id] || "", minStockAlert: String(product.minStockAlert ?? 0) });
    scrollToProductEditor();
  };
  const openVariantGenerator = (prefill: VariantPrefill | null) => {
    resetProductEditor();
    setVariantPrefill(prefill);
    setVariantRevision(value => value + 1);
    setProductMode("variants");
    scrollToProductEditor();
  };
  const addVariantsTo = (group: ModelGroup) => {
    const first = products.find(product => product.id === group.products[0]?.id);
    openVariantGenerator({ model: group.model, categoryId: group.categoryId, gender: group.gender || "Hombre", colors: group.colors.filter(Boolean), sizes: group.sizes.filter(Boolean), minStockAlert: String(first?.minStockAlert ?? 12) });
  };
  const modelNames = useMemo(() => uniqueValues(Object.values(models)).sort((a, b) => a.localeCompare(b, "es")), [models]);
  const duplicateProduct = (product: Product) => {
    // Do not copy id or stock: this intentionally starts a new catalog record.
    setEditingProductId(null);
    setProductDraft({
      name: `${product.name} (copia)`,
      categoryId: String(product.category?.id || ""),
      gender: product.gender || "Unisex",
      size: product.size || "",
      color: colors[product.id] || "",
      model: models[product.id] || "",
      minStockAlert: String(product.minStockAlert ?? 12),
    });
    setProductMode("single");
    setNotice("Se copiaron los datos. Ajusta lo necesario y guarda como producto nuevo.");
    scrollToProductEditor();
  };
  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Eliminar el producto “${product.name}”? Esta acción puede fallar si está vinculado a compras, ventas o precios.`)) return;
    try {
      await controlRequest<void>(`/products/${product.id}`, { method: "DELETE" });
      if (colors[product.id] || models[product.id]) void request(`/product-details/${product.id}`, { method: "PUT", body: JSON.stringify({ color: "", model: "" }) }).catch(() => undefined);
      if (editingProductId === product.id) resetProductEditor();
      await load();
      setNotice("Producto eliminado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible eliminar el producto.");
    }
  };
  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const path = editingCategoryId
        ? `/category/${editingCategoryId}`
        : "/category";
      await controlRequest<Category>(path, {
        method: editingCategoryId ? "PUT" : "POST",
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      setCategoryName("");
      setEditingCategoryId(null);
      await load();
      setNotice(
        editingCategoryId ? "Categoría actualizada." : "Categoría creada.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la categoría.",
      );
    }
  };
  const editCategory = (category: Category) => {
    setCategoryName(category.name);
    setEditingCategoryId(category.id);
  };
  const deleteCategory = async (category: Category) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría “${category.name}”? Dejará de estar disponible para nuevos productos.`,
      )
    )
      return;
    try {
      await controlRequest<void>(`/category/${category.id}`, {
        method: "DELETE",
      });
      if (editingCategoryId === category.id) {
        setEditingCategoryId(null);
        setCategoryName("");
      }
      await load();
      setNotice("Categoría eliminada.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la categoría. Puede estar vinculada a un producto.",
      );
    }
  };
  const productRow = (product: Product) => <div key={product.id} className="product-category-row">
    <strong>{`${product.name} - ${product.category?.name || "Sin categoría"} - ${product.gender || "Sin género"}${product.size ? ` - ${product.size}` : ""}`}{colors[product.id] && <span className="product-color-chip"><span className="product-color-dot" style={colorSwatch(colors[product.id]) ? { background: colorSwatch(colors[product.id]) || undefined } : undefined} aria-hidden="true" />{colors[product.id]}</span>}</strong>
    <span className="category-actions"><button type="button" className="plain-button" onClick={() => editProduct(product)}>Editar</button><button type="button" className="plain-button" onClick={() => duplicateProduct(product)}>Duplicar</button><button type="button" className="danger-link" onClick={() => void deleteProduct(product)}>Eliminar</button></span>
  </div>;
  const lowStock = useMemo(
    () =>
      products.filter(
        (product) => product.currentStock <= product.minStockAlert,
      ),
    [products],
  );

  if (!token)
    return (
      <section className="control-login">
        <div>
          <p>CONTROL DE VENTAS</p>
          <h1>
            {authMode === "login"
              ? "Conecta tu sistema de ventas"
              : "Crea tu espacio de ventas"}
          </h1>
          <span>
            {authMode === "login"
              ? "Inicia sesión con las credenciales de Sock Control."
              : "Tu cuenta tendrá un espacio independiente para clientes, ventas e inventario."}
          </span>
          <small>API configurada: {controlApi}</small>
        </div>
        <form onSubmit={authMode === "login" ? login : register}>
          <div className="control-auth-toggle">
            <button
              type="button"
              className={authMode === "login" ? "selected" : ""}
              onClick={() => {
                setAuthMode("login");
                setNotice("");
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={authMode === "register" ? "selected" : ""}
              onClick={() => {
                setAuthMode("register");
                setNotice("");
              }}
            >
              Registrarme
            </button>
          </div>
          {authMode === "register" && (
            <>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nombre de usuario"
                minLength={3}
                maxLength={50}
                autoComplete="username"
                required
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Correo electrónico"
                autoComplete="email"
                required
              />
            </>
          )}{" "}
          {authMode === "login" && (
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Usuario o correo"
              autoComplete="username"
              required
            />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            minLength={8}
            autoComplete={
              authMode === "login" ? "current-password" : "new-password"
            }
            required
          />
          {authMode === "register" && (
            <input
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              type="password"
              placeholder="Confirmar contraseña"
              minLength={8}
              autoComplete="new-password"
              required
            />
          )}
          <button disabled={loading}>
            {loading
              ? "Procesando…"
              : authMode === "login"
                ? "Conectar"
                : "Crear cuenta"}
          </button>
          {notice && <em>{notice}</em>}
        </form>
      </section>
    );
  return (
    <section className="control-panel">
      <header>
        <div>
          <p>{["packing", "weights", "stack-measures", "bundles"].includes(tab) ? "CONFIGURACIÓN" : "CONTROL DE VENTAS"}</p>
          <h1>{tab === "inventory" ? "Inventario" : tab === "packing" ? "Configuración de paquetes" : tab === "weights" ? "Peso de productos" : tab === "stack-measures" ? "Medidas de pilas" : tab === "bundles" ? "Configuración de bundles" : "Operación comercial"}</h1>
          <span>
            {["packing", "weights", "stack-measures", "bundles"].includes(tab) ? "Administra los datos de tus paquetes y productos." : "Inventario, clientes, ventas y reportes conectados a Sock Control."}
          </span>
        </div>
        <div>
          <button
            type="button"
            className="plain-button"
            onClick={() => { if (tab === "inventory") setInventoryRevision(value => value + 1); else void load(); }}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
          <button
            type="button"
            className="plain-button"
            onClick={() => {
              controlSession.clear();
              setToken(null);
              onTabChange("summary");
            }}
          >
            Desconectar
          </button>
        </div>
      </header>
      {notice && <div className="control-notice">{notice}</div>}
      {tab === "summary" && (
        <div className="control-summary">
          <article>
            <small>Clientes</small>
            <b>{customers.length}</b>
          </article>
          <article>
            <small>Productos</small>
            <b>{products.length}</b>
          </article>
          <article>
            <small>Stock bajo</small>
            <b className={lowStock.length ? "warning" : ""}>
              {lowStock.length}
            </b>
          </article>
          <article>
            <small>Ventas cargadas</small>
            <b>{sales.length}</b>
          </article>
          <section>
            <h2>Productos que requieren atención</h2>
            {lowStock.length ? (
              lowStock.map((product) => (
                <div className="stock-row" key={product.id}>
                  <span>{product.name}</span>
                  <b>{product.currentStock} disponibles</b>
                </div>
              ))
            ) : (
              <p>No hay alertas de inventario.</p>
            )}
          </section>
        </div>
      )}
      {tab === "customers" && (
        <div className="control-customers">
          <form className="customer-form" onSubmit={saveCustomer}>
            <h2>Nuevo cliente</h2>
            <input
              value={customerDraft.name}
              onChange={(event) =>
                setCustomerDraft({ ...customerDraft, name: event.target.value })
              }
              placeholder="Nombre"
              required
            />
            <input
              value={customerDraft.phone}
              onChange={(event) =>
                setCustomerDraft({
                  ...customerDraft,
                  phone: event.target.value,
                })
              }
              placeholder="Teléfono"
            />
            <select
              value={customerDraft.externalId}
              onChange={(event) => {
                const selected = chats.find(
                  (chat) => (chat.contactId || chat.id) === event.target.value,
                );
                setCustomerDraft({
                  name: customerDraft.name || selected?.name || "",
                  phone: customerDraft.phone || selected?.phone_number || "",
                  externalId: event.target.value,
                });
              }}
            >
              <option value="">Sin vínculo con Merlyn Seller</option>
              {chats.map((chat) => (
                <option key={chat.id} value={chat.contactId || chat.id}>
                  {chat.name || chat.phone_number}
                </option>
              ))}
            </select>
            <button>Guardar cliente</button>
          </form>
          <section className="control-table">
            <h2>Clientes</h2>
            {customers.map((customer) => (
              <div key={customer.id}>
                <strong>{customer.name}</strong>
                <span>{customer.phone || "Sin teléfono"}</span>
                <small>
                  {customer.externalId
                    ? "Vinculado a Merlyn Seller"
                    : "Sin vínculo"}
                </small>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "categories" && (
        <div className="control-customers category-workspace">
          <form className="customer-form category-form" onSubmit={saveCategory}>
            <div>
              <p className="form-kicker">CATÁLOGO</p>
              <h2>
                {editingCategoryId ? "Editar categoría" : "Nueva categoría"}
              </h2>
              <span className="form-description">
                Organiza tus productos de mayoreo antes de agregarlos al
                inventario.
              </span>
            </div>
            <label>
              Nombre de la categoría
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Ej. Calcetas deportivas"
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <div className="category-form-actions">
              <button>
                {editingCategoryId
                  ? "Actualizar categoría"
                  : "Guardar categoría"}
              </button>
              {editingCategoryId && (
                <button
                  type="button"
                  className="plain-button"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCategoryName("");
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          <section className="control-table category-table">
            <header>
              <div>
                <p className="form-kicker">CATÁLOGO</p>
                <h2>Categorías</h2>
              </div>
              <b>{categories.length}</b>
            </header>
            {categories.length === 0 && (
              <p>Aún no hay categorías registradas.</p>
            )}
            {categories.map((category) => (
              <div key={category.id}>
                <span className="category-initial">
                  {category.name.charAt(0).toUpperCase()}
                </span>
                <strong>{category.name}</strong>
                <small>#{category.id}</small>
                <span className="category-actions">
                  <button
                    type="button"
                    className="plain-button"
                    onClick={() => editCategory(category)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="danger-link"
                    onClick={() => void deleteCategory(category)}
                  >
                    Eliminar
                  </button>
                </span>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "inventory" && <InventoryPanel refreshKey={inventoryRevision}/>}
      {tab === "products" && (
        <div className="control-customers inventory-workspace">
          <div className="product-editor-column">
          <div className="product-mode-switch" role="tablist" aria-label="Tipo de alta">
            <button type="button" role="tab" aria-selected={productMode === "single"} onClick={() => setProductMode("single")}>Producto individual</button>
            <button type="button" role="tab" aria-selected={productMode === "variants"} onClick={() => openVariantGenerator(null)}>Modelo con colores y tallas</button>
          </div>
          {productMode === "variants" ? <VariantGenerator key={variantRevision} categories={categories} products={products} colors={colors} models={models} initial={variantPrefill}
            onCancel={() => setProductMode("single")}
            onCreated={async message => { setProductMode("single"); setVariantPrefill(null); await load(); setNotice(message); }} /> :
          <form className="customer-form product-form" onSubmit={saveProduct}>
            <div>
              <p className="form-kicker">CATÁLOGO</p>
              <h2>{editingProductId ? "Editar producto" : "Nuevo producto"}</h2>
              <span className="form-description">
                Crea el artículo antes de registrar sus compras y existencias.
              </span>
            </div>
            <label>
              Nombre del producto
              <input
                value={productDraft.name}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, name: event.target.value })
                }
                placeholder="Ej. Calceta deportiva algodón"
                required
              />
            </label>
            <label>
              Modelo (opcional)
              <input list="product-models" value={productDraft.model} onChange={(event) => setProductDraft({ ...productDraft, model: event.target.value })} placeholder="Agrupa colores y tallas del mismo producto" maxLength={80} />
              <datalist id="product-models">{modelNames.map(name => <option key={name} value={name} />)}</datalist>
            </label>
            <div className="form-pair">
              <label>
                Categoría
                <select
                  value={productDraft.categoryId}
                  onChange={(event) =>
                    setProductDraft({
                      ...productDraft,
                      categoryId: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Selecciona categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Género
                <select
                  value={productDraft.gender}
                  onChange={(event) =>
                    setProductDraft({
                      ...productDraft,
                      gender: event.target.value,
                    })
                  }
                >
                  {["Hombre", "Mujer", "Unisex", "Niño", "Niña", "Bebé niño", "Bebé niña"].map(
                    (gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Tamaño / talla
                <input value={productDraft.size} onChange={(event) => setProductDraft({ ...productDraft, size: event.target.value })} placeholder="Ej. Unitalla, 22–25" maxLength={80} />
              </label>
              <label>
                Color (opcional)
                <span className="product-color-input">
                  <span className="product-color-dot" style={colorSwatch(productDraft.color) ? { background: colorSwatch(productDraft.color) || undefined } : undefined} data-empty={productDraft.color.trim() ? undefined : ""} aria-hidden="true" />
                  <input list="product-colors" value={productDraft.color} onChange={(event) => setProductDraft({ ...productDraft, color: event.target.value })} placeholder="Ej. Negro, Azul marino" maxLength={40} />
                </span>
                <datalist id="product-colors">{COMMON_COLORS.map(color => <option key={color} value={color} />)}</datalist>
              </label>
            </div>
            <div className="product-cost-section">
              <b>Control de existencias</b>
              <label>
                Alerta de stock mínimo
                <input
                  type="number"
                  min="0"
                  value={productDraft.minStockAlert}
                  onChange={(event) =>
                    setProductDraft({
                      ...productDraft,
                      minStockAlert: event.target.value,
                    })
                  }
                  required
                />
              </label>
            </div>
            <div className="category-form-actions"><button disabled={!categories.length}>
              {categories.length
                ? editingProductId ? "Actualizar producto" : "Guardar producto"
                : "Primero crea una categoría"}
            </button>{editingProductId && <button type="button" className="plain-button" onClick={resetProductEditor}>Cancelar</button>}</div>
          </form>}
          </div>
          <section className="control-table product-catalog-list">
            <h2>Productos existentes</h2>
            {products.length > 0 && <p>{products.length} productos en {productCategories.length} categorías. Abre una categoría para ver sus productos.</p>}
            {products.length === 0 && (
              <p>{loading ? "Cargando productos…" : "Aún no hay productos en tu catálogo."}</p>
            )}
            {productCategories.map((category) => (
              <details key={category.id} className="product-category-group">
                <summary><strong>{category.name}</strong><span>{category.products.length} {category.products.length === 1 ? "producto" : "productos"}</span></summary>
                <div className="product-category-content">
                {(() => {
                  const { groups, loose } = groupModels(category.products, models, colors);
                  return <>
                    {groups.map(group => <ModelStockCard key={group.key} group={group} onEdit={product => editProduct(product as Product)} onAddVariants={addVariantsTo}>
                      {[...group.products].sort((a, b) => (!a.size ? 1 : !b.size ? -1 : compareSizesDesc(a.size, b.size)) || a.name.localeCompare(b.name, "es")).map(product => productRow(product as Product))}
                    </ModelStockCard>)}
                    {groupBySize(loose).map(size => <details key={size.key} className="product-size-group" open>
                      <summary><strong>{size.label}</strong><span>{size.items.length} {size.items.length === 1 ? "producto" : "productos"}</span></summary>
                      {size.items.map(product => productRow(product))}
                    </details>)}
                  </>;
                })()}
                </div>
              </details>
            ))}
          </section>
        </div>
      )}
      {tab === "prices" && <PriceRulesPanel products={products} />}
      {tab === "packing" && <PackingRulesPanel />}
      {tab === "stack-measures" && <StackMeasurementsPanel />}
      {tab === "weights" && <section aria-label="Pesos por par de productos" className="product-weights-settings">
        <p>Configura el peso de un par completo, sin empaque. Estos valores se utilizan para cotizar envíos; no modifican los precios.</p>
        <p>{products.length} productos · {products.filter(product => Number(product.weightGrams) > 0).length} con peso configurado</p>
        {products.length === 0 && <p>{loading ? "Cargando productos…" : "No hay productos guardados. Agrégalos desde Control de ventas → Productos."}</p>}
        {products.length > 0 && <p>Abre una categoría para consultar y editar los pesos de sus productos.</p>}
        {productCategories.map(category => <details key={category.id} className="product-category-group">
          <summary>
            <strong>{category.name}</strong>
            <span>{category.products.length} {category.products.length === 1 ? "producto" : "productos"}</span>
            <span>{category.products.filter(product => Number(product.weightGrams) > 0).length} con peso configurado</span>
          </summary>
          <div className="product-weight-category-content">
        {category.products.map(product => <article key={product.id}>
          <header><h2>{product.name}</h2><p>{[product.category?.name, product.gender, product.size].filter(Boolean).join(" · ")}</p><strong>{Number(product.weightGrams) > 0 ? `Peso guardado: ${product.weightGrams} g por par` : "Peso pendiente de configurar"}</strong></header>
          <ProductWeightEditor productId={product.id} productName={product.name} weightGrams={product.weightGrams}
            onSaved={weight => setProducts(current => current.map(item => item.id === product.id ? { ...item, weightGrams: weight } : item))} />
        </article>)}
          </div>
        </details>)}
      </section>}
      {tab === "bundles" && <BundleConfiguration products={products} packages={entrepreneurPackages} onCreateImageSet={onCreateBundleImageSet} onUploadImage={onUploadBundleImage} onProductsChanged={async()=>setProducts(await controlRequest<Product[]>("/products/all"))} />}
      {tab === "sales" && <SalesWorkspace />}
      {tab === "purchases" && <PurchasesWorkspace products={products} colors={colors} models={models} onInventoryChanged={async () => setProducts(await controlRequest<Product[]>("/products/all"))} />}
      {tab === "reports" && (
        <section className="control-table">
          <div className="report-controls">
            <h2>Utilidad por producto</h2>
            <label>
              Inicio
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              Fin
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => void load()}>
              Consultar
            </button>
          </div>
          {report.map((item) => (
            <div key={item.productId}>
              <strong>{item.productName}</strong>
              <span>{item.totalQuantity} vendidos</span>
              <span>Ventas: {money(item.totalSales)}</span>
              <b>Utilidad: {money(item.totalNetProfit)}</b>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
