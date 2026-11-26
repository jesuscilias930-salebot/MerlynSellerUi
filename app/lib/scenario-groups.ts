// Lista de escenarios: pestañas (normales / de plantilla) y grupos por campaña.
type Groupable = { id: string; campaign?: string | null; templateTrigger?: unknown };

export type ScenarioTab = "normal" | "template";
export const GENERIC_CAMPAIGN = "Genérico";

export const isTemplateScenario = (scenario: Groupable) => Boolean(scenario.templateTrigger);
export const scenarioTab = (scenario: Groupable): ScenarioTab => isTemplateScenario(scenario) ? "template" : "normal";
export const campaignOf = (scenario: Groupable) => scenario.campaign?.trim() || null;

/** Nombres de campaña existentes, sin repetir (ignora mayúsculas) y en orden alfabético. */
export function campaignNames(scenarios: Groupable[]): string[] {
  const byKey = new Map<string, string>();
  for (const scenario of scenarios) {
    const name = campaignOf(scenario);
    if (name && !byKey.has(name.toLocaleLowerCase("es"))) byKey.set(name.toLocaleLowerCase("es"), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));
}

export type CampaignGroup<T> = { key: string; campaign: string | null; label: string; scenarios: T[] };
/** Grupos por campaña (alfabético) y al final «Genérico» con los que no tienen; conserva el orden de prioridad. */
export function groupByCampaign<T extends Groupable>(scenarios: T[]): CampaignGroup<T>[] {
  const names = campaignNames(scenarios);
  const groups: CampaignGroup<T>[] = names.map(name => ({ key: `c:${name.toLocaleLowerCase("es")}`, campaign: name, label: name, scenarios: [] }));
  const generic: CampaignGroup<T> = { key: "generic", campaign: null, label: GENERIC_CAMPAIGN, scenarios: [] };
  for (const scenario of scenarios) {
    const name = campaignOf(scenario);
    const group = name ? groups.find(item => item.campaign!.toLocaleLowerCase("es") === name.toLocaleLowerCase("es")) : undefined;
    (group || generic).scenarios.push(scenario);
  }
  return [...groups.filter(group => group.scenarios.length), ...(generic.scenarios.length ? [generic] : [])];
}
