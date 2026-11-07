import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
const PORT = 9398;
const profile = mkdtempSync(join(tmpdir(), 'mp-chk-'));
const child = spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars','--window-size=390,844','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(p){ for(let i=0;i<70;i++){ try{ const r=await fetch('http://127.0.0.1:'+PORT+p); if(r.ok) return await r.json(); }catch{} await sleep(250);} throw new Error('devtools'); }
let id=0; const pending=new Map(); const errors=[];
function send(ws,m,p={}){ const mid=++id; return new Promise((res,rej)=>{ pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
await getJson('/json/version');
const page=(await getJson('/json/list')).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); if(m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);} else if (m.method==='Runtime.exceptionThrown') { errors.push(String(m.params?.exceptionDetails?.exception?.description||m.params?.exceptionDetails?.text).slice(0,160)); } };
await send(ws,'Page.enable'); await send(ws,'Runtime.enable');
await send(ws,'Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
await send(ws,'Page.navigate',{url:'http://127.0.0.1:7788/preview/?theme=dark&apps=all'});
await sleep(3000);
const expr = "(async () => { const out = {}; const host = document.createElement('div'); host.style.height='700px'; document.body.appendChild(host); const nav = { home(){}, close(){}, go(){}, setChrome(){} }; for (const [key, file] of [['settings','/src/apps/settings.js'],['discord','/src/apps/extra.js'],['telegram','/src/apps/extra.js']]) { try { const mod = await import(file); const fn = key === 'settings' ? mod.mountSettings : (key === 'discord' ? mod.mountDiscord : mod.mountTelegram); const h2 = document.createElement('div'); h2.style.height='700px'; document.body.appendChild(h2); fn(h2, { nav }); out[key] = { ok: true, len: h2.textContent.trim().length }; } catch (e) { out[key] = { err: String(e && e.message || e).slice(0, 100) }; } } return out; })()";
const r = await send(ws,'Runtime.evaluate',{expression: expr, awaitPromise:true, returnByValue:true});
console.log(JSON.stringify(r.result?.value));
console.log('errors:', errors.slice(0,3).join(' || ').slice(0,300));
try{ ws.close(); }catch{}
child.kill(); await sleep(250);
try{ rmSync(profile,{recursive:true,force:true}); }catch{}
process.exit(0);