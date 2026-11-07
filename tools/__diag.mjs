import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
const PORT = 9392;
const profile = mkdtempSync(join(tmpdir(), 'mp-diag-'));
const child = spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars','--window-size=420,900','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(p){ for(let i=0;i<70;i++){ try{ const r=await fetch('http://127.0.0.1:'+PORT+p); if(r.ok) return await r.json(); }catch{} await sleep(250);} throw new Error('devtools'); }
let id=0; const pending=new Map(); const errors=[];
function send(ws,m,p={}){ const mid=++id; return new Promise((res,rej)=>{ pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
await getJson('/json/version');
const page=(await getJson('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); if(m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);} else if (m.method==='Runtime.exceptionThrown') { errors.push(String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text).slice(0,300)); } else if (m.method==='Runtime.consoleAPICalled' && m.params.type==='error') { errors.push('console: ' + (m.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,200)); } };
await send(ws,'Page.enable'); await send(ws,'Runtime.enable');
await send(ws,'Emulation.setDeviceMetricsOverride',{width:420,height:900,deviceScaleFactor:2,mobile:true});
await send(ws,'Page.navigate',{url:'http://127.0.0.1:7788/preview/?theme=dark&apps=all'});
await sleep(3200);
const clickExpr = "(() => { const tiles = [...document.querySelectorAll('.mp-appicon')]; const t = tiles.find(n => (n.textContent||'').includes('设置')); if (!t) return { found: false, sample: tiles.slice(0,3).map(n=>(n.textContent||'').slice(0,8)) }; t.click(); return { found: true, cls: t.className }; })()";
const c1 = await send(ws,'Runtime.evaluate',{expression: clickExpr, returnByValue:true});
console.log('click:', JSON.stringify(c1.result?.value));
await sleep(2200);
const r = await send(ws,'Runtime.evaluate',{expression:'({ title: document.querySelector(".mp-nav__title")?.textContent || "", hasSet: !!document.querySelector(".mp-set"), text: (document.querySelector(".mp-view")?.textContent||"").slice(0,60) })', returnByValue:true});
console.log('after:', JSON.stringify(r.result?.value));
console.log('errors:', errors.slice(0,5).join(' || ').slice(0, 800));
try{ ws.close(); }catch{}
child.kill(); await sleep(300);
try{ rmSync(profile,{recursive:true,force:true}); }catch{}
process.exit(0);