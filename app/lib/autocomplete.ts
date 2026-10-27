/** Opciones de un autocompletado: se filtran por todas las palabras escritas, sin importar acentos ni orden. */
export type AutocompleteOption = { value: string; label: string; detail?: string; keywords?: string; disabled?: boolean };

export const foldText = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function filterOptions(options: AutocompleteOption[], query: string, limit = 50): AutocompleteOption[] {
  const words = foldText(query).split(" ").filter(Boolean);
  if (!words.length) return options.slice(0, limit);
  const scored: { option: AutocompleteOption; score: number }[] = [];
  for (const option of options) {
    const label = foldText(option.label);
    const haystack = `${label} ${foldText(option.detail || "")} ${foldText(option.keywords || "")}`;
    if (!words.every(word => haystack.includes(word))) continue;
    // Primero lo que empieza igual que lo escrito, luego lo que lo contiene en el nombre.
    const score = label.startsWith(words[0]) ? 0 : words.every(word => label.includes(word)) ? 1 : 2;
    scored.push({ option, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(entry => entry.option);
}
