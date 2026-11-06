import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditResult,checkResult,validate,run,plan} from '../run.mjs';
import {redact,sanitize} from '../safety.mjs';
import {inspect} from '../inspect.mjs';
test('audit vulnerabilities fail even with exit zero; network errors never pass',()=>{
 assert.equal(auditResult('{"metadata":{"vulnerabilities":{"total":1}}}',0).status,'FAIL');
 for(const s of ['','{}','{"error":{"code":"E403"}}']) assert.equal(auditResult(s,1).status,'BLOCKED');
 assert.equal(auditResult('{"metadata":{"vulnerabilities":{"total":0}}}',0).status,'PASS');
 assert.equal(auditResult('{"metadata":{"vulnerabilities":{"total":0}}}',1).status,'BLOCKED');
});
test('missing executable and timeout blocked; command failure is fail',()=>{
 assert.equal(checkResult({}, {error:new Error('missing')}).status,'BLOCKED');
 assert.equal(checkResult({}, {signal:'SIGTERM'}).status,'BLOCKED');
 assert.equal(checkResult({}, {status:1}).status,'FAIL');
});
test('live tests and ambiguous configs rejected',()=>{
 assert.throws(()=>validate({name:'x',checks:[{id:'tenant',kind:'live-tenant',command:['true'],level:'mocked'}]}));
 assert.throws(()=>validate({name:'x',checks:[{id:'x',command:'npm test'}]}));
});
test('snapshots cannot certify runtime or stale scans',()=>{
 const rows=inspect({expectedAppId:'x',app:{id:'x'},branch:'main',expectedEntities:['Enquiry'],scan:{status:'out_of_date'}});
 assert.equal(rows.find(x=>x.id==='security-scan').status,'BLOCKED');
 assert.equal(rows.find(x=>x.id==='rls-Enquiry').status,'FAIL');
 assert.equal(rows.find(x=>x.id==='live-tenant-isolation').status,'NOT TESTED');
});
test('runner records actual failure, continues regression and writes evidence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'agent-quality-'));
 try{
  writeFileSync(join(dir,'package.json'),JSON.stringify({scripts:{test:'node -e \"process.exit(4)\"',build:'node -e \"console.log(123)\"'}}));
  const cfg=join(dir,'config.json');writeFileSync(cfg,JSON.stringify({name:'fictional',checks:[
   {id:'fail',command:['npm','run','test'],level:'tooling'},
   {id:'pass',command:['npm','run','build'],level:'tooling'}],pending:['live isolation']}));
  const result=run(cfg,join(dir,'out'),plan(cfg).digest);
  assert.equal(result.result,'FAIL'); assert.equal(result.checks[1].status,'PASS');
  assert.equal(JSON.parse(readFileSync(join(dir,'out/report.json'))).releaseReadiness,'NOT TESTED');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('empty snapshot cannot pass target; null scan groups cannot pass; ignored findings stay visible',()=>{
 assert.equal(inspect({}).find(x=>x.id==='target').status,'BLOCKED');
 const result=Object.fromEntries(['rls_recommendations','hardcoded_secrets','backend_functions','open_backend_functions','unlocked_user_fields','exposed_fields','dependency_vulnerabilities','static_code_findings','header_recommendations'].map(k=>[k,[]]));
 result.scanned_at='2026-11-06T00:00:00Z';
 const snapshot={scan:{status:'up_to_date',static_code_enabled:true,result}};
 assert.equal(inspect(snapshot).find(x=>x.id==='security-scan').status,'PASS');
 result.ignored_fingerprints=['hidden'];assert.equal(inspect(snapshot).find(x=>x.id==='security-scan').status,'FAIL');
 result.ignored_fingerprints=[];result.open_backend_functions=null;assert.equal(inspect(snapshot).find(x=>x.id==='security-scan').status,'BLOCKED');
});

test('missing test and lint scripts are NOT TESTED; reviewed plan is required',()=>{
 const dir=mkdtempSync(join(tmpdir(),'quality-missing-'));
 try {
  writeFileSync(join(dir,'package.json'),'{}');
  const cfg=join(dir,'c.json');writeFileSync(cfg,JSON.stringify({name:'missing',checks:['test','lint'].map(id=>({id,command:['npm','run',id],level:'local-source'}))}));
  assert.throws(()=>run(cfg,join(dir,'unapproved')),/blocked/);
  const r=run(cfg,join(dir,'out'),plan(cfg).digest);
  assert.equal(r.result,'NOT TESTED');assert.ok(r.checks.every(c=>c.status==='NOT TESTED'));
  const old=plan(cfg).digest;writeFileSync(join(dir,'package.json'),'allowed-to-change-but-requires-new-review');
  assert.throws(()=>run(cfg,join(dir,'out'),old));
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('destructive, publishing, arbitrary executable and extra npm arguments are rejected',()=>{
 for(const command of [['rm','-rf','/tmp/x'],['npm','publish'],['npm','run','deploy'],['node','-e','evil()'],['npm','run','test','--','--evil'],['npm','audit','fix','--force']])
  assert.throws(()=>validate({name:'bad',checks:[{id:'bad',command,level:'tooling'}]}));
});
test('credentials are redacted in strings and structured evidence',()=>{
 const secret='synthetic-private-value';
 assert.ok(!redact(secret,{API_KEY:secret}).includes(secret));
 for(const input of ['Authorization: Bearer syntheticBearer123','https://user:pass@example.invalid/?preview_token=abc123','password=hunterSynthetic','{"api_key":"synthetic123"}','ghp_abcdefghijklmnopqrstuvwxyz','eyJhbGciOiJIUzI1NiJ9.abc123.def456']) {
  const r=redact(input,{});assert.match(r,/REDACTED/);assert.notEqual(r,input);
 }
 assert.equal(sanitize({password:'example'}).password,'[REDACTED]');
});
test('audit counts retained accurately',()=>{
 const counts={critical:1,high:6,moderate:2,low:2,info:0,total:11};
 const r=auditResult(JSON.stringify({metadata:{vulnerabilities:counts}}),1);
 assert.equal(r.status,'FAIL');assert.deepEqual(r.counts,counts);
});
test('changed lifecycle script invalidates prior approval before execution',()=>{
 const dir=mkdtempSync(join(tmpdir(),'quality-approval-'));
 try {
  const pkg=join(dir,'package.json'),cfg=join(dir,'c.json');
  writeFileSync(pkg,JSON.stringify({scripts:{test:'node -e "process.exit(0)"'}}));
  writeFileSync(cfg,JSON.stringify({name:'binding',checks:[{id:'test',command:['npm','run','test'],level:'tooling'}]}));
  const digest=plan(cfg).digest;
  writeFileSync(pkg,JSON.stringify({scripts:{test:'node -e "process.exit(0)"',pretest:'echo changed'}}));
  assert.throws(()=>run(cfg,join(dir,'out'),digest),/blocked/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('stdout stderr JSON Markdown and returned evidence redact supplied synthetic credentials',()=>{
 const dir=mkdtempSync(join(tmpdir(),'quality-redaction-'));
 const prior=process.env.AGENT_TEST_SECRET;
 process.env.AGENT_TEST_SECRET='synthetic-secret-acceptance-123';
 try {
  const cfg=join(dir,'c.json');
  writeFileSync(join(dir,'package.json'),JSON.stringify({scripts:{test:`node -e "console.log(process.env.AGENT_TEST_SECRET); console.error('Bearer syntheticBearerValue123')"`}}));
  writeFileSync(cfg,JSON.stringify({name:process.env.AGENT_TEST_SECRET,checks:[{id:'test',command:['npm','run','test'],level:'tooling'}]}));
  const r=run(cfg,join(dir,'out'),plan(cfg).digest);
  assert.equal(r.result,'PASS');
  for(const name of ['test.stdout.log','test.stderr.log','report.json','report.md']) {
   const content=readFileSync(join(dir,'out',name),'utf8');
   assert.ok(!content.includes(process.env.AGENT_TEST_SECRET));
   assert.ok(!content.includes('syntheticBearerValue123'));
  }
  assert.ok(!JSON.stringify(r).includes(process.env.AGENT_TEST_SECRET));
 }finally{if(prior===undefined)delete process.env.AGENT_TEST_SECRET;else process.env.AGENT_TEST_SECRET=prior;rmSync(dir,{recursive:true,force:true});}
});
