import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracyLabel, geolocationError, isShortMapsLink, parseCoordinates } from '../app/lib/location.ts';

test('lee coordenadas de enlaces de Google Maps y de texto', () => {
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/place/Bodega/@18.8501,-97.1003,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d18.8512345!4d-97.1012345'), { latitude: 18.8512345, longitude: -97.1012345 });
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/@18.85,-97.1,15z'), { latitude: 18.85, longitude: -97.1 });
  assert.deepEqual(parseCoordinates('https://maps.google.com/?q=18.85,-97.1'), { latitude: 18.85, longitude: -97.1 });
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/search/?api=1&query=18.85%2C-97.1'), { latitude: 18.85, longitude: -97.1 });
  assert.deepEqual(parseCoordinates(' 18.85 , -97.1 '), { latitude: 18.85, longitude: -97.1 });
  assert.equal(parseCoordinates('95, 10'), null);
  assert.equal(parseCoordinates('Sur 5 Orizaba'), null);
});

test('detecta enlaces cortos y explica errores del GPS', () => {
  assert.equal(isShortMapsLink('https://maps.app.goo.gl/AbC123'), true);
  assert.equal(isShortMapsLink('https://www.google.com/maps/@1,2'), false);
  assert.equal(accuracyLabel(24.6), '±25 m');
  assert.equal(accuracyLabel(2300), '±2.3 km');
  assert.match(geolocationError(1), /permiso/);
});

test('los mosaicos del mapa cubren el recuadro y dejan el punto al centro', async () => {
  const { mapTiles } = await import('../app/lib/location.ts');
  const tiles = mapTiles({ latitude: 18.873185, longitude: -97.104741 }, 280, 150, 16);
  assert.ok(tiles.length >= 2 && tiles.length <= 4);
  assert.ok(tiles.every(tile => /^https:\/\/tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/.test(tile.url)));
  // Cubre todo el recuadro: algún mosaico empieza en o antes de (0,0) y alguno termina después de (280,150).
  assert.ok(tiles.some(tile => tile.left <= 0 && tile.top <= 0));
  assert.ok(tiles.some(tile => tile.left + 256 >= 280 && tile.top + 256 >= 150));
  // Orizaba en zoom 16: x = (lng + 180) / 360 · 2^16 ≈ 15090 (comprobación de la proyección).
  const [x] = tiles[0].url.match(/16\/(\d+)\//).slice(1).map(Number);
  assert.ok(Math.abs(x - 15090) <= 1, String(x));
});
