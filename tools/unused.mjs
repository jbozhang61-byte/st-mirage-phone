import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function walk(dir){ for(const f of readdirSync(dir)){ const p=join(dir,f); if(statSync(p).isDirectory()) walk(p); else if(p.endsWith('.js')) check(p); } }
function check(p){ const s=readFileSync(p,'utf8'); const re=/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g; let m; while((m=re.exec(s))){ for(let n of m[1].split(',')){ n=n.trim().split(' as ').pop().trim(); if(!n) continue; const body=s.slice(m.index+m[0].length); const re2=new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b'); if(!re2.test(body)) console.log(p.replace(/\\/g,'/')+' :: '+n); } } }
walk('src');
