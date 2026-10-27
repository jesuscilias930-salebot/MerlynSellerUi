"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { filterOptions, type AutocompleteOption } from "../lib/autocomplete";
import styles from "./Autocomplete.module.css";

type Props = {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  emptyText?: string;
};

/** Campo con búsqueda: escribe para filtrar, ↑ ↓ para moverte y Enter para elegir. */
export function Autocomplete({ options, value, onChange, placeholder = "Escribe para buscar…", disabled, required, ariaLabel, emptyText = "Sin coincidencias" }: Props) {
  const id = useId();
  const selected = options.find(option => option.value === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterOptions(options, query), [options, query]);
  const choose = (option: AutocompleteOption) => {
    if (option.disabled) return;
    onChange(option.value); setQuery(""); setOpen(false);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(current => Math.min(current + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(current => Math.max(current - 1, 0)); }
    else if (event.key === "Enter" && open) { event.preventDefault(); if (results[active]) choose(results[active]); }
    else if (event.key === "Escape") { setOpen(false); setQuery(""); }
  };
  const shown = open ? query : selected?.label || "";
  return <div className={styles.box}>
    <input
      ref={input}
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-controls={`${id}-list`}
      aria-autocomplete="list"
      aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
      value={shown}
      placeholder={selected ? selected.label : placeholder}
      disabled={disabled}
      required={required && !value}
      autoComplete="off"
      onFocus={() => { setOpen(true); setActive(0); }}
      onBlur={() => { setOpen(false); setQuery(""); }}
      onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); if (value && !event.target.value) onChange(""); }}
      onKeyDown={keyDown}
    />
    {/* Flecha para abrir la lista completa, como un menú desplegable. */}
    <button type="button" className={styles.toggle} tabIndex={-1} aria-label={open ? "Cerrar lista" : "Ver todas las opciones"} disabled={disabled}
      onMouseDown={event => { event.preventDefault(); if (open) { setOpen(false); setQuery(""); } else { setOpen(true); setActive(0); input.current?.focus(); } }}>▾</button>
    {selected && !open && <small className={styles.detail}>{selected.detail}</small>}
    {open && <ul id={`${id}-list`} role="listbox" className={styles.list}>
      {results.length ? results.map((option, index) => <li
        key={option.value}
        id={`${id}-${index}`}
        role="option"
        aria-selected={option.value === value}
        aria-disabled={option.disabled || undefined}
        className={`${index === active ? styles.active : ""} ${option.disabled ? styles.disabled : ""}`}
        onMouseDown={event => { event.preventDefault(); choose(option); }}
        onMouseEnter={() => setActive(index)}
      ><b>{option.label}</b>{option.detail && <small>{option.detail}</small>}</li>) : <li className={styles.empty}>{emptyText}</li>}
    </ul>}
  </div>;
}
