export type BusinessKind='CAPITAL_INJECTION'|'CAPITAL_WITHDRAWAL'|'PROFIT_WITHDRAWAL'|'EXPENSE'|'TAX_PAYMENT';
export const businessKinds:Record<BusinessKind,string>={CAPITAL_INJECTION:'Inyección de capital',CAPITAL_WITHDRAWAL:'Retiro de capital',PROFIT_WITHDRAWAL:'Retiro de ganancias',EXPENSE:'Gasto del negocio',TAX_PAYMENT:'Impuesto pagado'};
export type BusinessAccount={openingDate:string;cash:string;inventory:string;reserve:string;revision:number};
export type BusinessSummary={month:string;account:BusinessAccount|null;beforeOpening:boolean;totals:Record<string,string|null>|null;period:Record<string,string|null>|null;missingSaleCosts:number;missingPurchases:number};
export type BusinessMovement={id:string;source:'SALE'|'PURCHASE'|'ADS'|'MANUAL';kind:string;date:string;amount:string|null;reason:string;voided:boolean;revision:number};
export type BusinessPage={items:BusinessMovement[];total:number;page:number;size:number};
export const businessOutflow=(kind:string)=>kind!=='SALE'&&kind!=='CAPITAL_INJECTION';
export const businessLabel=(kind:string)=>kind==='SALE'?'Venta registrada':kind==='PURCHASE'?'Adquisición de mercancía':kind==='ADS'?'Anuncios':businessKinds[kind as BusinessKind]||'Movimiento';
export function businessPath(resource:'summary'|'movements',month:string,page=0){return `/business-money/${resource}?${new URLSearchParams({month,...(resource==='movements'?{page:String(page),size:'20'}:{})})}`;}
