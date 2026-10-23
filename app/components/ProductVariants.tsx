"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { request } from "../lib/api";
import { controlRequest } from "../lib/control-api";
import { COMMON_COLORS, colorSwatch } from "../lib/product-colors";
import {
  buildVariants, cellKey, existingCells, MAX_VARIANTS, normalizeModel, sortSizes, uniqueValues,
  type ModelGroup, type ProductDetail, type VariantProduct,
} from "../lib/product-variants";
import { CopyStockButton } from "./CopyStockButton";
import styles from "./ProductVariants.module.css";

export const PRODUCT_GENDERS = ["Hombre", "Mujer", "Unisex", "Niño", "Niña", "Bebé niño", "Bebé niña"];
export type VariantPrefill = { model: string; categoryId: string; gender: string; colors: string[]; sizes: string[]; minStockAlert?: string };
type Category = { id: number; name: string };

export function ColorDot({ color }: { color?: string | null }) {
  const value = colorSwatch(color);
  if (!color) return <span className={styles.dot} data-none="" aria-hidden="true" />;
  return <span className={styles.dot} style={value ? { background: value } : undefined} data-unknown={value ? undefined : ""} aria-hidden="true" />;
}

function ChipInput({ label, hint, values, onChange, suggestions, placeholder, withColor = false, max = 20 }: {
  label: string; hint: string; values: string[]; onChange: (values: string[]) => void; suggestions: string[]; placeholder: string; withColor?: boolean; max?: number;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const next = uniqueValues([...values, ...raw.split(",")].map(value => value?.slice(0, withColor ? 40 : 80))).slice(0, max);
    onChange(next);
    setText("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === ",") && text.trim()) { event.preventDefault(); add(text); }
    else if (event.key === "Enter") event.preventDefault();
    else if (event.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
  };
  const taken = new Set(values.map(value => value.toLocaleLowerCase("es")));
  const pending = suggestions.filter(value => !taken.has(value.toLocaleLowerCase("es"))).slice(0, 10);
  return <div className={styles.chipField}>
    <span className={styles.label}>{label}</span>
    <div className={styles.chipBox}>
      {values.map(value => <span key={value} className={styles.chip}>
        {withColor && <ColorDot color={value} />}{value}
        <button type="button" onClick={() => onChange(values.filter(item => item !== value))} aria-label={`Quitar ${value}`}>✕</button>
      </span>)}
      <input value={text} onChange={event => setText(event.target.value)} onKeyDown={onKey} onBlur={() => { if (text.trim()) add(text); }}
        placeholder={values.length ? "Agregar otro…" : placeholder} disabled={values.length >= max} aria-label={label} />
    </div>
    <small>{hint}</small>
    {pending.length > 0 && <div className={styles.suggestions}>
      {pending.map(value => <button key={value} type="button" onClick={() => add(value)}>{withColor && <ColorDot color={value} />}＋ {value}</button>)}
    </div>}
  </div>;
}

export function VariantGenerator({ categories, products, colors, models, initial, onCreated, onCancel }: {
  categories: Category[]; products: VariantProduct[]; colors: Record<number, string>; models: Record<number, string>;
  initial?: VariantPrefill | null; onCreated: (message: string) => void | Promise<void>; onCancel?: () => void;
}) {
  const [model, setModel] = useState(initial?.model || "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "");
  const [gender, setGender] = useState(initial?.gender || "Hombre");
  const [minStockAlert, setMinStockAlert] = useState(initial?.minStockAlert || "12");
  const [colorList, setColorList] = useState<string[]>(initial?.colors.filter(Boolean) || []);
  const [sizeList, setSizeList] = useState<string[]>(sortSizes(initial?.sizes.filter(Boolean) || []));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const modelNames = useMemo(() => uniqueValues(Object.values(models)).sort((a, b) => a.localeCompare(b, "es")), [models]);
  const knownSizes = useMemo(() => sortSizes(uniqueValues(products.map(product => product.size))), [products]);
  const knownColors = useMemo(() => uniqueValues([...Object.values(colors), ...COMMON_COLORS]), [colors]);
  const existing = useMemo(() => existingCells(products, models, colors, model, categoryId, gender), [products, models, colors, model, categoryId, gender]);
  const combos = buildVariants(model || "Modelo", colorList, sizeList);
  const selected = combos.filter(combo => !existing.has(combo.key) && !excluded.has(combo.key));
  const rows = colorList.length ? colorList : [""];
  const columns = sizeList.length ? sizeList : [""];
  const toggle = (key: string) => setExcluded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const sample = selected[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const name = normalizeModel(model);
    if (!name) return setError("Escribe el nombre del modelo.");
    if (!categoryId) return setError("Elige la categoría.");
    if (!colorList.length && !sizeList.length) return setError("Agrega al menos un color o una talla.");
    if (!selected.length) return setError(existing.size ? "Todas las combinaciones marcadas ya existen." : "Marca al menos una combinación.");
    if (selected.length > MAX_VARIANTS) return setError(`Máximo ${MAX_VARIANTS} variantes a la vez.`);
    setBusy(true);
    try {
      const payload = selected.map(combo => ({
        name: combo.name, size: combo.size || null, category: { id: Number(categoryId) }, gender,
        minStockAlert: Number(minStockAlert || 0), currentStock: 0,
      }));
      const created = await controlRequest<VariantProduct[]>("/products", { method: "POST", body: JSON.stringify(payload) });
      const ids = (Array.isArray(created) ? created : []).map(product => product?.id);
      if (ids.length !== payload.length || ids.some(id => !id)) {
        await onCreated("Control creó los productos pero no devolvió sus números. Revisa la lista y asígnales el modelo desde Editar.");
        return;
      }
      try {
        await request<ProductDetail[]>("/product-details", {
          method: "PUT",
          body: JSON.stringify({ items: selected.map((combo, index) => ({ productId: ids[index], model: name, color: combo.color || null })) }),
        });
      } catch (detailError) {
        await onCreated(`Se crearon ${ids.length} productos, pero no se pudo guardar su modelo y color (${detailError instanceof Error ? detailError.message : "error"}). Asígnalos desde Editar.`);
        return;
      }
      await onCreated(`Listo: ${ids.length} ${ids.length === 1 ? "variante creada" : "variantes creadas"} de “${name}”. Registra una compra para agregar existencias.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible crear las variantes.");
    } finally {
      setBusy(false);
    }
  };

  return <form className={styles.generator} onSubmit={submit} noValidate>
    <label className={styles.field}>
      <span className={styles.label}>Nombre del modelo</span>
      <input list="variant-models" value={model} onChange={event => setModel(event.target.value)} placeholder="Ej. Deportiva algodón" maxLength={80} />
      <datalist id="variant-models">{modelNames.map(name => <option key={name} value={name} />)}</datalist>
      <small>Sin color ni talla: eso va abajo.</small>
    </label>
    <div className={styles.row}>
      <label className={styles.field}>
        <span className={styles.label}>Categoría</span>
        <select value={categoryId} onChange={event => setCategoryId(event.target.value)}>
          <option value="">Selecciona categoría</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Género</span>
        <select value={gender} onChange={event => setGender(event.target.value)}>{PRODUCT_GENDERS.map(item => <option key={item}>{item}</option>)}</select>
      </label>
    </div>
    <ChipInput label="Colores" hint="Escribe y presiona Enter, o toca una sugerencia." values={colorList} onChange={setColorList} suggestions={knownColors} placeholder="Ej. Negro" withColor />
    <ChipInput label="Tallas" hint="Ej. 22-25, 25-28, Unitalla." values={sizeList} onChange={values => setSizeList(sortSizes(values))} suggestions={knownSizes} placeholder="Ej. 25-28" />
    <label className={styles.field}>
      <span className={styles.label}>Alerta de stock mínimo (por variante)</span>
      <input type="number" min="0" value={minStockAlert} onChange={event => setMinStockAlert(event.target.value)} />
    </label>

    {(colorList.length > 0 || sizeList.length > 0) && <section className={styles.preview} aria-label="Combinaciones a crear">
      <header>
        <strong>{selected.length} {selected.length === 1 ? "variante" : "variantes"} por crear</strong>
        <span>
          <button type="button" onClick={() => setExcluded(new Set())}>Todas</button>
          <button type="button" onClick={() => setExcluded(new Set(combos.map(combo => combo.key)))}>Ninguna</button>
        </span>
      </header>
      <div className={styles.matrixWrap}><table className={styles.matrix}>
        <thead><tr><th scope="col">Color \ Talla</th>{columns.map(size => <th key={size} scope="col">{size || "Sin talla"}</th>)}</tr></thead>
        <tbody>{rows.map(color => <tr key={color}>
          <th scope="row"><span className={styles.rowLabel}><ColorDot color={color} />{color || "Sin color"}</span></th>
          {columns.map(size => {
            const key = cellKey(color, size);
            if (existing.has(key)) return <td key={size}><span className={styles.exists}>Ya existe</span></td>;
            return <td key={size}><label className={styles.cellCheck}><input type="checkbox" checked={!excluded.has(key)} onChange={() => toggle(key)} aria-label={`${color || "Sin color"} ${size || "sin talla"}`} /></label></td>;
          })}
        </tr>)}</tbody>
      </table></div>
      {sample && <p className={styles.note}>Cada variante es un producto con su propio stock. Ejemplo: <b>{sample.name}</b>{sample.size ? <> · talla <b>{sample.size}</b></> : null}.</p>}
    </section>}

    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="submit" className={styles.primary} disabled={busy || !categories.length}>{busy ? "Creando…" : !categories.length ? "Primero crea una categoría" : `Crear ${selected.length || ""} ${selected.length === 1 ? "variante" : "variantes"}`.replace("  ", " ")}</button>
      {onCancel && <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>Cancelar</button>}
    </div>
  </form>;
}

const level = (product: VariantProduct) => {
  const stock = Number(product.currentStock || 0);
  return stock <= 0 ? "out" : stock <= Number(product.minStockAlert ?? 0) ? "low" : "ok";
};

export function ModelStockCard({ group, onEdit, onAddVariants, children }: {
  group: ModelGroup; onEdit: (product: VariantProduct) => void; onAddVariants: (group: ModelGroup) => void; children?: ReactNode;
}) {
  return <article className={styles.modelCard}>
    <header>
      <div>
        <strong>{group.model}</strong>
        <small>{[group.gender, `${group.products.length} ${group.products.length === 1 ? "variante" : "variantes"}`, `${group.stock} piezas`].filter(Boolean).join(" · ")}</small>
      </div>
      {group.low > 0 && <span className={styles.lowBadge}>{group.low} por surtir</span>}
      {group.products[0] && <CopyStockButton productId={group.products[0].id} />}
      <button type="button" className={styles.secondary} onClick={() => onAddVariants(group)}>＋ Colores o tallas</button>
    </header>
    <div className={styles.matrixWrap}><table className={styles.matrix}>
      <thead><tr><th scope="col">Color \ Talla</th>{group.sizes.map(size => <th key={size} scope="col">{size || "Sin talla"}</th>)}</tr></thead>
      <tbody>{group.colors.map(color => <tr key={color}>
        <th scope="row"><span className={styles.rowLabel}><ColorDot color={color} />{color || "Sin color"}</span></th>
        {group.sizes.map(size => {
          const product = group.cells[cellKey(color, size)];
          return <td key={size}>{product
            ? <button type="button" className={styles.stockCell} data-level={level(product)} onClick={() => onEdit(product)} title={`Editar ${product.name}${size ? ` · ${size}` : ""} (mínimo ${product.minStockAlert ?? 0})`}>{product.currentStock ?? 0}</button>
            : <span className={styles.noCell} title="No existe esta combinación">—</span>}</td>;
        })}
      </tr>)}</tbody>
    </table></div>
    <p className={styles.legend}><span data-level="ok" /> Con stock <span data-level="low" /> Por surtir <span data-level="out" /> Agotado · Toca un número para editar esa variante.</p>
    {children && <details className={styles.variantList}><summary>Ver lista de variantes</summary>{children}</details>}
  </article>;
}
