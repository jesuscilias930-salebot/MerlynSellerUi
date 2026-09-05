"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { controlApi, controlRequest, controlSession } from "../lib/control-api";
import type { Chat, EntrepreneurPackage } from "../lib/types";
import { PriceRulesPanel } from "./PriceRulesPanel";
import { BundlesPanel } from "./BundlesPanel";
import { BundleImageManager } from "./BundleImageManager";

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
type PurchaseItem = {
  id?: number;
  productId?: number;
  product?: { id?: number; name?: string };
  isBulk?: boolean;
  unitsPerBulk?: number;
  bulksReceived?: number;
  individualUnitsReceived?: number;
  totalUnitsAcquired?: number;
  unitCostNet?: number;
  isTaxed?: boolean;
  pricePerBulk?: number;
  totalPaid?: number;
};
type Purchase = {
  id: number;
  supplierName?: string;
  totalInvoiceAmount?: number;
  purchaseDate?: string;
  purchaseItemsRequest?: PurchaseItem[];
};
type PurchaseDraftItem = {
  id?: number;
  productId: string;
  isBulk: boolean;
  bulksReceived: string;
  unitsPerBulk: string;
  individualUnitsReceived: string;
  unitCostNet: string;
  isTaxed: boolean;
  pricePerBulk: string;
};
type PurchaseDraft = { supplierName: string; totalInvoiceAmount: string; items: PurchaseDraftItem[] };
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
const emptyPurchaseItem = (): PurchaseDraftItem => ({ productId: "", isBulk: false, bulksReceived: "1", unitsPerBulk: "", individualUnitsReceived: "0", unitCostNet: "", isTaxed: false, pricePerBulk: "" });
const emptyPurchaseDraft = (): PurchaseDraft => ({ supplierName: "", totalInvoiceAmount: "", items: [emptyPurchaseItem()] });

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
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
  const [saleDraft, setSaleDraft] = useState({
    customerId: "",
    productId: "",
    quantity: "1",
  });
  const [productDraft, setProductDraft] = useState({
    name: "",
    categoryId: "",
    gender: "Hombre",
    size: "",
    minStockAlert: "12",
  });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>(emptyPurchaseDraft);

  const load = async () => {
    setLoading(true);
    setNotice("");
    try {
      const [
        nextCustomers,
        nextProducts,
        nextCategories,
        nextSales,
        nextPurchases,
        nextReport,
      ] = await Promise.all([
        controlRequest<Customer[]>("/customers"),
        controlRequest<Product[]>("/products/all"),
        controlRequest<Category[]>("/category"),
        controlRequest<Page<Sale>>("/sales?page=0&size=40"),
        controlRequest<Page<Purchase>>("/purchase?page=0&size=40"),
        controlRequest<Report[]>(
          `/financial-reports/product-breakdown?start=${start}&end=${end}`,
        ),
      ]);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setCategories(nextCategories);
      setSales(nextSales.content || []);
      setPurchases(nextPurchases.content || []);
      setReport(nextReport);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el Control.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const saved = controlSession.get();
    setToken(saved);
    if (saved) void load();
  }, []);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const result = await controlRequest<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      controlSession.set(result.token);
      setToken(result.token);
      await load();
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
      await load();
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
        body: JSON.stringify(customerDraft),
      });
      setCustomerDraft({ name: "", phone: "", externalId: "" });
      await load();
      setNotice("Cliente creado y vinculado.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el cliente.",
      );
    }
  };
  const createSale = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await controlRequest<Sale>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: Number(saleDraft.customerId),
          productsSold: [
            {
              productId: Number(saleDraft.productId),
              quantity: Number(saleDraft.quantity),
            },
          ],
          bundlesSold: [],
        }),
      });
      setSaleDraft({ customerId: "", productId: "", quantity: "1" });
      await load();
      setNotice("Venta registrada e inventario actualizado.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible registrar la venta.",
      );
    }
  };
  const resetProductEditor = () => {
    setEditingProductId(null);
    setProductDraft({ name: "", categoryId: "", gender: "Hombre", size: "", minStockAlert: "12" });
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
      await controlRequest<Product | Product[]>(editingProductId ? `/products/${editingProductId}` : "/products", {
        method: editingProductId ? "PUT" : "POST",
        body: JSON.stringify(editingProductId ? product : [product]),
      });
      const wasEditing = Boolean(editingProductId);
      resetProductEditor();
      await load();
      setNotice(wasEditing ? "Producto actualizado." : "Producto guardado. Registra una compra para agregar existencias.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el producto.",
      );
    }
  };
  const editProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductDraft({ name: product.name, categoryId: String(product.category?.id || ""), gender: product.gender || "Unisex", size: product.size || "", minStockAlert: String(product.minStockAlert ?? 0) });
  };
  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Eliminar el producto “${product.name}”? Esta acción puede fallar si está vinculado a compras, ventas o precios.`)) return;
    try {
      await controlRequest<void>(`/products/${product.id}`, { method: "DELETE" });
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
  const resetPurchaseEditor = () => {
    setEditingPurchaseId(null);
    setPurchaseDraft(emptyPurchaseDraft());
  };
  const savePurchase = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const items = purchaseDraft.items.map((item) => {
        const bulksReceived = item.isBulk ? Number(item.bulksReceived || 0) : 0;
        const unitsPerBulk = item.isBulk ? Number(item.unitsPerBulk || 0) : 0;
        const individualUnitsReceived = item.isBulk
          ? 0
          : Number(item.individualUnitsReceived || 0);
        const pricePerBulk = item.isBulk ? Number(item.pricePerBulk || 0) : 0;
        const unitCostNet = item.isBulk
          ? pricePerBulk / unitsPerBulk
          : Number(item.unitCostNet);
        const totalUnitsAcquired =
          bulksReceived * unitsPerBulk + individualUnitsReceived;

        return {
          ...(item.id ? { id: item.id } : {}),
          productId: Number(item.productId),
          isBulk: item.isBulk,
          isTaxed: item.isTaxed,
          bulksReceived,
          unitsPerBulk,
          individualUnitsReceived,
          unitCostNet,
          pricePerBulk: item.isBulk ? pricePerBulk : null,
          // Son una vista previa para el usuario; el backend los recalcula.
          totalUnitsAcquired,
          totalPaid: unitCostNet * totalUnitsAcquired,
        };
      });
      if (
        items.some(
          (item, index) =>
            !item.productId ||
            (!item.isBulk && purchaseDraft.items[index].unitCostNet === "") ||
            item.unitCostNet < 0 ||
            (item.isBulk &&
              (!item.bulksReceived || !item.unitsPerBulk || !item.pricePerBulk)) ||
            (!item.isBulk && !item.individualUnitsReceived),
        )
      )
        throw new Error(
          "Completa producto, cantidades y costo de cada compra.",
        );
      await controlRequest<Purchase>(editingPurchaseId ? `/purchase/${editingPurchaseId}` : "/purchase", {
        method: editingPurchaseId ? "PUT" : "POST",
        body: JSON.stringify({
          supplierName: purchaseDraft.supplierName || null,
          totalInvoiceAmount: purchaseDraft.totalInvoiceAmount
            ? Number(purchaseDraft.totalInvoiceAmount)
            : null,
          purchaseItemsRequest: items,
        }),
      });
      const wasEditing = Boolean(editingPurchaseId);
      resetPurchaseEditor();
      await load();
      setNotice(wasEditing ? "Compra actualizada e inventario recalculado." : "Compra registrada e inventario actualizado.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible registrar la compra.",
      );
    }
  };
  const editPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setPurchaseDraft({
      supplierName: purchase.supplierName || "",
      totalInvoiceAmount: purchase.totalInvoiceAmount == null ? "" : String(purchase.totalInvoiceAmount),
      items: (purchase.purchaseItemsRequest?.length ? purchase.purchaseItemsRequest : [undefined]).map((item) => ({
        ...(item?.id ? { id: item.id } : {}),
        productId: String(item?.productId || item?.product?.id || ""),
        isBulk: Boolean(item?.isBulk),
        bulksReceived: String(item?.bulksReceived ?? 0),
        unitsPerBulk: String(item?.unitsPerBulk ?? ""),
        individualUnitsReceived: String(item?.individualUnitsReceived ?? 0),
        unitCostNet: String(item?.unitCostNet ?? ""),
        isTaxed: Boolean(item?.isTaxed),
        pricePerBulk: String(item?.pricePerBulk ?? ""),
      })),
    });
  };
  const deletePurchase = async (purchase: Purchase) => {
    if (!window.confirm(`¿Eliminar la compra #${purchase.id}? Úsalo solo si fue un registro equivocado; verifica el inventario después.`)) return;
    try {
      await controlRequest<void>(`/purchase/${purchase.id}`, { method: "DELETE" });
      if (editingPurchaseId === purchase.id) resetPurchaseEditor();
      await load();
      setNotice("Compra eliminada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible eliminar la compra.");
    }
  };
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
          <p>CONTROL DE VENTAS</p>
          <h1>Operación comercial</h1>
          <span>
            Inventario, clientes, ventas y reportes conectados a Sock Control.
          </span>
        </div>
        <div>
          <button
            type="button"
            className="plain-button"
            onClick={() => void load()}
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
      {tab === "inventory" && (
        <div className="control-customers inventory-workspace">
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
                  {["Hombre", "Mujer", "Unisex", "Niño", "Niña"].map(
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
          </form>
          <section className="control-table">
            <h2>Inventario</h2>
            {products.length === 0 && (
              <p>Aún no hay productos en tu catálogo.</p>
            )}
            {products.map((product) => (
              <div
                key={product.id}
                className={
                  product.currentStock <= product.minStockAlert ? "low" : ""
                }
              >
                <strong>{`${product.name} - ${product.category?.name || "Sin categoría"} - ${product.gender || "Sin género"}${product.size ? ` - ${product.size}` : ""}`}</strong>
                <b>{product.currentStock} disponibles</b>
                <span className="category-actions"><button type="button" className="plain-button" onClick={() => editProduct(product)}>Editar</button><button type="button" className="danger-link" onClick={() => void deleteProduct(product)}>Eliminar</button></span>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "prices" && <PriceRulesPanel products={products} />}
      {tab === "bundles" && <><BundlesPanel products={products} /><BundleImageManager packages={entrepreneurPackages} onCreate={onCreateBundleImageSet} onUpload={onUploadBundleImage} /></>}
      {tab === "sales" && (
        <div className="control-customers">
          <form className="customer-form" onSubmit={createSale}>
            <h2>Registrar venta</h2>
            <select
              value={saleDraft.customerId}
              onChange={(event) =>
                setSaleDraft({ ...saleDraft, customerId: event.target.value })
              }
              required
            >
              <option value="">Selecciona cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <select
              value={saleDraft.productId}
              onChange={(event) =>
                setSaleDraft({ ...saleDraft, productId: event.target.value })
              }
              required
            >
              <option value="">Selecciona producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.currentStock} disponibles
                </option>
              ))}
            </select>
            <input
              min="1"
              type="number"
              value={saleDraft.quantity}
              onChange={(event) =>
                setSaleDraft({ ...saleDraft, quantity: event.target.value })
              }
              required
            />
            <button>Registrar venta</button>
          </form>
          <section className="control-table">
            <h2>Ventas recientes</h2>
            {sales.map((sale) => (
              <div key={sale.id}>
                <strong>Venta #{sale.id}</strong>
                <span>{sale.customer?.name || "Cliente"}</span>
                <b>
                  {sale.saleItemDtoList?.reduce(
                    (sum, item) =>
                      sum +
                      Number(item.unitPriceAtSale || 0) *
                        Number(item.quantity || 0),
                    0,
                  )
                    ? money(
                        sale.saleItemDtoList.reduce(
                          (sum, item) =>
                            sum +
                            Number(item.unitPriceAtSale || 0) *
                              Number(item.quantity || 0),
                          0,
                        ),
                      )
                    : "Sin detalles"}
                </b>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "purchases" && (
        <div className="control-customers">
          <form
            className="customer-form purchase-form"
            onSubmit={savePurchase}
          >
            <header><div><p className="form-kicker">INVENTARIO</p><h2>{editingPurchaseId ? `Editar compra #${editingPurchaseId}` : "Registrar compra"}</h2></div>{editingPurchaseId && <button type="button" className="plain-button" onClick={resetPurchaseEditor}>Cancelar edición</button>}</header>
            <input
              value={purchaseDraft.supplierName}
              onChange={(event) =>
                setPurchaseDraft({
                  ...purchaseDraft,
                  supplierName: event.target.value,
                })
              }
              placeholder="Proveedor (opcional)"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseDraft.totalInvoiceAmount}
              onChange={(event) =>
                setPurchaseDraft({
                  ...purchaseDraft,
                  totalInvoiceAmount: event.target.value,
                })
              }
              placeholder="Total de factura (opcional)"
            />
            {purchaseDraft.items.map((item, index) => (
              <fieldset key={index}>
                <legend>Producto {index + 1}</legend>
                <select
                  value={item.productId}
                  onChange={(event) =>
                    setPurchaseDraft({
                      ...purchaseDraft,
                      items: purchaseDraft.items.map((current, itemIndex) =>
                        itemIndex === index
                          ? { ...current, productId: event.target.value }
                          : current,
                      ),
                    })
                  }
                  required
                >
                  <option value="">Selecciona producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.category.name} - {product.gender || "Sin género"}
                    </option>
                  ))}
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={item.isBulk}
                    onChange={(event) =>
                      setPurchaseDraft({
                        ...purchaseDraft,
                        items: purchaseDraft.items.map((current, itemIndex) =>
                          itemIndex === index
                            ? { ...current, isBulk: event.target.checked }
                            : current,
                        ),
                      })
                    }
                  />{" "}
                  Compra por bulto
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(item.isTaxed)}
                    onChange={(event) =>
                      setPurchaseDraft({
                        ...purchaseDraft,
                        items: purchaseDraft.items.map((current, itemIndex) =>
                          itemIndex === index
                            ? { ...current, isTaxed: event.target.checked }
                            : current,
                        ),
                      })
                    }
                  />{" "}
                  Compra facturada
                </label>
                {item.isBulk && (
                  <>
                    <input
                      type="number"
                      min="1"
                      value={item.bulksReceived}
                      onChange={(event) =>
                        setPurchaseDraft({
                          ...purchaseDraft,
                          items: purchaseDraft.items.map(
                            (current, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...current,
                                    bulksReceived: event.target.value,
                                  }
                                : current,
                          ),
                        })
                      }
                      placeholder="Bultos recibidos"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.unitsPerBulk}
                      onChange={(event) =>
                        setPurchaseDraft({
                          ...purchaseDraft,
                          items: purchaseDraft.items.map(
                            (current, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...current,
                                    unitsPerBulk: event.target.value,
                                  }
                                : current,
                          ),
                        })
                      }
                      placeholder="Piezas por bulto"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.pricePerBulk}
                      onChange={(event) =>
                        setPurchaseDraft({
                          ...purchaseDraft,
                          items: purchaseDraft.items.map(
                            (current, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...current,
                                    pricePerBulk: event.target.value,
                                  }
                                : current,
                          ),
                        })
                      }
                      placeholder="Precio pagado por bulto"
                      required
                    />
                  </>
                )}
                {!item.isBulk && (
                  <>
                    <input
                      type="number"
                      min="0"
                      value={item.individualUnitsReceived}
                      onChange={(event) =>
                        setPurchaseDraft({
                          ...purchaseDraft,
                          items: purchaseDraft.items.map((current, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...current,
                                  individualUnitsReceived: event.target.value,
                                }
                              : current,
                          ),
                        })
                      }
                      placeholder="Piezas recibidas"
                      required
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.unitCostNet}
                      onChange={(event) =>
                        setPurchaseDraft({
                          ...purchaseDraft,
                          items: purchaseDraft.items.map((current, itemIndex) =>
                            itemIndex === index
                              ? { ...current, unitCostNet: event.target.value }
                              : current,
                          ),
                        })
                      }
                      placeholder="Costo neto unitario"
                      required
                    />
                  </>
                )}
                <p className="purchase-item-summary">
                  {(() => {
                    const units =
                      (item.isBulk
                        ? Number(item.bulksReceived || 0) *
                          Number(item.unitsPerBulk || 0)
                        : 0) + Number(item.individualUnitsReceived || 0);
                    const unitCost = item.isBulk
                      ? Number(item.pricePerBulk || 0) /
                        Number(item.unitsPerBulk || 1)
                      : Number(item.unitCostNet || 0);
                    return `${units} piezas · ${money(
                      units * unitCost,
                    )} total calculado`;
                  })()}
                </p>
                {purchaseDraft.items.length > 1 && (
                  <button
                    type="button"
                    className="danger compact"
                    onClick={() =>
                      setPurchaseDraft({
                        ...purchaseDraft,
                        items: purchaseDraft.items.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    Quitar producto
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              className="plain-button"
              onClick={() =>
                setPurchaseDraft({
                  ...purchaseDraft,
                  items: [
                    ...purchaseDraft.items,
                    {
                      productId: "",
                      isBulk: false,
                      bulksReceived: "1",
                      unitsPerBulk: "",
                      individualUnitsReceived: "0",
                      unitCostNet: "",
                      isTaxed: false,
                      pricePerBulk: "",
                    },
                  ],
                })
              }
            >
              ＋ Agregar producto
            </button>
            <button>{editingPurchaseId ? "Actualizar compra" : "Registrar compra"}</button>
          </form>
          <section className="control-table">
            <h2>Compras recientes</h2>
            {purchases.length === 0 && <p>Aún no hay compras registradas.</p>}
            {purchases.map((purchase) => (
              <div key={purchase.id}>
                <strong>Compra #{purchase.id}</strong>
                <span>{purchase.supplierName || "Sin proveedor"}</span>
                <span>
                  {purchase.purchaseItemsRequest
                    ?.map(
                      (item) =>
                        `${item.product?.name || "Producto"}: ${item.totalUnitsAcquired || 0} pzas`,
                    )
                    .join(" · ")}
                </span>
                <b>
                  {money(
                    purchase.totalInvoiceAmount ||
                      purchase.purchaseItemsRequest?.reduce(
                        (sum, item) => sum + Number(item.totalPaid || 0),
                        0,
                      ),
                  )}
                </b>
                <span className="category-actions"><button type="button" className="plain-button" onClick={() => editPurchase(purchase)}>Editar</button><button type="button" className="danger-link" onClick={() => void deletePurchase(purchase)}>Eliminar</button></span>
              </div>
            ))}
          </section>
        </div>
      )}
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
