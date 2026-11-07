import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
const PORT = 9395;
const profile = mkdtempSync(join(tmpdir(), 'mp-fill-'));
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
await send(ws,'Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
await send(ws,'Emulation.setTouchEmulationEnabled',{enabled:true});
await send(ws,'Page.navigate',{url:'http://127.0.0.1:7788/preview/?theme=dark&apps=all'});
await sleep(3200);
const expr = "(() => { const dev = document.querySelector('.mp-device'); const shell = document.querySelector('.mp-shell'); const r = dev ? dev.getBoundingClientRect() : null; const s = shell ? getComputedStyle(shell) : null; return { htmlClass: document.documentElement.className, vw: innerWidth, vh: innerHeight, rect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, shell: s ? { pos: s.position, transform: s.transform, right: s.right, bottom: s.bottom } : null }; })()";
const out = await send(ws,'Runtime.evaluate',{expression: expr, returnByValue:true});
console.log(JSON.stringify(out.result?.value));
try{ ws.close(); }catch{}
child.kill(); await sleep(300);
try{ rmSync(profile,{recursive:true,force:true}); }catch{}
process.exit(0);