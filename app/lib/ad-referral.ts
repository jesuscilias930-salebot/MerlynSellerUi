/** Datos del anuncio de Facebook o Instagram del que vino un mensaje («Click to WhatsApp»). */
export type AdReferral = {
  sourceUrl?: string; sourceId?: string; sourceType?: string; headline?: string; body?: string;
  mediaType?: string; imageUrl?: string; videoUrl?: string; thumbnailUrl?: string; ctwaClid?: string;
};

export function adPlatform(referral: AdReferral): string {
  const url = (referral.sourceUrl || "").toLowerCase();
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("facebook.com") || url.includes("fb.me") || url.includes("fb.com")) return "Facebook";
  return "";
}

/** Lo que se muestra en el chat; null si el mensaje no trae datos útiles del anuncio. */
export function adReferralView(referral: AdReferral | null | undefined) {
  if (!referral) return null;
  const image = referral.thumbnailUrl || referral.imageUrl || "";
  const platform = adPlatform(referral);
  const kind = referral.sourceType === "post" ? "publicación" : "anuncio";
  const view = {
    title: `Mensaje desde ${kind === "anuncio" ? "un anuncio" : "una publicación"}${platform ? ` de ${platform}` : ""}`,
    headline: referral.headline?.trim() || "",
    body: referral.body?.trim() || "",
    image,
    isVideo: referral.mediaType === "video" || Boolean(referral.videoUrl),
    link: referral.sourceUrl || "",
    adId: referral.sourceId || "",
  };
  return view.headline || view.body || view.image || view.link || view.adId ? view : null;
}
