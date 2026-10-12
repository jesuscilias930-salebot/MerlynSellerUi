import test from "node:test";
import assert from "node:assert/strict";
import { filterInboxContacts, messageDayKey, messageDayLabel, inboxTimestamp, messageTime, deliveryLabel } from "../app/lib/inbox-presentation.ts";

const chats = [{ name: "María Hernández", phone_number: "+52 272 123 4567" }, { name: null, phone_number: "522721112222" }];
test("inbox search keeps accents, names and formatted telephone numbers usable", () => {
  assert.deepEqual(filterInboxContacts(chats, " maria "), [chats[0]]);
  assert.deepEqual(filterInboxContacts(chats, "+52 (272) 123"), [chats[0]]);
  assert.deepEqual(filterInboxContacts(chats, "HERNÁNDEZ"), [chats[0]]);
  assert.deepEqual(filterInboxContacts(chats, "1112222"), [chats[1]]);
  assert.deepEqual(filterInboxContacts(chats, ""), chats);
  assert.deepEqual(filterInboxContacts(chats, "no existe"), []);
});
test("dates use Mexico City day boundaries, not UTC or host timezone", () => {
  assert.equal(messageDayKey("2026-10-13T02:00:00Z"), messageDayKey("2026-10-12T23:00:00Z"));
  assert.notEqual(messageDayKey("2026-10-13T07:00:00Z"), messageDayKey("2026-10-12T23:00:00Z"));
  const now = new Date("2026-10-13T02:00:00Z");
  assert.equal(messageDayLabel("2026-10-12T12:00:00Z", now), "Hoy");
  assert.equal(messageDayLabel("2026-10-11T12:00:00Z", now), "Ayer");
  assert.equal(inboxTimestamp("2026-10-11T12:00:00Z", now), "Ayer");
});
test("invalid dates never throw or display Invalid Date", () => {
  assert.equal(messageDayKey("invalid"), "unknown");
  assert.equal(messageDayLabel("invalid"), "Sin fecha");
  assert.equal(inboxTimestamp("invalid"), "");
  assert.equal(messageTime("invalid"), "");
});
test("delivery UI distinguishes failed, pending, sent, delivered and read states", () => {
  assert.equal(deliveryLabel("failed"), "No se pudo enviar");
  assert.equal(deliveryLabel("queued"), "En proceso de envío");
  assert.equal(deliveryLabel("sent"), "Enviado");
  assert.equal(deliveryLabel("delivered"), "Entregado");
  assert.equal(deliveryLabel("read"), "Leído");
});
