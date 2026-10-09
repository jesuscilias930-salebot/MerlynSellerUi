"use client";

import {useEffect,useRef,useState} from "react";
import {EnviaShippingPanel} from "./EnviaShippingPanel";
import type {Chat} from "../lib/types";

export function ChatShippingModal({chat,onClose}:{chat:Chat;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false);
  const [shippingChat]=useState(chat);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const element=dialog.current;
    element?.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <dialog ref={dialog} className="chat-shipping-modal" aria-labelledby="chat-shipping-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="chat-shipping-heading"><div><p>ENVÍO DEL CHAT</p><h2 id="chat-shipping-title">Capturar datos de envío</h2><span>{chat.name||chat.phone_number} · {chat.phone_number}</span></div><button type="button" aria-label="Cerrar captura de envío" disabled={busy} onClick={onClose}>×</button></header>
    <EnviaShippingPanel chat={shippingChat} onBusyChange={setBusy}/>
  </dialog>;
}
