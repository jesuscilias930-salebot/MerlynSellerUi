import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUTO_DISMISS_MS } from '../app/lib/use-auto-dismiss.ts';

test('los avisos se cierran a los 2 segundos en la app y en el chat', () => {
  assert.equal(AUTO_DISMISS_MS, 2000);
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const chat = readFileSync(new URL('../app/components/ConversationPanel.tsx', import.meta.url), 'utf8');
  assert.match(page, /useAutoDismiss\(notice/); assert.match(page, /className="toast" \{\.\.\.noticeHover\}/);
  assert.match(chat, /useAutoDismiss\(notice/); assert.match(chat, /inbox-chat-notice" role="status" \{\.\.\.noticeHover\}/);
});
