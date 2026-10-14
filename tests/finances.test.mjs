import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {financeAmount,financeMoney,financeDate,financeMonth,shiftFinanceMonth,movementDefaultDate,financeMovementPath} from '../app/lib/finances.ts';
test('financial inputs preserve decimal amounts without floating point calculations',()=>{
 assert.equal(financeAmount(' 1500,50 '),'1500.50');assert.equal(financeAmount('0',true),'0');assert.equal(financeAmount('-12.34',true),'-12.34');
 for(const value of ['','0','-5','1.001','1,000.00','1e4','Infinity','abc'])assert.throws(()=>financeAmount(value));
 assert.equal(financeMoney('1000000000000000.01'),'$1,000,000,000,000,000.01');assert.equal(financeMoney('-0.01'),'-$0.01');assert.equal(financeMoney('invalid'),'—');
});
test('month navigation and date labels do not shift across time zones or year boundaries',()=>{
 assert.equal(shiftFinanceMonth('2026-12',1),'2027-01');assert.equal(shiftFinanceMonth('2027-01',-1),'2026-12');
 assert.match(financeDate('2028-02-29'),/29/);assert.match(financeMonth('2026-10'),/octubre.*2026/);
 assert.equal(movementDefaultDate('2026-10','2026-10-14','2026-09-20'),'2026-10-14');
 assert.equal(movementDefaultDate('2026-09','2026-10-14','2026-09-20'),'2026-09-20');
});
test('movement filters are bounded backend parameters',()=>{
 const url=new URL(financeMovementPath('2026-10','expense','active','Renta & servicios',2),'http://local');
 assert.equal(url.searchParams.get('q'),'Renta & servicios');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('month'),'2026-10');
});
test('Finanzas is admin-only in both menus and data is loaded on demand',()=>{
 const sidebar=readFileSync(new URL('../app/components/Sidebar.tsx',import.meta.url),'utf8');
 assert.match(sidebar,/\["owner", "admin"\]\.includes\(user.role\) && link\("Finanzas"/);
 assert.match(sidebar,/\["owner", "admin"\]\.includes\(user.role\) && <button[^\n]*Finanzas/);
 const panel=readFileSync(new URL('../app/components/FinancesPanel.tsx',import.meta.url),'utf8');
 assert.match(panel,/tab==='movements'&&<MovementList/);assert.match(panel,/tab==='fixed'&&<FixedList/);
 assert.doesNotMatch(panel,/controlRequest|\/sales\?|localStorage|sessionStorage/);
 assert.match(panel,/crypto.randomUUID\(\)/);
});
