import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalMessage, outgoingFromComposer, withOutgoing } from '../app/lib/outgoing.ts';

let n = 0; const makeId = () => `id${++n}`; const now = new Date('2026-11-20T10:00:00Z');
const file = name => ({ name });

test('cada foto es una burbuja y el texto va como pie de la primera', () => {
  const items = outgoingFromComposer({ chatId: 'c1', text: '  Mira estos  ', images: [{ file: file('a.jpg'), previewUrl: 'blob:a' }, { file: file('b.jpg'), previewUrl: 'blob:b' }], now, makeId });
  assert.equal(items.length, 2);
  assert.equal(items[0].body, 'Mira estos'); assert.equal(items[1].body, undefined);
  assert.ok(items.every(item => item.kind === 'image' && item.status === 'sending'));
  assert.deepEqual(outgoingFromComposer({ chatId: 'c1', text: '   ', images: [], now, makeId }), []);
  assert.equal(outgoingFromComposer({ chatId: 'c1', text: 'Hola', images: [], replyToMessageId: 'm9', now, makeId })[0].replyToMessageId, 'm9');
});

test('las burbujas en envío solo aparecen en su chat, al final y con su estado', () => {
  const items = [
    { id: 'x', chatId: 'c1', kind: 'image', createdAt: now.toISOString(), status: 'sending', previewUrl: 'blob:x' },
    { id: 'y', chatId: 'c2', kind: 'text', createdAt: now.toISOString(), status: 'failed', body: 'hola', error: 'Sin conexión' },
  ];
  const server = [{ id: 'm1', direction: 'inbound', type: 'text', body: 'hi', media_id: null, status: 'received', created_at: now.toISOString() }];
  const merged = withOutgoing(server, items, 'c1');
  assert.equal(merged.length, 2); assert.equal(merged[1].localPreviewUrl, 'blob:x'); assert.equal(merged[1].status, 'pending');
  assert.ok(isLocalMessage(merged[1])); assert.ok(!isLocalMessage(merged[0]));
  assert.equal(withOutgoing(server, items, 'c2')[1].error_code, 'Sin conexión');
  assert.equal(withOutgoing(server, [], 'c1'), server);
});
