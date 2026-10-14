"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {request} from '../lib/api';
import {financeToday,financeMoney,financeMonth,financeDate,financeAmount,financeMovementPath,shiftFinanceMonth,movementDefaultDate,type FinanceAccount,type FinanceKind,type FinanceMovement,type FixedExpense,type FixedOccurrence,type FinancePage,type FinanceSummary} from '../lib/finances';
import {AppNavIcon} from './AppNavIcon';
import {BusinessMoneyPanel} from './BusinessMoneyPanel';
import styles from './FinancesPanel.module.css';
const message=(e:unknown)=>e instanceof Error?e.message:'No se pudo completar la solicitud.';
function useResource<T>(path:string,version:number){
 const key=`${path}:${version}`;
 const [result,setResult]=useState<{key:string;data?:T;error?:string}>();
 useEffect(()=>{const controller=new AbortController();void request<T>(path,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setResult({key,data});}).catch(e=>{if(!controller.signal.aborted)setResult({key,error:message(e)});});return()=>controller.abort();},[path,key]);
 return result?.key===key?result:undefined;
}
type Editor={type:'account'}|{type:'movement';kind:FinanceKind;movement?:FinanceMovement}|{type:'fixed';fixed?:FixedExpense}|{type:'pay';fixed:FixedOccurrence}|{type:'void';movement:FinanceMovement};
type Tab='summary'|'movements'|'fixed';
const tabs:{id:Tab;label:string}[]=[{id:'summary',label:'Resumen mensual'},{id:'movements',label:'Movimientos'},{id:'fixed',label:'Gastos fijos'}];

export function FinancesPanel(){
 const [workspace,setWorkspace]=useState<'personal'|'business'>('personal');
 return <div className={styles.workspace}><div className={styles.workspaceTabs} role="tablist" aria-label="Separación de finanzas">{([['personal','Mis finanzas'],['business','Dinero del negocio']] as const).map(([id,label])=><button key={id} type="button" role="tab" id={`money-tab-${id}`} aria-controls={`money-panel-${id}`} aria-selected={workspace===id} tabIndex={workspace===id?0:-1} onClick={()=>setWorkspace(id)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'personal':e.key==='End'?'business':workspace==='personal'?'business':'personal';setWorkspace(next);document.getElementById(`money-tab-${next}`)?.focus();}}}>{label}</button>)}</div><div className={styles.workspaceContent} role="tabpanel" id={`money-panel-${workspace}`} aria-labelledby={`money-tab-${workspace}`}>{workspace==='business'?<BusinessMoneyPanel/>:<PersonalFinancesPanel/>}</div></div>;
}
function PersonalFinancesPanel(){
 const [today,setToday]=useState(financeToday),[month,setMonth]=useState(()=>financeToday().slice(0,7)),[tab,setTab]=useState<Tab>('summary');
 const currentMonth=useRef(today.slice(0,7));
 const [version,setVersion]=useState(0),[editor,setEditor]=useState<Editor|null>(null),[notice,setNotice]=useState('');
 const result=useResource<FinanceSummary>(`/finances/summary?${new URLSearchParams({month})}`,version),data=result?.data,account=data?.account;
 useEffect(()=>{const tick=()=>{const d=financeToday(),previous=currentMonth.current;setToday(d);if(d.slice(0,7)!==previous){setMonth(selected=>selected===previous?d.slice(0,7):selected);currentMonth.current=d.slice(0,7);}};const timer=setInterval(tick,60000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
 function refresh(){setVersion(v=>v+1);}
 function saved(){setEditor(null);setNotice('Registro guardado. Los saldos se recalcularon con los movimientos de Finanzas.');refresh();}
 return <section className={styles.panel} aria-label="Finanzas">
  <header className={styles.heading}><div><small>CONTROL DE TU DINERO · MXN</small><h1>Finanzas</h1><p>Solo registros de este módulo. No importa Ventas ni sincroniza con bancos.</p></div><AppNavIcon name="finance"/></header>
  <div className={styles.toolbar}>
   <div className={styles.month}><button type="button" aria-label="Mes anterior" disabled={month==='1900-01'} onClick={()=>setMonth(shiftFinanceMonth(month,-1))}>‹</button><label>Mes a consultar<input type="month" min="1900-01" max={today.slice(0,7)} value={month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&e.target.value<=today.slice(0,7)&&e.target.value>='1900-01')setMonth(e.target.value);}}/></label><button type="button" aria-label="Mes siguiente" disabled={month>=today.slice(0,7)} onClick={()=>setMonth(shiftFinanceMonth(month,1))}>›</button><button type="button" onClick={()=>setMonth(today.slice(0,7))}>Mes actual</button></div>
   <div className={styles.actions}><button type="button" disabled={!account||data?.beforeOpening} onClick={()=>setEditor({type:'movement',kind:'income'})}>＋ Ingreso</button><button type="button" className={styles.primary} disabled={!account||data?.beforeOpening} onClick={()=>setEditor({type:'movement',kind:'expense'})}>− Egreso</button></div>
  </div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {!result&&<p role="status">Cargando finanzas…</p>}
  {result?.error&&<div role="alert" className={styles.error}><span>{result.error}</span><button type="button" onClick={refresh}>Reintentar</button></div>}
  {data&&!account&&<div className={styles.empty}><AppNavIcon name="finance"/><h2>Empieza con tu saldo inicial</h2><p>Indica cuánto dinero tienes y desde qué fecha comenzarás a registrar movimientos. No asumiremos que tu saldo es cero.</p><button type="button" className={styles.primary} onClick={()=>setEditor({type:'account'})}>Configurar saldo inicial</button></div>}
  {account&&data?.totals&&<>
   {data.beforeOpening?<p className={styles.notice}>El control comienza el {financeDate(account.openingDate)}. Elige ese mes o uno posterior.</p>:<>
    <div className={styles.balances}>
     <article className={styles.real}><span>Disponible real · {financeMonth(month)}</span><strong>{financeMoney(data.totals.balance)}</strong><p>{month===today.slice(0,7)?'Con los movimientos registrados hasta hoy.':'Saldo registrado al cierre del mes.'}</p></article>
     <article><span>Libre después de gastos fijos pendientes</span><strong className={Number(data.totals.afterFixed)<0?styles.negative:''}>{financeMoney(data.totals.afterFixed)}</strong><p>Es una previsión; los pendientes todavía no se descuentan del saldo real.</p></article>
    </div>
    <div className={styles.metrics}><div><span>Saldo de arranque</span><b>{financeMoney(data.totals.openingBalance)}</b></div><div><span>Ingresos del mes</span><b className={styles.positive}>＋ {financeMoney(data.totals.income)}</b></div><div><span>Egresos del mes</span><b>{financeMoney(data.totals.expense)}</b></div><div><span>Gastos fijos pendientes</span><b>{financeMoney(data.totals.pendingFixed)}</b></div></div>
   </>}
   <div className={styles.tabs} role="tablist" aria-label="Secciones de Finanzas">{tabs.map((item,index)=><button key={item.id} type="button" role="tab" id={`finance-tab-${item.id}`} aria-controls={`finance-panel-${item.id}`} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} onClick={()=>setTab(item.id)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowLeft'?2:1))%3;setTab(tabs[next].id);document.getElementById(`finance-tab-${tabs[next].id}`)?.focus();}}}>{item.label}</button>)}</div>
   <div role="tabpanel" id={`finance-panel-${tab}`} aria-labelledby={`finance-tab-${tab}`}>
    {tab==='summary'&&<>
     <div className={styles.sectionHeading}><div><h2>Compromisos de {financeMonth(month)}</h2><p>Marcar un gasto como pagado crea un solo egreso, en la fecha real de pago.</p></div><button type="button" onClick={refresh}>Actualizar</button></div>
     {!data.fixed.length&&<div className={styles.empty}><h3>No hay gastos fijos para este mes</h3><p>Registra renta, servicios u otros compromisos en Gastos fijos.</p><button type="button" onClick={()=>setTab('fixed')}>Configurar gastos fijos</button></div>}
     <div className={styles.cards}>{data.fixed.map(f=><article key={f.id} className={styles.card}><div className={styles.cardTop}><span className={f.status==='paid'?styles.paid:styles.pending}>{f.status==='paid'?'Pagado':f.status==='paid_later'?'Pagado después de este mes':f.dueDate<today?'Pendiente · fecha vencida':'Pendiente'}</span><strong>{financeMoney(f.amount)}</strong></div><h3>{f.reason}</h3><p>Vence el {financeDate(f.dueDate)}</p>{f.notes&&<p className={styles.notes}>{f.notes}</p>}{f.paidOn?<small>Pago registrado el {financeDate(f.paidOn)}{f.status==='paid_later'?'. Se descuenta en ese mes, no en este.':''}</small>:<button type="button" className={styles.primary} onClick={()=>setEditor({type:'pay',fixed:f})}>Registrar como pagado</button>}</article>)}</div>
     <div className={styles.explanation}><h3>Cómo se calcula</h3><p>Saldo de arranque + ingresos − egresos = disponible real. El dinero no se reinicia al cambiar de mes.</p><p>El saldo inicial fue {financeMoney(account.openingBalance)} el {financeDate(account.openingDate)}. Las cifras dependen de que registres todos tus movimientos; no son un saldo bancario ni un cálculo de utilidad o impuestos.</p><button type="button" onClick={()=>setEditor({type:'account'})}>Corregir saldo inicial</button></div>
    </>}
    {tab==='movements'&&<MovementList key={month} month={month} version={version} onEdit={movement=>setEditor({type:'movement',kind:movement.kind,movement})} onVoid={movement=>setEditor({type:'void',movement})}/>}
    {tab==='fixed'&&<FixedList version={version} onNew={()=>setEditor({type:'fixed'})} onEdit={fixed=>setEditor({type:'fixed',fixed})}/>}
   </div>
  </>}
  {editor&&<FinanceEditor editor={editor} account={account||undefined} month={month} today={today} onClose={()=>setEditor(null)} onSaved={saved}/>}
 </section>;
}

function Pages({page,total,size,onPage}:{page:number;total:number;size:number;onPage:(n:number)=>void}){return total>size?<div className={styles.pagination}><button type="button" disabled={!page} onClick={()=>onPage(page-1)}>Anterior</button><span>Página {page+1} de {Math.ceil(total/size)}</span><button type="button" disabled={(page+1)*size>=total} onClick={()=>onPage(page+1)}>Siguiente</button></div>:null;}
function MovementList({month,version,onEdit,onVoid}:{month:string;version:number;onEdit:(m:FinanceMovement)=>void;onVoid:(m:FinanceMovement)=>void}){
 const [kind,setKind]=useState('all'),[status,setStatus]=useState('active'),[query,setQuery]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>{setQ(query.trim());setPage(0);},300);return()=>clearTimeout(timer);},[query]);
 const result=useResource<FinancePage<FinanceMovement>>(financeMovementPath(month,kind,status,q,page),version+retry);
 return <><div className={styles.filters}><label>Buscar motivo<input type="search" value={query} maxLength={120} placeholder="Renta, mercancía, depósito…" onChange={e=>setQuery(e.target.value)}/></label><label>Tipo<select value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="all">Ingresos y egresos</option><option value="income">Ingresos</option><option value="expense">Egresos</option></select></label><label>Estado<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="active">Vigentes</option><option value="all">Todos</option><option value="voided">Anulados</option></select></label></div>
  {!result&&<p role="status">Cargando movimientos…</p>}{result?.error&&<p role="alert" className={styles.error}>{result.error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}
  {result?.data?.total===0&&<p className={styles.empty}>No hay movimientos con estos filtros. Usa Ingreso o Egreso para registrar uno.</p>}
  <div className={styles.movements}>{result?.data?.items.map(m=><article key={m.id} className={`${styles.movement} ${m.voidedAt?styles.voided:''}`}><div><span className={styles.kind}>{m.voidedAt?'Anulado':m.kind==='income'?'Ingreso':'Egreso'}{m.fixedExpenseId?' · Gasto fijo':''}</span><h3>{m.reason}</h3><p>{financeDate(m.date)}{m.fixedMonth?` · Corresponde a ${financeMonth(m.fixedMonth)}`:''}</p>{m.notes&&<p className={styles.notes}>{m.notes}</p>}{m.voidedAt&&<p>Motivo de anulación: {m.voidReason}</p>}</div><div className={styles.movementActions}><strong className={m.kind==='income'?styles.positive:''}>{m.kind==='income'?'+':'−'} {financeMoney(m.amount)}</strong>{!m.voidedAt&&<div>{!m.fixedExpenseId&&<button type="button" onClick={()=>onEdit(m)}>Editar</button>}<button type="button" onClick={()=>onVoid(m)}>Anular</button></div>}</div></article>)}</div>
  {result?.data&&<Pages page={page} total={result.data.total} size={result.data.size} onPage={setPage}/>}
 </>;
}
function FixedList({version,onNew,onEdit}:{version:number;onNew:()=>void;onEdit:(f:FixedExpense)=>void}){
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0),result=useResource<FinancePage<FixedExpense>>(`/finances/fixed-expenses?page=${page}&size=20`,version+retry);
 return <><div className={styles.sectionHeading}><div><h2>Tus gastos recurrentes</h2><p>Se muestran cada mes como pendientes. No generan cargos ni egresos automáticos.</p></div><button type="button" className={styles.primary} onClick={onNew}>＋ Gasto fijo</button></div><p className={styles.hint}>Al editar una regla cambian sus pendientes. Los pagos ya registrados conservan su motivo, importe y fecha originales.</p>
  {!result&&<p role="status">Cargando gastos fijos…</p>}{result?.error&&<p role="alert" className={styles.error}>{result.error}<button type="button" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}{result?.data?.total===0&&<p className={styles.empty}>Aún no registras gastos fijos mensuales.</p>}
  <div className={styles.cards}>{result?.data?.items.map(f=><article className={styles.card} key={f.id}><div className={styles.cardTop}><span className={f.isActive?styles.pending:styles.paid}>{f.isActive?'Repetición activa':'Desactivado'}</span><strong>{financeMoney(f.amount)}</strong></div><h3>{f.reason}</h3><p>Cada día {f.dueDay} · Desde {financeMonth(f.startMonth)}{f.endMonth?` hasta ${financeMonth(f.endMonth)}`:''}</p>{f.notes&&<p className={styles.notes}>{f.notes}</p>}<button type="button" onClick={()=>onEdit(f)}>Editar / desactivar</button></article>)}</div>{result?.data&&<Pages page={page} total={result.data.total} size={result.data.size} onPage={setPage}/>}</>;
}

function FinanceEditor({editor,account,month,today,onClose,onSaved}:{editor:Editor;account?:FinanceAccount;month:string;today:string;onClose:()=>void;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null);
 const [id]=useState(()=>crypto.randomUUID());
 const [initial]=useState(()=>({reason:editor.type==='movement'?editor.movement?.reason||'':editor.type==='fixed'?editor.fixed?.reason||'':'',amount:editor.type==='movement'?editor.movement?.amount||'':editor.type==='fixed'?editor.fixed?.amount||'':editor.type==='account'?account?.openingBalance||'':'',date:editor.type==='account'?account?.openingDate||today:editor.type==='movement'?editor.movement?.date||movementDefaultDate(month,today,account?.openingDate||today):today,kind:editor.type==='movement'?editor.kind:'expense',notes:editor.type==='movement'?editor.movement?.notes||'':editor.type==='fixed'?editor.fixed?.notes||'':'',dueDay:editor.type==='fixed'?String(editor.fixed?.dueDay||1):'1',startMonth:editor.type==='fixed'?editor.fixed?.startMonth||today.slice(0,7):today.slice(0,7),endMonth:editor.type==='fixed'?editor.fixed?.endMonth||'':'',isActive:editor.type==='fixed'?editor.fixed?.isActive??true:true}));
 const [draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const title=editor.type==='account'?'Saldo inicial':editor.type==='fixed'?(editor.fixed?'Editar gasto fijo':'Nuevo gasto fijo'):editor.type==='pay'?'Registrar pago de gasto fijo':editor.type==='void'?'Anular movimiento':editor.movement?'Editar movimiento':editor.kind==='income'?'Registrar ingreso':'Registrar egreso';
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
 function change<K extends keyof typeof draft>(key:K,value:typeof draft[K]){setDraft(old=>({...old,[key]:value}));}
 function close(){if(busy)return;if(JSON.stringify(draft)!==JSON.stringify(initial)&&!window.confirm('Tienes cambios sin guardar. ¿Cerrar y descartarlos?'))return;onClose();}
 async function save(event:FormEvent){
  event.preventDefault();if(busy||!form.current?.reportValidity())return;setError('');
  try {
   let path='',method='POST',payload:unknown;
   if(editor.type==='account'){path='/finances/account';method='PUT';payload={openingDate:draft.date,openingBalance:financeAmount(draft.amount,true),revision:account?.revision||0};}
   else if(editor.type==='pay'){path=`/finances/fixed-expenses/${editor.fixed.id}/pay`;payload={month,paidOn:draft.date,revision:editor.fixed.revision};}
   else if(editor.type==='void'){path=`/finances/movements/${editor.movement.id}/void`;payload={revision:editor.movement.revision,reason:draft.reason.trim()};}
   else if(editor.type==='fixed'){path=editor.fixed?`/finances/fixed-expenses/${editor.fixed.id}`:'/finances/fixed-expenses';method=editor.fixed?'PUT':'POST';payload={...(editor.fixed?{revision:editor.fixed.revision}:{id}),reason:draft.reason.trim(),notes:draft.notes.trim(),amount:financeAmount(draft.amount),dueDay:Number(draft.dueDay),startMonth:draft.startMonth,endMonth:draft.endMonth||null,isActive:draft.isActive};}
   else {path=editor.movement?`/finances/movements/${editor.movement.id}`:'/finances/movements';method=editor.movement?'PUT':'POST';payload={...(editor.movement?{revision:editor.movement.revision}:{id}),kind:draft.kind,date:draft.date,amount:financeAmount(draft.amount),reason:draft.reason.trim(),notes:draft.notes.trim()};}
   setBusy(true);await request(path,{method,body:JSON.stringify(payload)});onSaved();
  }catch(e){setError(message(e));setBusy(false);}
 }
 return <dialog ref={dialog} className={styles.editor} aria-labelledby={`finance-editor-${id}`} onCancel={e=>{e.preventDefault();close();}}><form ref={form} onSubmit={save}><header><h2 id={`finance-editor-${id}`}>{title}</h2><button type="button" aria-label="Cerrar formulario" disabled={busy} onClick={close}>×</button></header><div className={styles.editorBody}><fieldset disabled={busy}>
  {editor.type==='account'&&<p className={styles.hint}>Dinero disponible al iniciar, antes de los movimientos de esa fecha. Si es cero, escribe 0. Corregirlo recalcula los saldos de todos los meses; no modifica tus movimientos.</p>}
  {editor.type==='movement'&&<label>Tipo<select value={draft.kind} onChange={e=>change('kind',e.target.value as FinanceKind)}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label>}
  {(editor.type==='movement'||editor.type==='fixed'||editor.type==='void')&&<label>{editor.type==='void'?'Motivo de la anulación':'Motivo'}<input autoFocus type="text" required maxLength={editor.type==='void'?500:200} value={draft.reason} onChange={e=>change('reason',e.target.value)} placeholder={editor.type==='void'?'Ej. Registro duplicado':'Ej. Depósito recibido, renta o compra de mercancía'}/></label>}
  {(editor.type==='account'||editor.type==='movement'||editor.type==='fixed')&&<label>{editor.type==='account'?'Saldo inicial (MXN)':editor.type==='fixed'?'Importe mensual (MXN)':'Importe (MXN)'}<input type="text" inputMode="decimal" required maxLength={16} value={draft.amount} onChange={e=>change('amount',e.target.value)} placeholder="Ej. 1500.50"/><small>Sin símbolos ni separadores de miles.</small></label>}
  {(editor.type==='account'||editor.type==='movement'||editor.type==='pay')&&<label>{editor.type==='account'?'Fecha de inicio':'Fecha real del movimiento'}<input type="date" required min={editor.type==='account'?'1900-01-01':account?.openingDate} max={today} value={draft.date} onChange={e=>change('date',e.target.value)}/></label>}
  {editor.type==='pay'&&<div className={styles.hint}><strong>{editor.fixed.reason} · {financeMoney(editor.fixed.amount)}</strong><p>Corresponde a {financeMonth(month)}. Solo registra un pago que ya hiciste: no realiza transferencias. Se descontará en el mes de la fecha real que indiques. No lo registres otra vez como egreso manual.</p></div>}
  {editor.type==='void'&&<p className={styles.hint}>Anular {financeMoney(editor.movement.amount)} por “{editor.movement.reason}” lo excluye del saldo, pero conserva su historial. No devuelve dinero ni cancela un pago bancario.{editor.movement.fixedExpenseId?' El gasto fijo volverá a aparecer pendiente.':''}</p>}
  {editor.type==='fixed'&&<><div className={styles.formGrid}><label>Día de vencimiento<select value={draft.dueDay} onChange={e=>change('dueDay',e.target.value)}>{Array.from({length:31},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label><label>Desde el mes<input type="month" required min={account?.openingDate.slice(0,7)||'1900-01'} max="2199-12" value={draft.startMonth} onChange={e=>change('startMonth',e.target.value)}/></label><label>Hasta el mes (opcional)<input type="month" min={draft.startMonth} max="2199-12" value={draft.endMonth} onChange={e=>change('endMonth',e.target.value)}/></label></div><p className={styles.hint}>Si el mes no tiene ese día, se usará su último día. Los cambios afectan a los pendientes; los pagos registrados no se reescriben.</p><label className={styles.check}><input type="checkbox" checked={draft.isActive} onChange={e=>change('isActive',e.target.checked)}/>Repetición activa</label></>}
  {(editor.type==='movement'||editor.type==='fixed')&&<label>Notas (opcional)<textarea rows={3} maxLength={2000} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></label>}
 </fieldset>{error&&<p className={styles.error} role="alert">{error}</p>}</div><footer><button type="button" disabled={busy} onClick={close}>Cancelar</button><button type="submit" className={styles.primary} disabled={busy}>{busy?'Guardando…':editor.type==='pay'?'Confirmar pago registrado':editor.type==='void'?'Confirmar anulación':'Guardar'}</button></footer></form></dialog>;
}
