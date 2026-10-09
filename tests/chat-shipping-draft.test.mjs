import test from "node:test";
import assert from "node:assert/strict";
import {chatShippingDraftKey,readChatShippingDraft,writeChatShippingDraft} from "../app/lib/chat-shipping-draft.ts";

const storage=()=>{
  const items=new Map();
  return {getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value)};
};
const address={name:"Cliente de prueba",phone:"1234567890",street:"Calle Ejemplo",number:"SN",country:"MX",postalCode:"94300",state:"VE",city:"Orizaba",district:"Centro",email:"",interiorNumber:"2",references:"Puerta verde"};
const parcel={type:"box",content:"Caricatura 50 pares",amount:"1",declaredValue:"446.50",weight:"1.8",length:"30",width:"25",height:"20"};
const draft={version:1,conversationId:"chat-a",pastedInfo:"Mensaje completo\ncon los datos del cliente",origin:{...address,name:"Remitente"},destination:address,parcel};

test("recovers all editable modal fields when a conversation is reopened",()=>{
  const local=storage();
  assert.equal(writeChatShippingDraft(draft,local),true);
  assert.deepEqual(readChatShippingDraft("chat-a",local),draft);
});

test("each conversation keeps an independent draft",()=>{
  const local=storage();
  const other={...draft,conversationId:"chat-b",pastedInfo:"Otro cliente",destination:{...address,name:"Otro nombre"},parcel:{...parcel,weight:"3"}};
  writeChatShippingDraft(draft,local);writeChatShippingDraft(other,local);
  assert.deepEqual(readChatShippingDraft("chat-a",local),draft);
  assert.deepEqual(readChatShippingDraft("chat-b",local),other);
  assert.equal(readChatShippingDraft("chat-c",local),null);
  assert.notEqual(chatShippingDraftKey("chat:a"),chatShippingDraftKey("chat%3Aa"));
});

test("keeps empty inputs and partial drafts without replacing them with default values",()=>{
  const local=storage();
  const unfinished={...draft,parcel:{...parcel,weight:"",length:""},destination:{...address,name:"",number:""}};
  writeChatShippingDraft(unfinished,local);
  assert.deepEqual(readChatShippingDraft("chat-a",local),unfinished);
  const partial={version:1,conversationId:"chat-a",pastedInfo:"Pegado antes de cargar el servidor",destination:address};
  writeChatShippingDraft(partial,local);
  assert.deepEqual(readChatShippingDraft("chat-a",local),partial);
});

test("ignores malformed, unsupported or mismatched drafts",()=>{
  const local=storage();
  for(const data of ["broken",JSON.stringify(null),JSON.stringify({...draft,version:2}),JSON.stringify({...draft,conversationId:"chat-b"}),JSON.stringify({...draft,destination:[]}),JSON.stringify({...draft,pastedInfo:null})]){
    local.setItem(chatShippingDraftKey("chat-a"),data);
    assert.equal(readChatShippingDraft("chat-a",local),null);
  }
});

test("never restores quotes, generated guides or unexpected address fields from storage",()=>{
  const local=storage();
  const extra={...draft,rates:[{totalPrice:123}],selectedRate:"old-rate",environment:"production",labelUrl:"https://example.com/label",destination:{...address,token:"not-a-form-field"}};
  writeChatShippingDraft(extra,local);
  assert.deepEqual(JSON.parse(local.getItem(chatShippingDraftKey("chat-a"))),draft);
  local.setItem(chatShippingDraftKey("chat-a"),JSON.stringify(extra));
  assert.deepEqual(readChatShippingDraft("chat-a",local),draft);
});

test("blocked or full browser storage does not break the shipping form",()=>{
  const blocked={getItem:()=>{throw Error("SecurityError");},setItem:()=>{throw Error("QuotaExceededError");}};
  assert.equal(readChatShippingDraft("chat-a",blocked),null);
  assert.equal(writeChatShippingDraft(draft,blocked),false);
  assert.equal(readChatShippingDraft("chat-a",null),null);
  assert.equal(writeChatShippingDraft(draft,null),false);
  assert.equal(readChatShippingDraft("chat-a"),null); // SSR without a browser.
});
