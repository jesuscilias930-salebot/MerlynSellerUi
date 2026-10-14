export type FinanceKind='income'|'expense';
export type FinanceAccount={currency:'MXN';openingDate:string;openingBalance:string;revision:number};
export type FinanceMovement={id:string;kind:FinanceKind;date:string;amount:string;reason:string;notes:string;revision:number;fixedExpenseId:string|null;fixedMonth:string|null;voidedAt:string|null;voidReason:string};
export type FixedExpense={id:string;reason:string;notes:string;amount:string;dueDay:number;startMonth:string;endMonth:string|null;isActive:boolean;revision:number};
export type FixedOccurrence={id:string;reason:string;notes:string;amount:string;dueDate:string;revision:number;status:'pending'|'paid'|'paid_later';paymentId:string|null;paidOn:string|null};
export type FinanceSummary={month:string;account:FinanceAccount|null;totals:{openingBalance:string;income:string;expense:string;balance:string;pendingFixed:string;afterFixed:string}|null;fixed:FixedOccurrence[];count?:number;beforeOpening?:boolean};
export type FinancePage<T>={items:T[];total:number;page:number;size:number};
export const financeToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function financeMoney(value:string){
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(value))return '—';
 const negative=value.startsWith('-'),[whole,fraction='']=value.replace('-','').split('.'),integer=BigInt(whole);
 const sign=negative?(integer===BigInt(0)?-0:-integer):integer;
 return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).formatToParts(sign).map(part=>part.type==='fraction'?fraction.padEnd(2,'0'):part.value).join('');
}
export const financeMonth=(month:string)=>new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));
export const financeDate=(date:string)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
export function shiftFinanceMonth(month:string,delta:number){const [y,m]=month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;}
export function financeAmount(input:string,signed=false){
 const value=input.trim().replace(',','.');
 if(!(signed?/^-?\d{1,9}(?:\.\d{1,2})?$/:/^\d{1,9}(?:\.\d{1,2})?$/).test(value)||(!signed&&Number(value)<=0))throw new Error('Escribe el importe sin símbolos ni separadores de miles y con hasta dos decimales.');
 return value;
}
export function financeMovementPath(month:string,kind:string,status:string,q:string,page:number){return `/finances/movements?${new URLSearchParams({month,kind,status,q:q.trim().slice(0,120),page:String(page),size:'20'})}`;}
export function movementDefaultDate(month:string,today:string,openingDate:string){return month===today.slice(0,7)?today:[`${month}-01`,openingDate].sort().at(-1)!;}
