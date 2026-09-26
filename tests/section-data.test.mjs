import test from "node:test";
import assert from "node:assert/strict";
import { crmResources, controlResources } from "../app/lib/section-data.ts";

test("initial inbox only loads conversations and its column filters", () => {
  assert.deepEqual(crmResources("inbox", "summary"), ["chats", "pipeline"]);
});

test("self-contained sections do not trigger any global CRM catalogs", () => {
  for (const view of ["shipping", "feature", "ecommerce-orders", "ecommerce-products", "ecommerce-bundles", "ecommerce-testimonials"]) {
    assert.deepEqual(crmResources(view, "summary"), [], view);
  }
});

test("management sections request only their own dependencies", () => {
  const expected = {
    pipeline: ["pipeline"], remarketing: ["pipeline", "presets"],
    automations: ["automations"], "quick-replies": ["ctaTemplates", "quickReplies"],
    stickers: ["stickers"], "cta-buttons": ["ctaTemplates"], templates: ["templates"],
    documents: ["documents"], collections: ["collections"],
    scenarios: ["collections", "pipeline", "scenarios"],
  };
  for (const [view, resources] of Object.entries(expected)) assert.deepEqual(crmResources(view, "summary"), resources, view);
});

test("chat tools load only when a conversation is visible, without duplicates", () => {
  const tools = crmResources("inbox", "summary", true);
  assert.deepEqual(tools, ["automations", "chats", "collections", "pipeline", "quickReplies", "stickers"]);
  assert.equal(new Set(tools).size, tools.length);
  assert.deepEqual(crmResources("inbox", "summary", false), ["chats", "pipeline"]);
  assert.ok(crmResources("pipeline", "summary", true).includes("quickReplies"));
});

test("Control only loads CRM data for customer links or bundle photos", () => {
  assert.deepEqual(crmResources("control", "customers"), ["chats"]);
  assert.deepEqual(crmResources("control", "bundles"), ["collections"]);
  for (const tab of ["summary", "categories", "products", "inventory", "weights", "prices", "packing", "sales", "purchases", "reports"]) {
    assert.deepEqual(crmResources("control", tab), [], tab);
  }
});

test("all Control sections have an explicit, minimal loading plan", () => {
  const expected = {
    summary: ["customers", "products", "sales"], customers: ["customers"], categories: ["categories"],
    products: ["products", "categories"], inventory: ["products"], weights: ["products"],
    prices: ["products"], bundles: ["products"], packing: [],
    sales: ["customers", "products", "sales"], purchases: ["products", "purchases"], reports: ["report"],
  };
  for (const [tab, resources] of Object.entries(expected)) assert.deepEqual(controlResources(tab), resources, tab);
});

test("an unknown section never falls back to loading everything", () => {
  assert.deepEqual(crmResources("unknown", "unknown"), []);
  assert.deepEqual(controlResources("unknown"), []);
});
