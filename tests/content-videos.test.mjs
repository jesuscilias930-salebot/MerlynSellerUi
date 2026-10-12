import test from "node:test";
import assert from "node:assert/strict";
import { blankVideo, videoDraft, videoListPath, videoDateLabel, videoScheduleLabel, videoChannelName } from "../app/lib/content-videos.ts";

test("drafts only contain editable fields, with independent content type and status", () => {
  assert.equal(videoChannelName("organic"), "Orgánico"); assert.equal(videoChannelName("ads"), "Ads");
  const blank = blankVideo("ads"); assert.equal(blank.isPublished, false); assert.equal(blank.channel, "ads"); assert.equal(blank.recordingDate, null);
  assert.deepEqual(videoDraft({ ...blank, id: "not-in-body", revision: 3, organizationId: "not-in-body" }), blank);
});
test("listing only queries the selected tab, bounds search and encodes user input", () => {
  const url = new URL(videoListPath("organic", "pending", "  Ideas & guiones  ", 2), "https://local.test");
  assert.equal(url.pathname, "/content-videos");
  assert.deepEqual(Object.fromEntries(url.searchParams), { channel: "organic", status: "pending", q: "Ideas & guiones", page: "2", size: "12" });
  assert.equal(new URL(videoListPath("ads", "all", "a".repeat(200), -1), url).searchParams.get("q").length, 120);
});
test("calendar dates stay on the same day in Mexico and pending schedule states are clear", () => {
  assert.equal(videoDateLabel(null), "Sin programar");
  assert.match(videoDateLabel("2026-10-12"), /^12 /);
  for (const [video, expected] of [[{ isPublished: true, publishingDate: "2026-10-01" }, "Publicado"], [{ isPublished: false, publishingDate: "2026-10-01" }, "Publicación pendiente"], [{ isPublished: false, publishingDate: "2026-10-12" }, "Publicar hoy"], [{ isPublished: false, publishingDate: null }, "Por publicar"], [{ isPublished: false, publishingDate: "2026-10-15" }, "Por publicar"]]) assert.equal(videoScheduleLabel(video, "2026-10-12"), expected);
});
