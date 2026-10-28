import test from 'node:test';
import assert from 'node:assert/strict';
import { contactDetail, contactName, contactPhone } from '../app/lib/channels.ts';

test('muestra nombre y canal sin exponer el identificador interno', () => {
  assert.equal(contactName({ phone_number: '5212721234567' }), '5212721234567');
  assert.equal(contactDetail({ phone_number: '5212721234567' }), '5212721234567');
  assert.equal(contactName({ phone_number: 'fb:123', channel: 'messenger' }), 'Contacto de Messenger');
  assert.equal(contactDetail({ phone_number: 'fb:123', channel: 'messenger', name: 'Ana' }), 'Messenger');
  assert.equal(contactName({ phone_number: 'ig:9', channel: 'instagram', username: 'calcetines' }), '@calcetines');
  assert.equal(contactDetail({ phone_number: 'ig:9', channel: 'instagram', username: 'calcetines', name: 'Ana' }), 'Instagram · @calcetines');
  assert.equal(contactPhone({ phone_number: 'fb:123', channel: 'messenger' }), '');
  assert.equal(contactPhone({ phone_number: '52272' }), '52272');
});
