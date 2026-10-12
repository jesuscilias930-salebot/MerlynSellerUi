import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const theme = read("app/app-theme.css");
const modules = ["Sidebar", "SalesWorkspace", "EcommerceCatalogPanel", "StoreOrdersPanel", "PackingRulesPanel", "StackMeasurementsPanel", "ProductWeightEditor", "ScenarioCodexConnection", "BundlePhotos", "InventoryPanel", "InventoryQuantityEditor"];

test("shared theme loads after legacy mobile styles and before Inbox layout", () => {
  const layout = read("app/layout.tsx");
  assert.ok(layout.indexOf("./mobile-chat.css") < layout.indexOf("./app-theme.css"));
  assert.ok(layout.indexOf("./app-theme.css") < layout.indexOf("./inbox-web.css"));
  assert.match(layout, /antialiased merlyn-app/);
});

test("all management CSS modules use defined shared theme tokens", () => {
  const defined = new Set([...theme.matchAll(/(--[\w-]+):/g)].map(match => match[1]));
  for (const name of modules) {
    const css = read(`app/components/${name}.module.css`);
    assert.match(css, /var\(--(?:ink|muted|green)/, name);
    for (const [, token] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(defined.has(token), `${name}: ${token}`);
    assert.doesNotMatch(css, /#(?:183c32|1c513e|dedfd6)/i, `${name} should not restore the old palette`);
  }
});

test("theme preserves switch geometry and contains responsive and reduced motion rules", () => {
  assert.match(theme, /button:not\(\[role="switch"\]\)/);
  assert.match(theme, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(theme, /@media \(max-width: 760px\)/);
  assert.match(theme, /prefers-reduced-motion: reduce/);
});
