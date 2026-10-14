"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {controlRequest} from '../lib/control-api';
import {financeToday,financeMoney,financeMonth,financeDate,financeAmount,shiftFinanceMonth,movementDefaultDate} from '../lib/finances';
import {businessKinds,businessLabel,businessOutflow,businessPath,type BusinessAccount,type BusinessKind,type BusinessSummary,type BusinessMovement,type BusinessPage} from '../lib/business-money';
import styles from './FinancesPanel.module.css';
const message=(e:unknown)=>e instanceof Error?e.message:'No se pudo consultar el dinero del negocio.';
const money=(v:string|null|undefined)=>v==null?'Pendiente':financeMoney(v);
function useBusiness<T>(path:string,version:number){
 const key=`${path}:${version}`;const [result,setResult]=useState<{key:string;data?:T;error?:string}>();
 useEffect(()=>{const c=new AbortController();void controlRequest<T>(path,{signal:c.signal}).then(data=>{if(!c.signal.aborted)setResult({key,data});}).catch(e=>{if(!c.signal.aborted)setResult({key,error:message(e)});});return()=>c.abort();},[key,path]);
 return result?.key===key?result:undefined;
}
type Editor={type:'opening'}|{type:'movement'}|{type:'void';movement:BusinessMovement};
export function BusinessMoneyPanel(){
 const [today,setToday]=useState(financeToday),[month,setMonth]=useState(()=>financeToday().slice(0,7));
 const previousMonth=useRef(today.slice(0,7));
 const [version,setVersion]=useState(0),[editor,setEditor]=useState<Editor|null>(null),[notice,setNotice]=useState('');
 const result=useBusiness<BusinessSummary>(businessPath('summary',month),version),data=result?.data,a=data?.account,t=data?.totals;
 useEffect(()=>{function tick(){const d=financeToday();setToday(d);if(d.slice(0,7)!==previousMonth.current){const old=previousMonth.current;setMonth(m=>m===old?d.slice(0,7):m);previousMonth.current=d.slice(0,7);}}const timer=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 function refresh(){setVersion(v=>v+1);}
 return <section className={styles.panel} aria-label="Dinero del negocio">
  <header className={styles.heading}><div><small>NEGOCIO · CONTROL DE VENTAS · MXN</small><h1>Dinero del negocio</h1><p>Ventas y adquisiciones se consultan automáticamente. Este dinero no se mezcla con tus finanzas personales.</p></div></header>
  <div className={styles.toolbar}><div className={styles.month}><button type="button" aria-label="Mes anterior del negocio" disabled={month==='1900-01'} onClick={()=>setMonth(shiftFinanceMonth(month,-1))}>‹</button><label>Mes del negocio<input type="month" min="1900-01" max={today.slice(0,7)} value={month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&e.target.value<=today.slice(0,7)&&e.target.value>='1900-01')setMonth(e.target.value);}}/></label><button type="button" aria-label="Mes siguiente del negocio" disabled={month>=today.slice(0,7)} onClick={()=>setMonth(shiftFinanceMonth(month,1))}>›</button><button type="button" onClick={()=>setMonth(today.slice(0,7))}>Mes actual</button></div><div className={styles.actions}><button type="button" onClick={refresh}>Actualizar</button><button type="button" className={styles.primary} disabled={!a||data?.beforeOpening} onClick={()=>setEditor({type:'movement'})}>＋ Registrar movimiento</button></div></div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {!result&&<p role="status">Consultando Control de ventas…</p>}
  {result?.error&&<div role="alert" className={styles.error}><div>{result.error}<p>Si tu sesión de Control de ventas expiró, vuelve a iniciar sesión en MerlynSeller para conectarla.</p></div><button type="button" onClick={refresh}>Reintentar</button></div>}
  {data&&!a&&<div className={styles.empty}><h2>Separa el dinero de tu negocio</h2><p>Elige una fecha de corte y registra el efectivo, el inventario a costo y la parte del efectivo que ya apartaste para reinversión. Las operaciones anteriores a esa fecha no se sumarán otra vez.</p><button type="button" className={styles.primary} onClick={()=>setEditor({type:'opening'})}>Configurar saldos del negocio</button></div>}
  {data?.beforeOpening&&a&&<p className={styles.notice}>El control del negocio empieza el {financeDate(a.openingDate)}. Consulta ese mes o uno posterior.</p>}
  {t&&a&&<>
   <p className={styles.hint}>Acumulado desde {financeDate(a.openingDate)} hasta {month===today.slice(0,7)?'hoy':`el cierre de ${financeMonth(month)}`}. Saldo inicial antes de las operaciones del día de corte.</p>
   {(data.missingSaleCosts>0||data.missingPurchases>0)&&<p role="alert" className={styles.error}>Hay {data.missingSaleCosts} partidas de venta sin costo histórico y {data.missingPurchases} partidas de adquisición sin importe válido. Los cálculos que dependen de esos datos quedan pendientes.</p>}
   <div className={styles.balances}><article className={styles.real}><span>Efectivo del negocio</span><strong>{money(t.cash)}</strong><p>Saldo inicial + ventas + aportaciones − compras − anuncios − gastos − retiros − impuestos pagados.</p></article><article><span>Disponible estimado para reinversión</span><strong>{money(t.reinvestmentCash)}</strong><p>Es parte del efectivo, no dinero adicional. Limitado al efectivo disponible después de la reserva estimada de ISR.</p></article></div>
   <div className={styles.metrics}>{[
    ['Capital estimado en inventario',t.inventoryCapital,'Inventario inicial + adquisiciones − costo histórico vendido.'],
    ['Ganancia neta estimada',t.estimatedProfit,'Ventas − costo vendido − anuncios − otros gastos − ISR estimado.'],
    ['Inyecciones de capital',t.injections,'Aportaciones nuevas desde el corte; no cuentan como ventas ni ganancias.'],
    ['Capital de partida + aportaciones netas',t.contributedCapital,'Efectivo e inventario iniciales + aportaciones − retiros de capital.'],
   ].map(([label,value,hint])=><div key={label}><span>{label}</span><b>{money(value)}</b><small>{hint}</small></div>)}</div>
   {Number(t.inventoryCapital)<0&&<p role="alert" className={styles.error}>El capital calculado en inventario es negativo. Revisa el inventario inicial y los costos registrados; no se ajustó a cero para ocultar la diferencia.</p>}
   <details className={styles.explanation}><summary>Ver desglose de ganancias y reinversión</summary><div className={styles.businessBreakdown}>{[
    ['Ventas acumuladas',t.revenue],['Costo recuperado en ventas',t.recoveredCost],['Adquisiciones posteriores al corte',t.purchases],['Fondo de reposición calculado',t.replacementBalance],['Compras no cubiertas por el fondo de reposición',t.unfundedReplacement],['Anuncios registrados',t.advertising],['Otros gastos del negocio',t.expenses],['ISR estimado reservado',t.estimatedTaxReserve],['Impuestos pagados registrados',t.taxPayments],['Ganancias retiradas',t.profitWithdrawals],['Ganancia estimada no retirada',t.retainedProfit],['Capital retirado',t.capitalWithdrawals],
   ].map(([label,value])=><div key={label}><span>{label}</span><b>{money(value)}</b></div>)}</div><p>Fondo de reposición = reserva inicial + costo recuperado en ventas − adquisiciones. Un faltante indica compras financiadas con otros recursos; no es una ganancia. Comprar mercancía no descuenta su costo de la ganancia otra vez: se reconoce al venderla.</p></details>
   <div className={styles.explanation}><h3>Actividad de {financeMonth(month)}</h3><div className={styles.businessBreakdown}>{[['Ventas',data.period?.revenue],['Costo de unidades vendidas',data.period?.cost],['Anuncios',data.period?.advertising],['ISR estimado',data.period?.estimatedTax]].map(([label,value])=><div key={label}><span>{label}</span><b>{money(value)}</b></div>)}</div></div>
   <BusinessMovements key={month} month={month} version={version} onVoid={movement=>setEditor({type:'void',movement})}/>
   <div className={styles.explanation}><h3>Origen y alcance de las cifras</h3><p>Solo se leen las ventas confirmadas de Control de ventas (incluidos pedidos pagados ya incorporados), adquisiciones vigentes y anuncios registrados. No se crean ventas ni se descuenta inventario otra vez. Los importes de adquisiciones provienen de sus partidas calculadas.</p><p>Las adquisiciones registradas se tratan como salidas de efectivo completas en su fecha; este control no distingue compras a crédito. No incluye envío cobrado al cliente, comisiones, devoluciones aún no conciliadas, mermas ni ajustes físicos de inventario. Registra los gastos que falten sin duplicar los anuncios.</p><p>Conserva la regla operativa de ISR estimado del reporte de ventas: 1 % del ingreso de mercancía sin IVA. La estimación se reserva, pero solo un impuesto marcado como pagado reduce el efectivo. No calcula el IVA neto a pagar ni sustituye una conciliación bancaria o fiscal.</p><p>Los saldos iniciales ya incluyen el historial anterior al corte. Corregirlos recalcula los resultados; no cambia tus ventas ni tus finanzas personales.</p><button type="button" onClick={()=>setEditor({type:'opening'})}>Corregir saldos iniciales del negocio</button></div>
  </>}
  {editor&&<BusinessEditor editor={editor} account={a||undefined} month={month} today={today} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setNotice('Movimiento del negocio guardado. Tus finanzas personales no se modificaron.');refresh();}}/>}
 </section>;
}
function BusinessMovements({month,version,onVoid}:{month:string;version:number;onVoid:(m:BusinessMovement)=>void}){
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0),result=useBusiness<BusinessPage>(businessPath('movements',month,page),version+retry);
 return <section aria-label="Movimientos del negocio"><div className={styles.sectionHeading}><div><h2>Movimientos del negocio</h2><p>Ventas, adquisiciones y anuncios se actualizan desde su sección original. Solo puedes anular aquí los movimientos manuales.</p></div></div>
 {!result&&<p role="status">Cargando movimientos…</p>}{result?.error&&<p role="alert" className={styles.error}>{result.error}<button type="button" onClick={()=>setRetry(v=>v+1)}>Reintentar</button></p>}
 {result?.data?.total===0&&<p className={styles.empty}>No hay movimientos en este mes desde la fecha de corte.</p>}
 <div className={styles.movements}>{result?.data?.items.map(m=><article key={`${m.source}:${m.id}`} className={`${styles.movement} ${m.voided?styles.voided:''}`}><div><span className={styles.kind}>{m.voided?'Anulado · ':''}{m.source==='MANUAL'?'Registro manual':'Automático · Control de ventas'}</span><h3>{m.reason}</h3><p>{businessLabel(m.kind)} · {financeDate(m.date)}</p></div><div className={styles.movementActions}><strong className={!businessOutflow(m.kind)?styles.positive:''}>{m.amount==null?'Pendiente':`${businessOutflow(m.kind)?'−':'+'} ${money(m.amount)}`}</strong>{m.source==='MANUAL'&&!m.voided&&<button type="button" onClick={()=>onVoid(m)}>Anular</button>}</div></article>)}</div>
 {result?.data&&result.data.total>20&&<div className={styles.pagination}><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} de {Math.ceil(result.data.total/20)}</span><button type="button" disabled={(page+1)*20>=result.data.total} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>}
 </section>;
}
function BusinessEditor({editor,account,month,today,onClose,onSaved}:{editor:Editor;account?:BusinessAccount;month:string;today:string;onClose:()=>void;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [id]=useState(()=>crypto.randomUUID());
 const [initial]=useState(()=>({date:editor.type==='opening'?account?.openingDate||today:movementDefaultDate(month,today,account?.openingDate||today),cash:account?.cash||'',inventory:account?.inventory||'',reserve:account?.reserve||'',kind:'CAPITAL_INJECTION' as BusinessKind,amount:'',reason:'',notes:''}));
 const [draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
 function change(key:keyof typeof draft,value:string){setDraft(d=>({...d,[key]:value}));}
 function close(){if(!busy&&(JSON.stringify(draft)===JSON.stringify(initial)||window.confirm('¿Descartar los cambios sin guardar?')))onClose();}
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setError('');try{
  let path='/business-money/movements',method='POST',payload:unknown;
  if(editor.type==='opening'){path='/business-money/opening';method='PUT';payload={openingDate:draft.date,cash:financeAmount(draft.cash,true),inventory:financeAmount(draft.inventory,true),reserve:financeAmount(draft.reserve,true),revision:account?.revision||0};}
  else if(editor.type==='void'){path+=`/${editor.movement.id}/void`;payload={revision:editor.movement.revision,reason:draft.reason.trim()};}
  else payload={id,kind:draft.kind,date:draft.date,amount:financeAmount(draft.amount),reason:draft.reason.trim(),notes:draft.notes.trim()};
  setBusy(true);await controlRequest(path,{method,body:JSON.stringify(payload)});onSaved();
 }catch(e){setError(message(e));setBusy(false);}}
 const title=editor.type==='opening'?'Saldos iniciales del negocio':editor.type==='void'?'Anular movimiento del negocio':'Registrar movimiento del negocio';
 return <dialog ref={dialog} className={styles.editor} aria-labelledby={`business-editor-${id}`} onCancel={e=>{e.preventDefault();close();}}><form onSubmit={save}><header><h2 id={`business-editor-${id}`}>{title}</h2><button type="button" disabled={busy} aria-label="Cerrar formulario del negocio" onClick={close}>×</button></header><div className={styles.editorBody}><fieldset disabled={busy}>
 {editor.type==='opening'&&<><p className={styles.hint}>Captura tus saldos antes de las operaciones del día de corte. El inventario se valora a costo, no a precio de venta. La reserva de reinversión está dentro del efectivo: no se suma otra vez. Escribe 0 donde no tengas saldo.</p>{[['cash','Efectivo disponible del negocio (MXN)'],['inventory','Capital en inventario a costo (MXN)'],['reserve','Del efectivo, reservado para reinversión (MXN)']].map(([key,label])=><label key={key}>{label}<input type="text" inputMode="decimal" required maxLength={16} value={draft[key as 'cash'|'inventory'|'reserve']} onChange={e=>change(key as 'cash'|'inventory'|'reserve',e.target.value)} placeholder="Ej. 1500.50"/></label>)}</>}
 {editor.type==='movement'&&<><p className={styles.hint}>No captures ventas, adquisiciones ni anuncios otra vez: ya se incorporan automáticamente. Una inyección de capital agrega dinero, pero no aumenta la ganancia.</p><label>Tipo de movimiento<select value={draft.kind} onChange={e=>change('kind',e.target.value)}>{Object.entries(businessKinds).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>Importe del movimiento (MXN)<input type="text" inputMode="decimal" required maxLength={16} value={draft.amount} placeholder="Ej. 1500.50" onChange={e=>change('amount',e.target.value)}/></label></>}
 {editor.type!=='void'&&<label>{editor.type==='opening'?'Fecha de corte':'Fecha real del movimiento'}<input type="date" required min={editor.type==='opening'?'1900-01-01':account?.openingDate} max={today} value={draft.date} onChange={e=>change('date',e.target.value)}/></label>}
 {editor.type!=='opening'&&<label>{editor.type==='void'?'Motivo de anulación':'Motivo'}<input required maxLength={editor.type==='void'?500:200} value={draft.reason} onChange={e=>change('reason',e.target.value)}/></label>}
 {editor.type==='movement'&&<label>Notas (opcional)<textarea maxLength={2000} rows={3} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></label>}
 {editor.type==='void'&&<p className={styles.hint}>Se anulará el registro de {money(editor.movement.amount)} por “{editor.movement.reason}”. Su historial se conserva. No realiza transferencias ni devoluciones.</p>}
 </fieldset>{error&&<p role="alert" className={styles.error}>{error}</p>}</div><footer><button type="button" onClick={close} disabled={busy}>Cancelar</button><button className={styles.primary} disabled={busy} type="submit">{busy?'Guardando…':editor.type==='void'?'Confirmar anulación':'Guardar en el negocio'}</button></footer></form></dialog>;
}
