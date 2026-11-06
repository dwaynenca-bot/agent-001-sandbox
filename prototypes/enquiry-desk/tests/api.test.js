import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {fixture, request, login, input} from './helpers.js';
import {randomToken, tokenHash, SESSION_MS} from '../src/auth.js';
let f;
before(async()=>{f=await fixture();});
after(async()=>{await f.close();});
const own = async (auth, subject) => {const r=await request(f.app,'/api/enquiries',{method:'POST',auth,json:input(subject)});assert.equal(r.status,201);return r.body;};
test('independent real HTTP logins use private cookies and store only session hashes',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]);
  assert.ok(a.cookie!==b.cookie);assert.ok(a.csrf!==b.csrf);
  assert.ok(a.header.includes('HttpOnly')&&a.header.includes('SameSite=Strict'));
  const token=a.cookie.split('=')[1],stored=f.app.db.prepare('SELECT token_hash FROM sessions').all();
  assert.ok(stored.some(row=>row.token_hash===tokenHash(token)));assert.ok(stored.every(row=>row.token_hash!==token));
  const sa=await request(f.app,'/api/session',{auth:a}),sb=await request(f.app,'/api/session',{auth:b});
  assert.equal(sa.status,200);assert.equal(sb.status,200);assert.equal(sa.body.user.businessName,f.accounts[0].business);assert.equal(sb.body.user.businessName,f.accounts[1].business);
  assert.equal(sa.headers.get('cache-control'),'no-store');assert.ok(sa.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
test('each business creates, retrieves, lists and updates only its own enquiry',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]);
  const first=await own(a,'Orchard private'),second=await own(b,'Lantern private');
  const updated=await request(f.app,'/api/enquiries/'+first.id,{method:'PATCH',auth:a,json:{status:'In progress',message:'Updated fictional details'}});
  assert.equal(updated.status,200);assert.equal(updated.body.status,'In progress');assert.ok(updated.body.updatedAt>=first.createdAt);
  for(const [auth,mine,foreign]of [[a,first,second],[b,second,first]]){
    const list=await request(f.app,'/api/enquiries',{auth});assert.equal(list.status,200);assert.ok(list.body.enquiries.some(e=>e.id===mine.id));assert.ok(!list.body.enquiries.some(e=>e.id===foreign.id));
    const detail=await request(f.app,'/api/enquiries/'+mine.id,{auth});assert.equal(detail.status,200);assert.ok(!Object.hasOwn(detail.body,'businessId'));assert.ok(!Object.hasOwn(detail.body,'password_hash'));
  }
});
test('cross-business and unknown IDs return indistinguishable 404 responses in BOTH directions',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]);const first=await own(a,'A unchanged'),second=await own(b,'B unchanged');
  for(const [auth,foreign]of [[a,second],[b,first]])for(const method of ['GET','PATCH']){
    const options={auth,method,...(method==='PATCH'?{json:{subject:'Forbidden change'}}:{})};
    const cross=await request(f.app,'/api/enquiries/'+foreign.id,options),unknown=await request(f.app,'/api/enquiries/'+randomUUID(),options);
    assert.equal(cross.status,404);assert.equal(unknown.status,404);assert.deepEqual(cross.body,unknown.body);assert.deepEqual(cross.body,{error:'Enquiry not found'});
  }
  for(const [auth,foreign]of [[a,second],[b,first]]){
    const options={method:'PATCH',auth,json:{businessId:'forged'}};
    const cross=await request(f.app,'/api/enquiries/'+foreign.id,options),unknown=await request(f.app,'/api/enquiries/'+randomUUID(),options);
    assert.equal(cross.status,404);assert.equal(unknown.status,404);assert.deepEqual(cross.body,unknown.body);
  }
  assert.equal((await request(f.app,'/api/enquiries/'+first.id,{auth:a})).body.subject,'A unchanged');
  assert.equal((await request(f.app,'/api/enquiries/'+second.id,{auth:b})).body.subject,'B unchanged');
});
test('forged tenant/user fields cannot widen access or transfer ownership',async()=>{
  const a=await login(f.app,f.accounts[0]);const item=await own(a,'Ownership unchanged');
  for(const key of ['businessId','business_id','userId','created_by','id']){
    const create=await request(f.app,'/api/enquiries',{method:'POST',auth:a,json:{...input('Forged'),[key]:f.accounts[1].businessId}});assert.equal(create.status,400);
    const update=await request(f.app,'/api/enquiries/'+item.id,{method:'PATCH',auth:a,json:{[key]:f.accounts[1].businessId}});assert.equal(update.status,400);
    assert.equal((await request(f.app,'/api/enquiries?'+key+'=other',{auth:a})).status,400);
  }
  assert.equal((await request(f.app,'/api/enquiries/'+item.id,{auth:a})).body.subject,'Ownership unchanged');
});
test('anonymous and forged-session requests cannot access any enquiry API',async()=>{
  for(const method of ['GET','POST','PATCH']){
    const path=method==='PATCH'?'/api/enquiries/'+randomUUID():'/api/enquiries';
    assert.equal((await request(f.app,path,{method,...(method==='GET'?{}:{json:input('Denied')})})).status,401);
    assert.equal((await request(f.app,path,{method,headers:{cookie:'ed_session='+randomToken()},...(method==='GET'?{}:{json:input('Denied')})})).status,401);
  }
});
test('session rotation, logout and server-side expiry invalidate old credentials',async()=>{
  const first=await login(f.app,f.accounts[0]),next=await login(f.app,f.accounts[0],first);assert.ok(first.cookie!==next.cookie);
  assert.equal((await request(f.app,'/api/session',{auth:first})).status,401);
  const logout=await request(f.app,'/api/logout',{method:'POST',auth:next});assert.equal(logout.status,204);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await request(f.app,'/api/session',{auth:next})).status,401);
  const expires=await login(f.app,f.accounts[1]);f.time.now+=SESSION_MS;
  assert.equal((await request(f.app,'/api/session',{auth:expires})).status,401);
});
test('CSRF and origin checks protect create, update and logout; tokens are session-bound',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]),item=await own(a,'Protected');
  for(const [path,method,json]of [['/api/enquiries','POST',input('Forbidden')],['/api/enquiries/'+item.id,'PATCH',{status:'Closed'}],['/api/logout','POST',undefined]]){
    for(const headers of [{'x-csrf-token':null},{'x-csrf-token':b.csrf},{origin:'http://attacker.invalid'},{origin:null},{'sec-fetch-site':'cross-site'}]){
      const r=await request(f.app,path,{method,auth:a,json,headers});assert.equal(r.status,403);
    }
  }
  assert.equal((await request(f.app,'/api/session',{auth:a})).status,200);
  assert.equal((await request(f.app,'/api/enquiries/'+item.id,{auth:a})).body.status,'New');
  assert.equal((await request(f.app,'/api/login',{method:'POST',json:{email:f.accounts[0].email,password:f.accounts[0].password},headers:{origin:'http://attacker.invalid'}})).status,403);
});
test('invalid JSON, UTF-8, body size, content type and fields fail meaningfully',async()=>{
  const a=await login(f.app,f.accounts[0]);
  for(const [raw,headers,status]of [['{bad',{},400],[Buffer.from([255]),{},400],['x'.repeat(17000),{},413],['{}',{'content-type':'text/plain'},415]]){
    const r=await request(f.app,'/api/enquiries',{method:'POST',auth:a,raw,headers});assert.equal(r.status,status);
  }
  for(const json of [null,[],{name:'',subject:'x'},{name:'x',subject:'x',email:'bad'},{name:'x',subject:'x',status:'Admin'},{name:'x',subject:'x',message:'x'.repeat(4001)}])assert.equal((await request(f.app,'/api/enquiries',{method:'POST',auth:a,json})).status,400);
  for(const query of ['limit=0','offset=-1','limit=1&limit=2','status=Admin'])assert.equal((await request(f.app,'/api/enquiries?'+query,{auth:a})).status,400);
});
test('SQL injection and script-like text remain data, while tenant isolation remains intact',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]);
  const dangerous="'; DROP TABLE enquiries; -- <script>alert(1)</script>";
  const created=await request(f.app,'/api/enquiries',{method:'POST',auth:a,json:{name:dangerous,subject:dangerous,message:dangerous}});assert.equal(created.status,201);assert.equal(created.body.subject,dangerous);
  assert.equal((await request(f.app,'/api/enquiries/'+created.body.id,{auth:b})).status,404);
  assert.equal((await request(f.app,'/api/enquiries/'+encodeURIComponent("' OR 1=1 --"),{auth:a})).status,404);
  assert.equal((await request(f.app,'/api/enquiries?status='+encodeURIComponent("' OR 1=1 --"),{auth:a})).status,400);
  assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM businesses').get().n,2);
});
test('pagination and status filters remain scoped to the authenticated business',async()=>{
  const a=await login(f.app,f.accounts[0]),b=await login(f.app,f.accounts[1]);const ai=await own(a,'A closed'),bi=await own(b,'B closed');
  for(const [auth,item]of [[a,ai],[b,bi]])assert.equal((await request(f.app,'/api/enquiries/'+item.id,{method:'PATCH',auth,json:{status:'Closed'}})).status,200);
  const page=await request(f.app,'/api/enquiries?status=Closed&limit=1&offset=0',{auth:a});assert.equal(page.status,200);assert.equal(page.body.enquiries.length,1);assert.equal(page.body.total,1);assert.equal(page.body.enquiries[0].id,ai.id);
});
test('database write failures return generic 500 and permit recovery without partial writes',async()=>{
  const a=await login(f.app,f.accounts[0]);const before=f.app.db.prepare('SELECT count(*) AS n FROM enquiries').get().n;
  f.app.db.exec("CREATE TRIGGER test_write_failure BEFORE INSERT ON enquiries BEGIN SELECT RAISE(ABORT,'sensitive internal database detail'); END;");
  try {const failed=await request(f.app,'/api/enquiries',{method:'POST',auth:a,json:input('Failed write')});assert.equal(failed.status,500);assert.deepEqual(failed.body,{error:'Internal server error'});assert.equal(f.app.db.prepare('SELECT count(*) AS n FROM enquiries').get().n,before);}
  finally {f.app.db.exec('DROP TRIGGER test_write_failure');}
  await own(a,'Recovered write');assert.equal(f.errors.length,1);
});
test('Host validation and static route allowlisting do not expose database files',async()=>{
  // fetch normalizes Host; use raw HTTP to exercise an actual forged Host header.
  const status=await new Promise((resolve,reject)=>{
    const req=httpRequest(f.app.origin+'/api/session',{headers:{Host:'attacker.invalid'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();
  });
  assert.equal(status,403);
  for(const path of ['/var/enquiry-desk.sqlite','/src/database.js','/.env','/../var/enquiry-desk.sqlite'])assert.equal((await fetch(f.app.origin+path)).status,404);
});
test('repeated failed logins are throttled and recover after the time window',async()=>{
  await login(f.app,f.accounts[0]);
  for(let i=0;i<5;i++){
    const r=await request(f.app,'/api/login',{method:'POST',json:{email:i%2?'unknown@example.invalid':f.accounts[0].email,password:randomToken()}});assert.equal(r.status,401);assert.deepEqual(r.body,{error:'Invalid email or password'});
  }
  const blocked=await request(f.app,'/api/login',{method:'POST',json:{email:f.accounts[0].email,password:f.accounts[0].password}});assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
  f.time.now+=60001;await login(f.app,f.accounts[0]);
});
