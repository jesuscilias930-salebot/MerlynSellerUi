import test from 'node:test';
import assert from 'node:assert/strict';
import { chatShippingQuoteKey, clearShippingQuote, QUOTE_TTL_MS, readShippingQuote, writeShippingQuote } from '../app/lib/chat-shipping-quote.ts';
import { bestPriceMessage, carrierName, quoteAge } from '../app/lib/quote.ts';

const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; };
const rates = [
  { carrier: 'fedex', service: 'express', totalPrice: '245.50', currency: 'MXN' },
  { carrier: 'estafeta', service: 'ground', totalPrice: 180, currency: 'MXN' },
  { carrier: 'dhl', service: 'x', totalPrice: null },
];
const quote = (savedAt) => ({ version: 1, conversationId: 'c1', savedAt, rates, quoted: { body: { destination: { postalCode: '94300' } }, environment: 'production' }, productName: 'Caja 120', place: 'Orizaba, CP 94300' });

test('la cotización se guarda por chat y vence a las 12 h', () => {
  const storage = memory(); const now = Date.UTC(2026, 10, 23, 12);
  assert.ok(writeShippingQuote(quote(now), storage));
  assert.ok(storage.map.has(chatShippingQuoteKey('c1')));
  const read = readShippingQuote('c1', storage, now + 60_000);
  assert.equal(read.rates.length, 3); assert.equal(read.productName, 'Caja 120');
  assert.equal(readShippingQuote('otro', storage, now), null);
  assert.equal(readShippingQuote('c1', storage, now + QUOTE_TTL_MS + 1), null);
  storage.setItem(chatShippingQuoteKey('c1'), '{malo');
  assert.equal(readShippingQuote('c1', storage, now), null);
  writeShippingQuote(quote(now), storage); clearShippingQuote('c1', storage);
  assert.equal(readShippingQuote('c1', storage, now), null);
});

test('mensaje con la paquetería más económica', () => {
  assert.equal(bestPriceMessage(rates), 'El envío con mejor precio es con Estafeta en $180.00. ¿Le gustaría que seleccionemos esta paquetería para enviar su pedido?');
  assert.equal(bestPriceMessage([{ carrier: 'dhl', service: 'x' }]), null);
  assert.equal(carrierName('fedex'), 'FedEx'); assert.equal(carrierName('dhl'), 'DHL'); assert.equal(carrierName('nuevapaq'), 'Nuevapaq');
  assert.equal(quoteAge(0, 30 * 60000), 'hace 30 min'); assert.equal(quoteAge(0, 125 * 60000), 'hace 2 h 5 min');
});
