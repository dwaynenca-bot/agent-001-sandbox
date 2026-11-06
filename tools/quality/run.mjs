import {spawnSync} from 'node:child_process';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {redact, sanitize, validate, plan} from './safety.mjs';
export {validate, plan};

export function auditResult(stdout, code) {
  let data;
  try { data = JSON.parse(stdout); } catch { return {status:'BLOCKED', reason:'Audit returned no valid JSON; registry/network check incomplete'}; }
  const counts = data.metadata?.vulnerabilities;
  if (data.error || !counts || !Number.isInteger(counts.total) || counts.total < 0)
    return {status:'BLOCKED', reason:'Audit error or missing vulnerability counts'};
  if (counts.total > 0) return {status:'FAIL', reason:`${counts.total} vulnerable package entries`, counts};
  return code === 0 ? {status:'PASS', reason:'Audit completed with zero reported vulnerabilities', counts}
    : {status:'BLOCKED', reason:'Audit process failed despite zero count'};
}
export function checkResult(check, result) {
  if (result.error || result.signal) return {status:'BLOCKED', reason:result.error?.message || `Terminated: ${result.signal}`};
  if (check.kind === 'audit') return auditResult(result.stdout, result.status);
  return {status:result.status === 0 ? 'PASS' : 'FAIL', reason:`Command exit ${result.status}`};
}
export function run(configPath, outputPath, approvedDigest) {
  const {config,cwd,scripts,digest} = plan(configPath);
  if (approvedDigest !== digest) throw Error('Execution blocked: review --plan then pass its digest with --approve-plan');
  const output = resolve(outputPath); mkdirSync(output,{recursive:true});
  const save=(name,value)=>writeFileSync(resolve(output,name),redact(value));
  const git = args => spawnSync('git',args,{cwd,encoding:'utf8'}).stdout?.trim() || 'unavailable';
  const report = {name:config.name, startedAt:new Date().toISOString(), cwd,
    commit:git(['rev-parse','HEAD']), branch:git(['branch','--show-current']),
    workingTree:git(['status','--short']), scope:'Local command evidence only; no live security certification', checks:[]};
  for (const check of config.checks) {
    if(plan(configPath).digest !== approvedDigest) throw Error('Execution blocked: plan changed during run');
    const missing=check.command[1]==='run' && !Object.hasOwn(scripts,check.command[2]);
    const result = missing ? {status:null,stdout:'',stderr:''} : spawnSync(check.command[0],check.command.slice(1), {cwd,encoding:'utf8',shell:false,
      timeout:check.timeoutMs || 120000, maxBuffer:16*1024*1024});
    save(`${check.id}.stdout.log`,result.stdout || '');
    save(`${check.id}.stderr.log`,result.stderr || '');
    const row = {...check, ...(missing ? {status:'NOT TESTED',reason:'Requested npm script is absent'} : checkResult(check,result)), exitCode:result.status, finishedAt:new Date().toISOString()};
    report.checks.push(row); console.log(redact(`${row.status} ${row.id}: ${row.reason}`));
    writeFileSync(resolve(output,'report.json'),JSON.stringify(sanitize(report),null,2)+'\n');
  }
  report.pending = config.pending || [];
  report.result = report.checks.some(c=>c.status==='FAIL') ? 'FAIL'
    : report.checks.some(c=>c.status==='BLOCKED') ? 'BLOCKED' : report.checks.some(c=>c.status==='NOT TESTED') ? 'NOT TESTED' : 'PASS';
  report.releaseReadiness = 'NOT TESTED';
  writeFileSync(resolve(output,'report.json'),JSON.stringify(sanitize(report),null,2)+'\n');
  save('report.md',`# ${report.name}\n\nCommand checks: ${report.result}. Release readiness: NOT TESTED.\n\n`+
    report.checks.map(c=>`- ${c.status}: ${c.id} (${c.level}) — ${c.reason}`).join('\n')+
    '\n\nPending (not executed):\n'+report.pending.map(x=>`- ${x}`).join('\n')+'\n');
  return sanitize(report);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 try {
  if(process.argv[2]==='--plan') {
   const p=plan(resolve(process.argv[3]));
   console.log(JSON.stringify(sanitize({cwd:p.cwd,config:p.config,allPackageScripts:p.scripts,approvalDigest:p.digest}),null,2));
  } else {
   if(!process.argv[2]||!process.argv[3]||process.argv[4]!=='--approve-plan'||!process.argv[5]) throw Error('Usage: run.mjs --plan CONFIG; then run.mjs CONFIG OUTPUT --approve-plan DIGEST');
   const r=run(resolve(process.argv[2]),process.argv[3],process.argv[5]);process.exitCode=r.result==='PASS'?0:1;
  }
 }catch(e){console.error(redact(e.message));process.exitCode=2;}
}
