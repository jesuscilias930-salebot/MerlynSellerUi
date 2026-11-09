import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleShippingPackage } from '../app/lib/shipping-package.ts';
import { storedParcel, chatQuoteBundle, missingDestinationFields, quoteBundleRef, rateMessage, ratesByPrice } from '../app/lib/quote.ts';

test('el paquete del chat solo existe con id y nombre', () => {
  assert.deepEqual(chatQuoteBundle({ quoteBundleId: '7', quoteBundleName: 'Paquete 100' }), { id: '7', name: 'Paquete 100' });
  assert.equal(chatQuoteBundle({ quoteBundleId: null, quoteBundleName: null }), null);
  assert.equal(chatQuoteBundle(null), null);
  assert.deepEqual(quoteBundleRef({ id: 3, name: 'P50' }), { id: '3', name: 'P50' });
});

test('el bundle se convierte en el paquete editable del cotizador', () => {
  assert.deepEqual(storedParcel(bundleShippingPackage({ id: 1, name: 'Paquete 100', fixedPrice: 882, boxLengthCm: 40, boxWidthCm: 30, boxHeightCm: 25, boxWeightKg: 6.5 })),
    { type: 'box', content: 'Paquete 100', amount: '1', declaredValue: '882', weight: '6.5', length: '40', width: '30', height: '25' });
  assert.equal(storedParcel(bundleShippingPackage({ id: 2, name: 'Sin medidas' })), null);
});

test('avisa qué datos del cliente faltan para cotizar', () => {
  const address = { name: 'Ana', phone: '2721234567', street: 'Av. 3', city: 'Orizaba', state: 'VE', country: 'MX', postalCode: '94300' };
  assert.deepEqual(missingDestinationFields(address), []);
  assert.deepEqual(missingDestinationFields({ ...address, name: ' ', phone: '123', postalCode: '', city: '' }), ['nombre', 'teléfono', 'código postal', 'ciudad']);
});

test('ordena por precio y arma el mensaje para el cliente', () => {
  const rates = [{ carrier: 'fedex', service: 'express', totalPrice: 320 }, { carrier: 'dhl', service: 'x' }, { carrier: 'estafeta', service: 'ground', serviceDescription: 'Terrestre', totalPrice: '189.5', deliveryDays: 3 }];
  assert.deepEqual(ratesByPrice(rates).map(rate => rate.carrier), ['estafeta', 'fedex', 'dhl']);
  assert.equal(rateMessage(rates[2], { city: 'Orizaba', postalCode: '94300' }, 'Paquete 100'), 'Envío de Paquete 100 a Orizaba, CP 94300 por ESTAFETA (Terrestre): $189.50 · entrega en 3 días hábiles.');
  assert.equal(rateMessage(rates[1], { city: '', postalCode: '' }), 'Envío por DHL (x): Precio no disponible.');
});

test('mensaje con el número de guía para el cliente', async () => {
  const { trackingMessage } = await import('../app/lib/quote.ts');
  assert.equal(trackingMessage({ carrier: 'estafeta', service: 'ground', trackingNumber: '123456' }), 'Tu pedido va por ESTAFETA (ground). Número de guía: 123456.');
  assert.match(trackingMessage({ carrier: 'dhl', service: 'express', trackingNumber: null }), /ya está generada/);
});
