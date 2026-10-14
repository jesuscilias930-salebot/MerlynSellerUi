import test from 'node:test';
import assert from 'node:assert/strict';
import {whatsappDestination} from '../app/lib/whatsapp-button.ts';
test('accepts international phone formatting and preserves country code',()=>{
  assert.equal(whatsappDestination('+52 (272) 128-5563'),'522721285563');
  assert.equal(whatsappDestination('14155552671'),'14155552671');
  assert.equal(whatsappDestination('',false),'');
});
test('does not allow invalid destinations or an enabled button without a phone',()=>{
  for(const input of ['', '123','0123456789','1'.repeat(16),'https://wa.me/522721285563','52abc2721285563','52\n2721285563'])assert.throws(()=>whatsappDestination(input));
});
