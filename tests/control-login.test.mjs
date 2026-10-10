import test from "node:test";
import assert from "node:assert/strict";
import {controlSession,loginControl} from "../app/lib/control-api.ts";

async function withBrowser(run) {
  const oldFetch=globalThis.fetch;
  const oldWindow=globalThis.window;
  const oldStorage=globalThis.localStorage;
  const items=new Map();
  globalThis.window={};
  globalThis.localStorage={getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};
  try {await run(items);} finally {
    globalThis.fetch=oldFetch;
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  }
}

test("authenticates Control with the CRM credentials and stores only the returned token",()=>withBrowser(async items=>{
  controlSession.set("old-account-token");
  let sent;
  globalThis.fetch=async(url,init)=>{sent={url,init};return new Response(JSON.stringify({token:"new-control-token"}),{status:200});};
  assert.equal(await loginControl("  CLIENTE@EXAMPLE.COM "," password unchanged "),"new-control-token");
  assert.equal(new URL(sent.url).pathname,"/auth/login");
  assert.equal(sent.init.method,"POST");
  assert.deepEqual(JSON.parse(sent.init.body),{identifier:"cliente@example.com",password:" password unchanged "});
  assert.equal(sent.init.headers.Authorization,undefined);
  assert.equal(controlSession.get(),"new-control-token");
  assert.deepEqual([...items],[['sock_control_token','new-control-token']]);
}));

test("failed Control authentication never keeps the previous account token",()=>withBrowser(async()=>{
  controlSession.set("old-account-token");
  globalThis.fetch=async()=>new Response(JSON.stringify({message:"Credenciales inválidas"}),{status:401});
  await assert.rejects(loginControl("cliente@example.com","wrong"),/Credenciales inválidas/);
  assert.equal(controlSession.get(),null);
}));

test("manual Control login preserves case-sensitive usernames",()=>withBrowser(async()=>{
  globalThis.fetch=async(url,init)=>{
    assert.deepEqual(JSON.parse(init.body),{identifier:"Merlyn",password:"example"});
    return new Response(JSON.stringify({token:"manual-token"}),{status:200});
  };
  assert.equal(await loginControl(" Merlyn ","example"),"manual-token");
}));

test("invalid authentication responses do not create a session",()=>withBrowser(async()=>{
  for(const result of [null,{}, {token:""},{token:123}]){
    globalThis.fetch=async()=>new Response(JSON.stringify(result),{status:200});
    await assert.rejects(loginControl("cliente@example.com","example"),/sesión válida/);
    assert.equal(controlSession.get(),null);
  }
}));

test("a slow Control service is aborted instead of leaving login waiting indefinitely",()=>withBrowser(async()=>{
  globalThis.fetch=async(url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('AbortError')),{once:true}));
  await assert.rejects(loginControl("cliente@example.com","example",5),/tardó demasiado/);
  assert.equal(controlSession.get(),null);
}));

test("logout removes the Control token without affecting unrelated local drafts",()=>withBrowser(async items=>{
  controlSession.set("active-token");
  localStorage.setItem("merlynseller:chat-shipping-draft:v1:chat-a","local-draft");
  controlSession.clear();
  assert.equal(controlSession.get(),null);
  assert.deepEqual([...items],[["merlynseller:chat-shipping-draft:v1:chat-a","local-draft"]]);
}));
