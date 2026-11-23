export const VIDEO_ACCEPT = 'video/mp4,video/3gpp,video/quicktime,video/x-m4v,.mp4,.3gp,.3gpp,.mov,.m4v';
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;
export function videoContentType(file: { type: string; name: string }): string | null {
  const mime = file.type.split(';')[0].trim().toLowerCase();
  if (['video/mp4', 'video/3gpp', 'video/quicktime', 'video/x-m4v'].includes(mime)) return mime;
  if (mime && mime !== 'application/octet-stream') return null;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({ mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', '3gp': 'video/3gpp', '3gpp': 'video/3gpp' } as Record<string, string>)[extension || ''] || null;
}

/** Huella SHA-256 (hex) del archivo: si ya se envió ese mismo video, se reutiliza sin subirlo. null si el navegador no puede calcularla. */
export async function fileSha256(file: Blob): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
