"use client";

import { useState } from "react";
import { adReferralView, type AdReferral } from "../lib/ad-referral";

/** Tarjeta del anuncio dentro del mensaje, como en WhatsApp Web. */
export function AdReferralCard({ referral }: { referral?: AdReferral | null }) {
  const view = adReferralView(referral);
  const [imageFailed, setImageFailed] = useState(false);
  if (!view) return null;
  const content = <>
    {view.image && !imageFailed && <span className="ad-referral-media">
      {/* Las imágenes de Meta caducan; si no carga, la tarjeta sigue mostrando el texto. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={view.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      {view.isVideo && <i aria-hidden="true">▶</i>}
    </span>}
    <span className="ad-referral-copy">
      <small>📣 {view.title}</small>
      {view.headline && <b>{view.headline}</b>}
      {view.body && <span className="ad-referral-body">{view.body}</span>}
      {view.link ? <em>Ver anuncio ↗</em> : view.adId ? <em>ID del anuncio: {view.adId}</em> : null}
    </span>
  </>;
  return view.link
    ? <a className="ad-referral" href={view.link} target="_blank" rel="noopener noreferrer" title={view.adId ? `ID del anuncio: ${view.adId}` : undefined}>{content}</a>
    : <div className="ad-referral">{content}</div>;
}
