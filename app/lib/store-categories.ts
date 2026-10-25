/** Cómo se agrupan las categorías de Control en la página de productos de la tienda. */
export type ControlCategory = { id: number; name?: string | null };
export type SavedSection = { categoryId: number; categoryName: string; section: string; position: number };
export type CategoryRow = { categoryId: number; categoryName: string; section: string; position: string };

const clean = (value: string | null | undefined) => (value || "").trim().replace(/\s+/g, " ");
const fold = (value: string) => clean(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Una fila por categoría de Control; sin configuración, cada una va en su propia sección. */
export function categoryRows(categories: ControlCategory[], saved: SavedSection[]): CategoryRow[] {
  const byId = new Map(saved.map(row => [row.categoryId, row]));
  return categories
    .filter(category => category && Number.isInteger(category.id) && category.id > 0)
    .map(category => {
      const name = clean(category.name) || `Categoría ${category.id}`;
      const row = byId.get(category.id);
      return { categoryId: category.id, categoryName: name, section: row?.section || name, position: String(row?.position ?? 0) };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "es"));
}

/** Pestañas que verá el cliente, en orden, con las categorías que incluye cada una. */
export function sectionsPreview(rows: CategoryRow[]) {
  const sections = new Map<string, { section: string; position: number; categories: string[] }>();
  for (const row of rows) {
    const label = clean(row.section) || row.categoryName;
    const key = fold(label);
    const position = Number(row.position) || 0;
    const entry = sections.get(key) || { section: label, position, categories: [] };
    entry.position = Math.min(entry.position, position);
    entry.categories.push(row.categoryName);
    sections.set(key, entry);
  }
  return [...sections.values()].sort((a, b) => a.position - b.position || a.section.localeCompare(b.section, "es"));
}

export function categoryIssues(rows: CategoryRow[]): string[] {
  return [
    rows.some(row => !clean(row.section)) ? "Escribe en qué sección se muestra cada categoría." : "",
    rows.some(row => clean(row.section).length > 60) ? "El nombre de la sección admite máximo 60 caracteres." : "",
    rows.some(row => !/^\d{1,3}$/.test(row.position.trim() || "0")) ? "El orden debe ser un número de 0 a 999." : "",
  ].filter(Boolean);
}

/** Las categorías de una misma sección comparten el mismo nombre escrito igual. */
export function categoriesPayload(rows: CategoryRow[]) {
  const labels = new Map(sectionsPreview(rows).map(entry => [fold(entry.section), entry.section]));
  return {
    categories: rows.map(row => ({
      categoryId: row.categoryId, categoryName: row.categoryName,
      section: labels.get(fold(row.section)) || clean(row.section), position: Number(row.position.trim() || 0),
    })),
  };
}
