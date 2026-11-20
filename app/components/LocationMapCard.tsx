"use client";

import { useState } from "react";
import { mapsUrl, mapTiles, type SharedLocation } from "../lib/location";
import styles from "./LocationMapCard.module.css";

const WIDTH = 280, HEIGHT = 150;

/** Ubicación en el chat como en WhatsApp: mapa con pin, nombre y dirección; abre Google Maps. */
export function LocationMapCard({ location }: { location: SharedLocation }) {
  const [failed, setFailed] = useState(false);
  const tiles = mapTiles(location, WIDTH, HEIGHT);
  const title = location.name || "Ubicación";
  return <a className={styles.card} href={mapsUrl(location)} target="_blank" rel="noreferrer" aria-label={`${title}: abrir en Google Maps`}>
    <span className={styles.map} style={{ width: WIDTH, height: HEIGHT }}>
      {!failed && tiles.map(tile => (
        // eslint-disable-next-line @next/next/no-img-element -- mosaicos externos de OpenStreetMap
        <img key={tile.key} src={tile.url} alt="" width={256} height={256} loading="lazy" draggable={false} style={{ left: tile.left, top: tile.top }} onError={() => setFailed(true)} />
      ))}
      {failed && <span className={styles.fallback}>Mapa no disponible</span>}
      <span className={styles.pin} aria-hidden="true">📍</span>
      <small className={styles.attribution}>© OpenStreetMap</small>
    </span>
    <span className={styles.text}>
      <b>{title}</b>
      <small>{location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}</small>
      <small className={styles.open}>Abrir en Google Maps ↗</small>
    </span>
  </a>;
}
