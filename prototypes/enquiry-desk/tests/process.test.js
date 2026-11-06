import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {temporary, request, login, input} from './helpers.js';
import {openDatabase} from '../src/database.js';
const cwd=fileURLToPath(new URL('../',import.meta.url));
function command(script,args) {
  return spawnSync(process.execPath,[`scripts/${script}.mjs`,...args],{cwd,encoding:'utf8',timeout:15000});
}
async function child(databasePath) {
  const processChild=spawn(process.execPath,['src/server.js'],{cwd,env:{...process.env,ENQUIRY_DB:databasePath,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let errorText='';processChild.stderr.on('data',chunk=>{errorText+=chunk;});
  const origin=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>{processChild.kill('SIGKILL');reject(new Error('Server startup timed out'));},5000);
    processChild.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited before ready'));});
    processChild.stdout.on('data',chunk=>{output+=chunk;const line=output.split('\n')[0];try{const message=JSON.parse(line);if(message.event==='listening'){clearTimeout(timer);resolve(message.origin);}}catch{}});
  });
  return {origin,async close(){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{processChild.kill('SIGKILL');reject(new Error('Server shutdown timed out'));},5000);processChild.once('exit',(code)=>{clearTimeout(timer);code===0?resolve():reject(new Error('Server shutdown failed'));});processChild.kill('SIGTERM');});assert.ok(!errorText.includes('request failed'));}};
}
function initialized(temp) {
  const credentials=join(temp.root,'private-credentials.json');const result=command('init',[temp.databasePath,credentials]);assert.equal(result.status,0);assert.equal(statSync(credentials).mode&0o777,0o600);
  const accounts=JSON.parse(readFileSync(credentials,'utf8'));assert.equal(accounts.length,2);assert.ok(accounts.every(a=>!result.stdout.includes(a.password)));
  return {accounts,credentials};
}
test('real server process restart preserves both accounts, enquiries, updates and tenant isolation',async()=>{
  const temp=temporary();let app;
  try {
    const {accounts}=initialized(temp);app=await child(temp.databasePath);const a=await login(app,accounts[0]),b=await login(app,accounts[1]);
    const ea=await request(app,'/api/enquiries',{method:'POST',auth:a,json:input('Persistent A')}),eb=await request(app,'/api/enquiries',{method:'POST',auth:b,json:input('Persistent B')});assert.equal(ea.status,201);assert.equal(eb.status,201);
    assert.equal((await request(app,'/api/enquiries/'+ea.body.id,{method:'PATCH',auth:a,json:{status:'In progress'}})).status,200);
    await app.close();app=undefined;app=await child(temp.databasePath);
    assert.equal((await request(app,'/api/session',{auth:a})).status,200);
    assert.equal((await request(app,'/api/enquiries/'+ea.body.id,{auth:a})).body.status,'In progress');
    assert.equal((await request(app,'/api/enquiries/'+eb.body.id,{auth:b})).body.subject,'Persistent B');
    for(const [auth,id]of [[a,eb.body.id],[b,ea.body.id]])assert.equal((await request(app,'/api/enquiries/'+id,{auth})).status,404);
    await login(app,accounts[0]);await login(app,accounts[1]);
    const check=openDatabase(temp.databasePath);assert.equal(check.prepare('SELECT count(*) AS n FROM users').get().n,2);assert.equal(check.prepare('SELECT count(*) AS n FROM enquiries').get().n,2);check.close();
  } finally {await app?.close();temp.clean();}
});
test('backup and restore CLI recover both businesses, retain the original and revoke restored sessions',async()=>{
  const temp=temporary();let app,recovered;
  try {
    const {accounts}=initialized(temp);app=await child(temp.databasePath);const a=await login(app,accounts[0]),b=await login(app,accounts[1]);
    const ea=await request(app,'/api/enquiries',{method:'POST',auth:a,json:input('Snapshot A')}),eb=await request(app,'/api/enquiries',{method:'POST',auth:b,json:input('Snapshot B')});
    const backup=join(temp.root,'snapshot.sqlite'),restored=join(temp.root,'recovered.sqlite');assert.equal(command('backup',[temp.databasePath,backup]).status,0);
    await request(app,'/api/enquiries',{method:'POST',auth:a,json:input('Later original only')});
    assert.equal(command('restore',[backup,restored]).status,0);recovered=await child(restored);
    assert.equal((await request(recovered,'/api/session',{auth:a})).status,401);
    const ra=await login(recovered,accounts[0]),rb=await login(recovered,accounts[1]);
    assert.equal((await request(recovered,'/api/enquiries/'+ea.body.id,{auth:ra})).body.subject,'Snapshot A');
    assert.equal((await request(recovered,'/api/enquiries/'+eb.body.id,{auth:rb})).body.subject,'Snapshot B');
    for(const [auth,id]of [[ra,eb.body.id],[rb,ea.body.id]])assert.equal((await request(recovered,'/api/enquiries/'+id,{auth})).status,404);
    assert.equal((await request(recovered,'/api/enquiries',{auth:ra})).body.total,1);assert.equal((await request(app,'/api/enquiries',{auth:a})).body.total,2);
    assert.notEqual(command('restore',[backup,temp.databasePath]).status,0);assert.notEqual(command('backup',[temp.databasePath,backup]).status,0);
  } finally {await recovered?.close();await app?.close();temp.clean();}
});
test('repeat initialization refuses replacement and startup does not seed an empty database',async()=>{
  const temp=temporary();let app;
  try {
    const {accounts,credentials}=initialized(temp);const first=readFileSync(credentials);
    assert.notEqual(command('init',[temp.databasePath,credentials]).status,0);assert.ok(readFileSync(credentials).equals(first));
    const replacement=join(temp.root,'replacement-credentials.json');assert.notEqual(command('init',[temp.databasePath,replacement]).status,0);assert.ok(!existsSync(replacement));
    const newPath=join(temp.root,'unseeded.sqlite');app=await child(newPath);assert.equal((await request(app,'/api/session')).status,401);
    const check=openDatabase(newPath);assert.equal(check.prepare('SELECT count(*) AS n FROM users').get().n,0);check.close();
    assert.equal((await request(app,'/api/login',{method:'POST',json:{email:accounts[0].email,password:accounts[0].password}})).status,401);
  } finally {await app?.close();temp.clean();}
});
