"use client";

import { useEffect, useState } from "react";
import { request } from "../lib/api";
import type { ChatAdForChat } from "../lib/chat-ads";

/** chatAd del chat, calculado en el backend con el primer mensaje del cliente. */
export function useChatAd(chatId?: string) {
  const [state, setState] = useState<{ chatId?: string; chatAd: ChatAdForChat | null }>({ chatAd: null });
  useEffect(() => {
    if (!chatId) return;
    let active = true;
    request<{ chatAd: ChatAdForChat | null }>(`/chat-ads/conversations/${chatId}`)
      .then(({ chatAd }) => { if (active) setState({ chatId, chatAd }); })
      .catch(() => { if (active) setState({ chatId, chatAd: null }); });
    return () => { active = false; };
  }, [chatId]);
  // Mientras carga el chat nuevo no se muestran los botones del anterior.
  return state.chatId === chatId ? state.chatAd : null;
}

/** Botones del chatAd junto a los botones rápidos: un clic envía las fotos elegidas con su texto. */
export function ChatAdButtons({ chatAd, onSend, onNotice }: { chatAd: ChatAdForChat | null; onSend: (selection: { imageIds: string[]; caption?: string }) => Promise<void>; onNotice: (text: string) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  if (!chatAd) return null;
  const send = async (index: number) => {
    const button = chatAd.buttons[index];
    if (busy !== null || !button) return;
    setBusy(index);
    try {
      await onSend({ imageIds: button.imageIds, ...(button.text ? { caption: button.text } : {}) });
      setDone(index); onNotice(`Se envió «${button.label}».`);
      window.setTimeout(() => setDone(current => current === index ? null : current), 2500);
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : "No se pudo enviar."); }
    finally { setBusy(null); }
  };
  return <>{chatAd.buttons.map((button, index) =>
    <button key={`chat-ad-${index}`} type="button" className="quick-button chat-ad" disabled={busy !== null} title={`chatAd «${chatAd.name}» · ${button.imageIds.length} foto${button.imageIds.length === 1 ? "" : "s"}${button.text ? ` · ${button.text}` : ""}`} onClick={() => void send(index)}>
      📣 {busy === index ? "Enviando…" : done === index ? "✓ Enviado" : button.label}
    </button>)}</>;
}
