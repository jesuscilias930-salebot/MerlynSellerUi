"use client";

import { useEffect, useRef, useState } from "react";

type Props = { disabled?: boolean; onSend: (audio: Blob, filename: string) => Promise<void> };

const preferredMimeType = () => ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"]
  .find((type) => MediaRecorder.isTypeSupported(type));

export function AudioRecorder({ disabled, onSend }: Props) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const stopTracks = () => stream.current?.getTracks().forEach((track) => track.stop());
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreview(null);
    setPreviewUrl("");
    setSeconds(0);
  };

  useEffect(() => () => { stopTracks(); stopTimer(); if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  const start = async () => {
    setError("");
    clearPreview();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const mediaRecorder = mimeType ? new MediaRecorder(stream.current, { mimeType }) : new MediaRecorder(stream.current);
      const chunks: BlobPart[] = [];
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      mediaRecorder.onstop = () => {
        stopTracks();
        stopTimer();
        const audio = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        if (audio.size === 0) return setError("No se pudo obtener audio del micrófono.");
        setPreview(audio);
        setPreviewUrl(URL.createObjectURL(audio));
        setRecording(false);
      };
      mediaRecorder.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((value) => {
        if (value >= 119) { stop(); return 120; }
        return value + 1;
      }), 1000);
    } catch {
      setError("No fue posible acceder al micrófono. Revisa el permiso del navegador.");
      stopTracks();
    }
  };

  const send = async () => {
    if (!preview) return;
    setSending(true);
    setError("");
    try {
      const extension = preview.type.includes("ogg") ? "ogg" : preview.type.includes("mp4") ? "m4a" : "webm";
      await onSend(preview, `grabacion-${Date.now()}.${extension}`);
      clearPreview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible enviar el audio.");
    } finally {
      setSending(false);
    }
  };

  if (preview) return <div className="audio-recorder preview"><audio controls src={previewUrl}>Tu navegador no puede reproducir esta grabación.</audio><button type="button" onClick={clearPreview} disabled={sending}>Cancelar</button><button type="button" className="send-recording" onClick={send} disabled={sending}>{sending ? "Enviando…" : "Enviar audio"}</button>{error && <small>{error}</small>}</div>;
  return <div className="audio-recorder"><button type="button" className={recording ? "recording" : ""} onClick={recording ? stop : start} disabled={disabled || sending}>{recording ? "■ Detener" : "● Grabar audio"}</button>{recording && <span>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>}{error && <small>{error}</small>}</div>;
}
