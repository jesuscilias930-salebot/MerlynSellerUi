/** «Si llega este mensaje → mover a esta columna». */
export type ColumnRule = { id: string; name: string; phrases: string[]; matchMode: "contains" | "exact"; columnId: string; columnName?: string; isActive: boolean; position: number };
export type ColumnRuleDraft = { name: string; phrases: string; matchMode: "contains" | "exact"; columnId: string; isActive: boolean };

export const emptyRuleDraft = (columnId = ""): ColumnRuleDraft => ({ name: "", phrases: "", matchMode: "contains", columnId, isActive: true });
export const draftFromRule = (rule: ColumnRule): ColumnRuleDraft => ({ name: rule.name, phrases: rule.phrases.join("\n"), matchMode: rule.matchMode, columnId: rule.columnId, isActive: rule.isActive });
export const splitPhrases = (text: string) => text.split(/\n|,/).map(item => item.trim().replace(/\s+/g, " ")).filter(Boolean);

export function ruleIssues(draft: ColumnRuleDraft): string[] {
  const phrases = splitPhrases(draft.phrases);
  return [
    !draft.name.trim() ? "Escribe un nombre para la regla." : "",
    !phrases.length ? "Escribe al menos una frase." : "",
    phrases.some(item => item.length > 120) ? "Cada frase admite máximo 120 caracteres." : "",
    !draft.columnId ? "Elige la columna a la que se moverá." : "",
  ].filter(Boolean);
}
export const rulePayload = (draft: ColumnRuleDraft) => ({ name: draft.name.trim(), phrases: splitPhrases(draft.phrases), matchMode: draft.matchMode, columnId: draft.columnId, isActive: draft.isActive });

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
/** Misma comparación que el servidor, para probar un mensaje antes de guardar. */
export function testRules(rules: Pick<ColumnRule, "id" | "phrases" | "matchMode" | "isActive">[], message: string) {
  const text = fold(message);
  if (!text) return null;
  return rules.find(rule => rule.isActive && rule.phrases.some(phrase => {
    const target = fold(phrase);
    return Boolean(target) && (rule.matchMode === "exact" ? text === target : ` ${text} `.includes(` ${target} `));
  })) || null;
}
