export type SharedLocation = { latitude: number; longitude: number; name?: string | null; address?: string | null };
export type BusinessLocation = SharedLocation & { updatedAt?: string };

const valid = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
const pair = (lat: string, lng: string) => { const latitude = Number(lat), longitude = Number(lng); return valid(latitude, longitude) ? { latitude, longitude } : null; };
const NUMBER = "(-?\\d{1,3}(?:\\.\\d+)?)";

/** Coordenadas de un enlace largo de Google Maps o de un texto «18.85, -97.10».
 *  Los enlaces cortos (maps.app.goo.gl) no traen coordenadas: hay que abrirlos y copiar el enlace largo. */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const value = decodeURIComponent(text.trim()).replace(/\s+/g, " ");
  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),                       // lugar exacto dentro de /place/
    new RegExp(`[?&](?:q|query|ll|center|destination)=${NUMBER},\\s?${NUMBER}`),
    new RegExp(`@${NUMBER},${NUMBER}`),                           // centro del mapa
    new RegExp(`^${NUMBER}\\s*,\\s*${NUMBER}$`),                  // «lat, lng» pegado tal cual
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const found = match && pair(match[1], match[2]);
    if (found) return found;
  }
  return null;
}

export const isShortMapsLink = (text: string) => /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(text.trim());
export const mapsUrl = ({ latitude, longitude }: SharedLocation) => `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
export const accuracyLabel = (meters: number) => meters < 1000 ? `±${Math.round(meters)} m` : `±${(meters / 1000).toFixed(1)} km`;

/** Mensaje claro para los errores del GPS del navegador. */
export function geolocationError(code: number | undefined): string {
  if (code === 1) return "El navegador no tiene permiso para usar tu ubicación. Actívalo en el candado de la barra de direcciones y vuelve a intentar.";
  if (code === 3) return "Tu ubicación tardó demasiado. Intenta de nuevo, de preferencia con el GPS o Wi-Fi activado.";
  return "No se pudo obtener tu ubicación en este dispositivo.";
}

export type MapTile = { key: string; url: string; left: number; top: number };
const TILE = 256;

/** Mosaicos de OpenStreetMap que cubren un recuadro centrado en el punto (vista previa como la de WhatsApp). */
export function mapTiles({ latitude, longitude }: SharedLocation, width: number, height: number, zoom = 16): MapTile[] {
  const scale = TILE * 2 ** zoom;
  const lat = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
  const centerX = (longitude + 180) / 360 * scale;
  const centerY = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * scale;
  const left = centerX - width / 2, top = centerY - height / 2;
  const count = 2 ** zoom, tiles: MapTile[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height - 1) / TILE); ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width - 1) / TILE); tx++) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`, left: Math.round(tx * TILE - left), top: Math.round(ty * TILE - top) });
    }
  }
  return tiles;
}
