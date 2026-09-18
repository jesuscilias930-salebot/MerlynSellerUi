"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { controlRequest } from "../lib/control-api";
import styles from "./ProductWeightEditor.module.css";

type Props = {
  productId: number;
  productName: string;
  weightGrams?: number | string | null;
  onSaved: (weight: number) => void;
};

export function ProductWeightEditor({ productId, productName, weightGrams, onSaved }: Props) {
  const [draft, setDraft] = useState(weightGrams == null ? "" : String(weightGrams));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  useEffect(() => { setDraft(weightGrams == null ? "" : String(weightGrams)); }, [weightGrams]);
  const configured = weightGrams != null && Number(weightGrams) > 0;
  const changed = draft.trim() !== "" && (!configured || Number(draft) !== Number(weightGrams));
  const fieldId = `product-weight-${productId}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const weight = Number(draft);
    setError(""); setNotice("");
    if (!draft.trim() || !Number.isFinite(weight) || weight <= 0 || weight > 100000 || Math.abs(weight * 1000 - Math.round(weight * 1000)) > 0.00001) {
      setError("Ingresa un peso mayor a 0 y máximo 100,000 g, con hasta 3 decimales.");
      return;
    }
    pending.current = true; setSaving(true);
    try {
      const result = await controlRequest<{ productId: number; weightGrams: number | string }>(`/store-shipping/products/${productId}/weight`, {
        method: "PUT", body: JSON.stringify({ weightGrams: weight }),
      });
      const saved = Number(result?.weightGrams);
      if (result?.productId !== productId || !Number.isFinite(saved) || saved <= 0 || saved > 100000) throw new Error("No se pudo confirmar el peso guardado. Actualiza la lista de productos para verificar.");
      setDraft(String(saved)); onSaved(saved); setNotice("Peso guardado para cotizar envíos.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el peso.");
    } finally { pending.current = false; setSaving(false); }
  }

  return <form className={styles.editor} onSubmit={event => void save(event)} aria-label={`Peso de envío de ${productName}`} aria-busy={saving}>
    <label htmlFor={fieldId}>Peso por par <small>(gramos)</small></label>
    <div className={styles.controls}>
      <input id={fieldId} type="number" inputMode="decimal" min="0.001" max="100000" step="0.001" required
        value={draft} placeholder="Sin configurar" disabled={saving} aria-invalid={!!error}
        aria-describedby={`${fieldId}-hint${error ? ` ${fieldId}-error` : ""}`}
        onChange={event => { setDraft(event.target.value); setError(""); setNotice(""); }} />
      <button type="submit" disabled={saving || !changed}>{saving ? "Guardando…" : "Guardar peso"}</button>
    </div>
    <p id={`${fieldId}-hint`} className={styles.hint}>Pesa un par completo, sin caja. El empaque se suma por separado.</p>
    {!configured && !notice && <p className={styles.warning}>Sin peso configurado: este producto no puede cotizar su envío.</p>}
    {error && <p id={`${fieldId}-error`} className={styles.error} role="alert">{error}</p>}
    <p className={styles.success} role="status">{notice}</p>
  </form>;
}
