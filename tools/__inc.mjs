
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
const PORT = 9360;
const profile = mkdtempSync(join(tmpdir(), 'mp-inc-'));
const child = spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars','--window-size=420,900','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(p){ for(let i=0;i<70;i++){ try{ const r=await fetch('http://127.0.0.1:'+PORT+p); if(r.ok) return await r.json(); }catch{} await sleep(250);} throw new Error('devtools'); }
let id=0; const pending=new Map();
function send(ws,m,p={}){ const mid=++id; return new Promise((res,rej)=>{ pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
await getJson('/json/version');
const page=(await getJson('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); if(m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);} };
await send(ws,'Page.enable'); await send(ws,'Runtime.enable');
await send(ws,'Emulation.setDeviceMetricsOverride',{width:420,height:900,deviceScaleFactor:2,mobile:true});
await send(ws,'Page.navigate',{url:'http://127.0.0.1:7788/preview/?theme=dark&app=weibo&apps=all'});
await sleep(3200);
const expr = [
  '(async () => {',
  '  const sleep = ms => new Promise(r => setTimeout(r, ms));',
  '  const body = document.querySelector(".mp-wb__body");',
  '  const count = () => document.querySelectorAll(".mp-wb__post").length;',
  '  const out = { before: count(), bodyChildren: body ? body.children.length : -1 };',
  '  if (body) { body.scrollTop = body.scrollHeight; body.dispatchEvent(new Event("scroll")); }',
  '  await sleep(3000);',
  '  out.afterScroll = count();',
  '  const store = await import("/src/store.js");',
  '  out.cached = (store.getFeed("weibo")?.items || []).length;',
  '  out.toast = (document.querySelector(".mp-toast")?.textContent || "") + "|" + (document.querySelector(".mp-island-toast")?.textContent || "");',
  '  return out;',
  '})()',
].join('\n');
const r = await send(ws,'Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
console.log(JSON.stringify(r.result?.value ?? null));
try{ ws.close(); }catch{}
child.kill(); await sleep(300);
try{ rmSync(profile,{recursive:true,force:true}); }catch{}
process.exit(0);
