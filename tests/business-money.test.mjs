import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {businessOutflow,businessLabel,businessPath,businessKinds} from '../app/lib/business-money.ts';
test('business movements distinguish capital from sales and gains',()=>{
 assert.equal(businessOutflow('CAPITAL_INJECTION'),false);assert.equal(businessOutflow('SALE'),false);
 for(const k of ['PURCHASE','ADS','EXPENSE','PROFIT_WITHDRAWAL','CAPITAL_WITHDRAWAL','TAX_PAYMENT'])assert.equal(businessOutflow(k),true);
 assert.equal(businessLabel('CAPITAL_INJECTION'),'Inyección de capital');assert.equal(businessLabel('PURCHASE'),'Adquisición de mercancía');
 assert.equal('SALE' in businessKinds,false);assert.equal('PURCHASE' in businessKinds,false);
});
test('business queries use an independent Control API namespace and bounded pages',()=>{
 assert.equal(businessPath('summary','2026-10'),'/business-money/summary?month=2026-10');
 assert.equal(new URL(businessPath('movements','2026-10',2),'http://local').searchParams.get('size'),'20');
 const ui=readFileSync(new URL('../app/components/BusinessMoneyPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/controlRequest/);assert.doesNotMatch(ui,/from '\.\.\/lib\/api'|\/finances\/|localStorage\.setItem|sessionStorage/);
 assert.match(ui,/m.source==='MANUAL'&&!m.voided/);assert.match(ui,/v==null\?'Pendiente'/);
 assert.match(ui,/crypto.randomUUID\(\)/);assert.match(ui,/signal:c.signal/);
});
test('business tab mounts only on demand, independently of a configured personal account',()=>{
 const ui=readFileSync(new URL('../app/components/FinancesPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/Dinero del negocio/);assert.match(ui,/workspace==='business'\?<BusinessMoneyPanel\/>:<PersonalFinancesPanel\/>/);
 assert.match(ui,/role="tablist" aria-label="Separación de finanzas"/);
});
