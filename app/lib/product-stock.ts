// Productos con tallas disponibles (modelo · color · género) para enviar sus imágenes desde chats y escenarios.
export type ProductPhoto = { id: number; url: string };
export type ProductFamily = { productId: number; title: string; category: string | null; sizes: string[]; caption: string | null; stock: number; photos: ProductPhoto[]; productIds: number[] };

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Busca por nombre, color, género, categoría o talla; con «solo disponibles» oculta los agotados. */
export function filterFamilies(families: ProductFamily[], query: string, onlyAvailable = true) {
  const words = norm(query).split(" ").filter(Boolean);
  return families.filter(family => {
    if (onlyAvailable && !family.sizes.length) return false;
    const haystack = ` ${norm([family.title, family.category || "", ...family.sizes].join(" "))} `;
    return words.every(word => haystack.includes(` ${word}`));
  });
}

/** Texto que verá el cliente: el mensaje propio y debajo las tallas. null = no se enviará (agotado). */
export function previewCaption(extra: string | undefined, family: Pick<ProductFamily, "caption"> | undefined) {
  if (!family?.caption) return null;
  return [extra?.trim(), family.caption].filter(Boolean).join("\n");
}

/** Estado del producto para el editor: listo, agotado, o falta imagen. */
export function itemStatus(family: ProductFamily | undefined, hasOwnImage: boolean): "ready" | "missing" | "soldOut" | "noPhoto" {
  if (!family) return "missing";
  if (!family.sizes.length) return "soldOut";
  if (!hasOwnImage && !family.photos.length) return "noPhoto";
  return "ready";
}
