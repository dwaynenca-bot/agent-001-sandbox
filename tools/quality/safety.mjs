import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function redact(value, env=process.env) {
 let s=typeof value==='string'?value:JSON.stringify(value);
 for(const [key,secret] of Object.entries(env)) if(/secret|token|password|credential|api.?key|private.?key/i.test(key) && secret?.length>=4) s=s.split(secret).join('[REDACTED]');
 return s.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]')
 .replace(/\bBearer\s+[^\s"'\\]+/gi,'Bearer [REDACTED]')
 .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|npm_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,'[REDACTED]')
 .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[REDACTED]@')
 .replace(/([?&](?:[^=&#\s]*(?:token|secret|password|key|code|signature)[^=&#\s]*)=)[^&#\s"']+/gi,'$1[REDACTED]')
 .replace(/((?:["']?(?:[\w-]*(?:token|secret|password|credential|api[_-]?key|private[_-]?key)[\w-]*)["']?)\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi,'$1[REDACTED]');
}
export function validate(config) {
 if(!config || typeof config.name!=='string' || !config.name || !Array.isArray(config.checks) || !config.checks.length) throw Error('Nonempty name and checks required');
 if(Object.keys(config).some(k=>!['name','cwd','checks','pending'].includes(k))) throw Error('Unknown configuration field');
 if(config.cwd!==undefined && typeof config.cwd!=='string') throw Error('cwd must be a string');
 if(config.pending!==undefined && (!Array.isArray(config.pending)||config.pending.some(x=>typeof x!=='string'))) throw Error('pending must be strings');
 const ids=new Set();
 for(const c of config.checks) {
  if(!c || Object.keys(c).some(k=>!['id','kind','command','level','timeoutMs'].includes(k))) throw Error('Unknown check field');
  if(typeof c.id!=='string'||!/^[a-z0-9-]+$/.test(c.id)||ids.has(c.id)) throw Error('Unique safe check id required');ids.add(c.id);
  if(!['command','audit',undefined].includes(c.kind)) throw Error('Live/manual or unknown check kinds cannot execute');
  if(!['local-source','mocked','tooling'].includes(c.level)) throw Error('Explicit non-live evidence level required');
  if(c.timeoutMs!==undefined && (!Number.isInteger(c.timeoutMs)||c.timeoutMs<1||c.timeoutMs>600000)) throw Error('Invalid timeout');
  const a=c.command;
  if(!Array.isArray(a)||a.some(x=>typeof x!=='string')) throw Error('command must be argv');
  const script=a[0]==='npm' && a[1]==='run' && ['test','lint','build','test:browser','test:e2e'].includes(a[2]) && (a.length===3 || a.length===5 && a[3]==='--' && /^--project=(desktop|mobile)$/.test(a[4]));
  const tree=JSON.stringify(a)===JSON.stringify(['npm','ls','--all']);
  const audit=[['npm','audit','--json'],['npm','audit','--omit=dev','--json']].some(x=>JSON.stringify(x)===JSON.stringify(a));
  if(!(script||tree||audit)||audit!==(c.kind==='audit')) throw Error('Command not in fixed quality-check allowlist');
 }
}
export function plan(path) {
 const config=JSON.parse(readFileSync(path,'utf8'));validate(config);
 const cwd=resolve(dirname(path),config.cwd||'.');
 const packageText=readFileSync(resolve(cwd,'package.json'),'utf8');
 const pkg=JSON.parse(packageText);
 const data={config,cwd,packageText};
 const digest=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 return {config,cwd,scripts:pkg.scripts||{},digest};
}

export function sanitize(value) {
 if(typeof value==='string') return redact(value);
 if(Array.isArray(value)) return value.map(sanitize);
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[redact(k), /secret|token|password|credential|api.?key|private.?key/i.test(k)?'[REDACTED]':sanitize(v)]));
 return value;
}
