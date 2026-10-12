export type VideoChannel = "organic" | "ads";
export type VideoStatus = "all" | "pending" | "published";
export type VideoDraft = {
  channel: VideoChannel; title: string; script: string; shots: string; prompts: string;
  recordingDate: string | null; publishingDate: string | null; isPublished: boolean; resultNotes: string;
};
export type ContentVideo = VideoDraft & { id: string; revision: number; createdAt: string; updatedAt: string };
export type VideoPage = { items: ContentVideo[]; total: number; page: number; size: number; stats: { total: number; pending: number; published: number } };
export const videoChannelName = (channel: VideoChannel) => channel === "organic" ? "Orgánico" : "Ads";
export function blankVideo(channel: VideoChannel): VideoDraft {
  return { channel, title: "", script: "", shots: "", prompts: "", recordingDate: null, publishingDate: null, isPublished: false, resultNotes: "" };
}
export function videoDraft(video: VideoDraft): VideoDraft {
  return { channel: video.channel, title: video.title, script: video.script, shots: video.shots, prompts: video.prompts,
    recordingDate: video.recordingDate, publishingDate: video.publishingDate, isPublished: video.isPublished, resultNotes: video.resultNotes };
}
export function videoListPath(channel: VideoChannel, status: VideoStatus, q: string, page: number): string {
  return `/content-videos?${new URLSearchParams({ channel, status, q: q.trim().slice(0, 120), page: String(Math.max(0, page)), size: "12" })}`;
}
export function videoDateLabel(value: string | null): string {
  if (!value) return "Sin programar";
  // Keep calendar dates stable in all timezones (do not parse as UTC midnight).
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
export function videoScheduleLabel(video: Pick<VideoDraft, "isPublished" | "publishingDate">, today: string): string {
  if (video.isPublished) return "Publicado";
  if (video.publishingDate && video.publishingDate < today) return "Publicación pendiente";
  if (video.publishingDate === today) return "Publicar hoy";
  return "Por publicar";
}
