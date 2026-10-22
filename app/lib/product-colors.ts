// Color opcional de un producto (guardado en el CRM por id de producto de Control).
export type ProductColor = { productId: number; color: string };
export const COMMON_COLORS = ["Negro", "Blanco", "Gris", "Gris jaspe", "Azul marino", "Azul", "Azul cielo", "Rojo", "Vino", "Rosa", "Morado", "Verde", "Verde militar", "Amarillo", "Naranja", "Café", "Beige", "Multicolor", "Surtido"];

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Recorta, une espacios y limita a 40 caracteres, igual que el backend. */
export const normalizeColor = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 40);
export const colorMap = (rows: ProductColor[] | null | undefined) =>
  Object.fromEntries((rows || []).filter(row => row && row.productId > 0 && row.color).map(row => [row.productId, row.color])) as Record<number, string>;

// Primero las frases más específicas ("azul marino" antes que "azul").
const SWATCHES: [string, string][] = [
  ["azul marino", "#1f2d56"], ["marino", "#1f2d56"], ["azul cielo", "#8cc4ec"], ["celeste", "#8cc4ec"], ["turquesa", "#2fb6b0"],
  ["verde militar", "#56603a"], ["olivo", "#6b6f2f"], ["gris jaspe", "#b7bcba"], ["jaspe", "#b7bcba"], ["vino", "#6d1f2f"], ["guinda", "#6d1f2f"],
  ["negro", "#1f2421"], ["blanco", "#ffffff"], ["hueso", "#f2ecdf"], ["crema", "#f1e6c8"], ["gris", "#8f9895"], ["plata", "#c7cbcc"],
  ["azul", "#2d5bd2"], ["rojo", "#c9302c"], ["rosa", "#ea8fb8"], ["fiusha", "#d1237c"], ["fucsia", "#d1237c"], ["morado", "#7c4dbd"], ["lila", "#b79be0"],
  ["verde", "#2f8f57"], ["menta", "#9fe0c1"], ["amarillo", "#efc93a"], ["mostaza", "#c99a24"], ["naranja", "#ec7f37"], ["coral", "#f17c6b"],
  ["cafe", "#7a4e2d"], ["chocolate", "#5b3620"], ["beige", "#d9c6a5"], ["camel", "#b8834f"], ["dorado", "#c9a33a"],
];
const MIXED = "conic-gradient(#c9302c, #efc93a, #2f8f57, #2d5bd2, #7c4dbd, #c9302c)";
/** Valor CSS para la muestra de color, o null si no lo reconocemos. */
export function colorSwatch(color?: string | null): string | null {
  if (!color) return null;
  const text = strip(color);
  if (/multi|surtid|varios|combinad|estampad/.test(text)) return MIXED;
  return SWATCHES.find(([name]) => text.includes(name))?.[1] ?? null;
}
