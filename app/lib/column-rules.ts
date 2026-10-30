/** «Si llega este mensaje (y el número es de esta lada) → mover a esta columna». */
export type ColumnRule = { id: string; name: string; phrases: string[]; areaCodes?: string[]; matchMode: "contains" | "exact"; columnId: string; columnName?: string; isActive: boolean; position: number };
export type ColumnRuleDraft = { name: string; phrases: string; areaCodes: string; matchMode: "contains" | "exact"; columnId: string; isActive: boolean };

export const emptyRuleDraft = (columnId = ""): ColumnRuleDraft => ({ name: "", phrases: "", areaCodes: "", matchMode: "contains", columnId, isActive: true });
export const draftFromRule = (rule: ColumnRule): ColumnRuleDraft => ({ name: rule.name, phrases: rule.phrases.join("\n"), areaCodes: (rule.areaCodes || []).join(", "), matchMode: rule.matchMode, columnId: rule.columnId, isActive: rule.isActive });
export const splitPhrases = (text: string) => text.split(/\n|,/).map(item => item.trim().replace(/\s+/g, " ")).filter(Boolean);
/** Ladas separadas por coma, espacio o renglón; se quitan signos y paréntesis. */
export const splitAreaCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).map(item => item.replace(/\D/g, "")).filter(Boolean))];

export function ruleIssues(draft: ColumnRuleDraft): string[] {
  const phrases = splitPhrases(draft.phrases);
  const codes = splitAreaCodes(draft.areaCodes);
  const invalid = codes.find(code => !/^\d{2,3}$/.test(code));
  return [
    !draft.name.trim() ? "Escribe un nombre para la regla." : "",
    !phrases.length && !codes.length ? "Escribe al menos una frase o una lada." : "",
    phrases.some(item => item.length > 120) ? "Cada frase admite máximo 120 caracteres." : "",
    invalid ? `«${invalid}» no es una lada: escribe 2 o 3 dígitos, p. ej. 272 o 55.` : "",
    !draft.columnId ? "Elige la columna a la que se moverá." : "",
  ].filter(Boolean);
}
export const rulePayload = (draft: ColumnRuleDraft) => ({ name: draft.name.trim(), phrases: splitPhrases(draft.phrases), areaCodes: splitAreaCodes(draft.areaCodes), matchMode: draft.matchMode, columnId: draft.columnId, isActive: draft.isActive });

/** Número nacional de 10 dígitos de un teléfono mexicano (igual que el servidor). */
export function nationalNumber(phone: string) {
  if (!phone || /^(fb|ig):/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  if (digits.length === 10) return digits;
  return null;
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
/** Misma comparación que el servidor, para probar un mensaje (y un número) antes de guardar.
 *  Las reglas con lada van primero; entre iguales gana la de más arriba. */
export function testRules<T extends Pick<ColumnRule, "id" | "phrases" | "areaCodes" | "matchMode" | "isActive">>(rules: T[], message: string, phone = "") {
  const text = fold(message);
  const national = nationalNumber(phone);
  const matches = (rule: T) => {
    if (!rule.isActive) return false;
    const codes = rule.areaCodes || [];
    if (codes.length && !(national && codes.some(code => national.startsWith(code)))) return false;
    if (!rule.phrases.length) return codes.length > 0;
    return Boolean(text) && rule.phrases.some(phrase => {
      const target = fold(phrase);
      return Boolean(target) && (rule.matchMode === "exact" ? text === target : ` ${text} `.includes(` ${target} `));
    });
  };
  return rules.find(rule => (rule.areaCodes || []).length > 0 && matches(rule)) || rules.find(rule => !(rule.areaCodes || []).length && matches(rule)) || null;
}
