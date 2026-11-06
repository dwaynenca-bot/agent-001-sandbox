import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {fixture, input} from './helpers.js';
import {startServer} from '../src/server.js';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.ENQUIRY_PLAYWRIGHT_PATH || 'playwright');
const evidence = process.env.ENQUIRY_BROWSER_EVIDENCE;
if(evidence)mkdirSync(evidence,{recursive:true,mode:0o700});
async function browserFixture(width,run) {
  const f=await fixture();let browser;
  const errors=[],external=[];
  try {
    browser=await chromium.launch({executablePath:process.env.ENQUIRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    async function pageIn(context) {
      const page=await context.newPage();
      page.on('pageerror',()=>errors.push('Uncaught browser error'));
      page.on('request',r=>{if(!r.url().startsWith(f.app.origin+'/'))external.push('Non-local request');});
      page.on('dialog',dialog=>dialog.accept());
      await page.goto(f.app.origin);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');return page;
    }
    const context=await browser.newContext({viewport:{width,height:950}}),page=await pageIn(context);
    await run({f,browser,context,page,pageIn,width});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(f.errors,[]);
  } finally {await browser?.close();await f.app.close();f.clean();}
}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const fill=(page,label,value)=>page.getByLabel(label,{exact:true}).fill(value);
async function signIn(page,account) {
  // Never let a runner call log disclose a randomly generated password if a step fails.
  try {await fill(page,'Email',account.email);await fill(page,'Password',account.password);await button(page,'Sign in').click();await page.locator('#app-panel').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#list-status').textContent.includes('Loading'));}
  catch {throw new Error('Browser sign-in did not complete; credentials omitted');}
}
async function save(page,subject) {
  await fill(page,'Contact name','Fictional contact');await fill(page,'Contact email Optional','contact@example.invalid');await fill(page,'Subject',subject);await fill(page,'Message Optional','Fictional message');await button(page,'Save enquiry').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Enquiry saved'));
  return page.locator('.enquiry-button').filter({has:page.locator('strong',{hasText:subject})}).first().getAttribute('data-id');
}
async function session(context,origin) {const r=await context.request.get(origin+'/api/session');assert.equal(r.status(),200);return r.json();}
for(const width of [1440,375]) {
  test(`login, enquiry create/edit/filter/reopen and logout at ${width}px`,async()=>browserFixture(width,async({f,page,context})=>{
    await signIn(page,f.accounts[0]);assert.equal(await page.locator('#business-name').textContent(),f.accounts[0].business);
    const id=await save(page,'Fictional garden appointment');assert.ok(id);
    await page.getByLabel('Status',{exact:true}).selectOption('In progress');await fill(page,'Message Optional','Updated fictional message');await button(page,'Save enquiry').click();
    await page.waitForFunction(()=>document.querySelector('#edit-state').textContent==='Saved');
    await page.reload();await page.locator('.enquiry-button').first().waitFor();await page.locator('.enquiry-button').first().click();
    await page.waitForFunction(()=>document.querySelector('#enquiry-form textarea').value==='Updated fictional message');
    assert.equal(await page.getByLabel('Message Optional',{exact:true}).inputValue(),'Updated fictional message');assert.equal(await page.getByLabel('Status',{exact:true}).inputValue(),'In progress');
    await page.getByLabel('Filter enquiries',{exact:true}).selectOption('Closed');await page.waitForFunction(()=>document.querySelector('#page-summary').textContent==='0 enquiries');assert.equal(await page.locator('.enquiry-button').count(),0);
    await page.getByLabel('Filter enquiries',{exact:true}).selectOption('In progress');await page.locator('.enquiry-button').first().waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const b of await page.getByRole('button').all()){const box=await b.boundingBox();if(box)assert.ok(box.height>=44);}
    if(evidence)await page.screenshot({path:`${evidence}/workspace-${width}.png`,fullPage:true});
    await button(page,'Sign out').click();await page.locator('#login-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#enquiry-list').textContent(),'');assert.equal(await page.locator('#enquiry-form input[name=subject]').inputValue(),'');
    assert.equal((await context.request.get(f.app.origin+'/api/session')).status(),401);
  }));
  test(`independent browser contexts enforce two-business isolation in both directions at ${width}px`,async()=>browserFixture(width,async({f,page,browser,context,pageIn})=>{
    const secondContext=await browser.newContext({viewport:{width,height:950}}),other=await pageIn(secondContext);
    await signIn(page,f.accounts[0]);await signIn(other,f.accounts[1]);
    const aId=await save(page,'Orchard confidential fictional'),bId=await save(other,'Lantern confidential fictional');
    assert.ok(!(await page.locator('#enquiry-list').textContent()).includes('Lantern'));assert.ok(!(await other.locator('#enquiry-list').textContent()).includes('Orchard'));
    for(const [ctx,foreign]of [[context,bId],[secondContext,aId]]){
      const s=await session(ctx,f.app.origin),headers={Origin:f.app.origin,'X-CSRF-Token':s.csrfToken};
      for(const method of ['get','patch']) {
        const opts=method==='patch'?{headers,data:{subject:'Forbidden browser edit'}}:{};
        const cross=await ctx.request[method](f.app.origin+'/api/enquiries/'+foreign,opts),unknown=await ctx.request[method](f.app.origin+'/api/enquiries/'+randomUUID(),opts);
        assert.equal(cross.status(),404);assert.equal(unknown.status(),404);assert.deepEqual(await cross.json(),await unknown.json());
      }
      assert.equal((await ctx.request.post(f.app.origin+'/api/enquiries',{headers,data:{...input('Forged owner'),businessId:'other'}})).status(),400);
      assert.equal((await ctx.request.post(f.app.origin+'/api/enquiries',{data:input('CSRF attempt')})).status(),403);
      assert.ok(!await (ctx===context?page:other).evaluate(()=>document.cookie.includes('ed_session')));
      const cookies=await ctx.cookies();assert.ok(cookies.some(c=>c.name==='ed_session'&&c.httpOnly&&c.sameSite==='Strict'));
    }
    await button(page,'Refresh').click();await button(other,'Refresh').click();
    await page.waitForFunction(()=>!document.querySelector('#list-status').textContent.includes('Loading'));
    assert.ok((await page.locator('#enquiry-list').textContent()).includes('Orchard confidential fictional'));
    assert.ok((await other.locator('#enquiry-list').textContent()).includes('Lantern confidential fictional'));
    await button(page,'Sign out').click();await signIn(page,f.accounts[1]);
    assert.equal(await page.locator('#enquiry-form input[name=subject]').inputValue(),'');assert.ok(!(await page.locator('#enquiry-list').textContent()).includes('Orchard'));
    assert.equal(await page.locator('#business-name').textContent(),f.accounts[1].business);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  }));
}
test('failed API save retains edits, reports failure and succeeds on explicit retry',async()=>browserFixture(375,async({f,page})=>{
  await signIn(page,f.accounts[0]);await fill(page,'Contact name','Fictional failure');await fill(page,'Subject','Retained unsaved enquiry');
  await page.route('**/api/enquiries',async route=>{if(route.request().method()==='POST')await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Internal server error'})});else await route.continue();});
  await button(page,'Save enquiry').click();await page.getByRole('alert').filter({hasText:'Could not save enquiry'}).waitFor();assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'Retained unsaved enquiry');assert.equal(await page.locator('#edit-state').textContent(),'Unsaved changes');
  assert.ok(!(await page.locator('#notice').textContent()).includes('saved'));
  await page.unroute('**/api/enquiries');await button(page,'Save enquiry').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Enquiry saved'));assert.equal(await page.locator('.enquiry-button').count(),1);
}));
test('session expiry scrubs old business data and logout failure does not falsely claim sign-out',async()=>browserFixture(375,async({f,page})=>{
  await signIn(page,f.accounts[0]);await save(page,'Old business private fictional');
  await page.route('**/api/logout',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Internal server error'})}));
  await button(page,'Sign out').click();await page.getByRole('alert').filter({hasText:'Could not sign out'}).waitFor();assert.ok(await page.locator('#app-panel').isVisible());
  await page.unroute('**/api/logout');
  f.app.db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').run(f.time.now-1,f.accounts[0].userId);
  await button(page,'Refresh').click();await page.locator('#login-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#enquiry-list').textContent(),'');assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'');
  await signIn(page,f.accounts[1]);assert.equal(await page.locator('.enquiry-button').count(),0);assert.ok(!(await page.locator('#app-panel').textContent()).includes('Old business private fictional'));
}));
test('a delayed prior-business response cannot repopulate the workspace after logout and another login',async()=>browserFixture(1440,async({f,page})=>{
  await signIn(page,f.accounts[0]);await save(page,'Delayed Orchard private fictional');
  let release,ready;const gate=new Promise(resolve=>{release=resolve;}),captured=new Promise(resolve=>{ready=resolve;});let held=false;
  await page.route('**/api/enquiries?*',async route=>{
    if(held){await route.continue();return;}held=true;const response=await route.fetch();ready();await gate;await route.fulfill({response});
  });
  await button(page,'Refresh').click();await captured;await button(page,'Sign out').click();await signIn(page,f.accounts[1]);const released=page.waitForResponse(response=>response.url().includes('/api/enquiries?'));release();await (await released).finished();
  assert.equal(await page.locator('.enquiry-button').count(),0);assert.ok(!(await page.locator('#app-panel').textContent()).includes('Delayed Orchard'));assert.equal(await page.locator('#business-name').textContent(),f.accounts[1].business);
}));
test('pagination and status filters operate on server records at 375px',async()=>browserFixture(375,async({f,page,context})=>{
  await signIn(page,f.accounts[0]);const s=await session(context,f.app.origin),headers={Origin:f.app.origin,'X-CSRF-Token':s.csrfToken};
  for(let i=0;i<26;i++){const r=await context.request.post(f.app.origin+'/api/enquiries',{headers,data:{...input('Fictional record '+i),status:i===25?'Closed':'New'}});assert.equal(r.status(),201);}
  await button(page,'Refresh').click();await page.waitForFunction(()=>document.querySelector('#page-summary').textContent==='1–25 of 26');assert.equal(await page.locator('.enquiry-button').count(),25);
  await button(page,'Next').click();await page.waitForFunction(()=>document.querySelector('#page-summary').textContent==='26–26 of 26');assert.equal(await page.locator('.enquiry-button').count(),1);
  await button(page,'Previous').click();await page.waitForFunction(()=>document.querySelector('#page-summary').textContent==='1–25 of 26');
  await page.getByLabel('Filter enquiries',{exact:true}).selectOption('Closed');await page.waitForFunction(()=>document.querySelector('#page-summary').textContent==='1–1 of 1');assert.equal(await page.locator('.enquiry-button').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}));
test('browser login/session and saved enquiry survive a real backend restart',async()=>browserFixture(1440,async({f,page})=>{
  await signIn(page,f.accounts[0]);await save(page,'Restart-persistent fictional enquiry');const port=Number(new URL(f.app.origin).port);
  await f.app.close();f.app=await startServer({databasePath:f.databasePath,port,onError:()=>f.errors.push('generic')});
  await page.reload();await page.locator('.enquiry-button').first().waitFor();assert.equal(await page.locator('#business-name').textContent(),f.accounts[0].business);
  await page.locator('.enquiry-button').first().click();await page.waitForFunction(()=>document.querySelector('#enquiry-form input[name=subject]').value==='Restart-persistent fictional enquiry');assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'Restart-persistent fictional enquiry');
}));
test('stored script-like text renders safely in the actual browser and survives reopening',async()=>browserFixture(375,async({f,page})=>{
  await signIn(page,f.accounts[0]);const text='<img src=x onerror="window.injected=true">';await fill(page,'Contact name',text);await fill(page,'Subject','<script>window.injected=true</script>');await fill(page,'Message Optional',text);await button(page,'Save enquiry').click();
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Enquiry saved'));await page.reload();await page.locator('.enquiry-button').first().waitFor();await page.locator('.enquiry-button').first().click();
  await page.waitForFunction(expected=>document.querySelector('#enquiry-form input[name=name]').value===expected,text);assert.equal(await page.getByLabel('Contact name',{exact:true}).inputValue(),text);assert.equal(await page.locator('#enquiry-list img,#enquiry-list script').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}));
test('unsaved cancellation, field validation and keyboard navigation work without losing edits',async()=>browserFixture(375,async({f,page,context})=>{
  await signIn(page,f.accounts[0]);await save(page,'Saved fictional enquiry');await fill(page,'Subject','Unsaved fictional edit');
  page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.dismiss());await button(page,'New enquiry').click();assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'Unsaved fictional edit');
  await button(page,'Sign out').click();assert.ok(await page.locator('#app-panel').isVisible());
  page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());await button(page,'Discard edits').click();assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'Saved fictional enquiry');
  await page.getByLabel('Contact name',{exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.name),'email');
  await fill(page,'Contact email Optional','invalid');await button(page,'Save enquiry').click();assert.ok(!await page.getByLabel('Contact email Optional',{exact:true}).evaluate(el=>el.validity.valid));
  assert.equal((await session(context,f.app.origin)).user.businessName,f.accounts[0].business);
}));
test('a failed browser login is generic, clears the password and permits a valid retry',async()=>browserFixture(375,async({f,page})=>{
  await fill(page,'Email',f.accounts[0].email);
  try {await fill(page,'Password',randomUUID()+randomUUID());} catch {throw new Error('Could not enter test password; value omitted');}
  await button(page,'Sign in').click();await page.getByRole('alert').filter({hasText:'Invalid email or password'}).waitFor();
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');assert.ok(await page.locator('#login-panel').isVisible());
  await signIn(page,f.accounts[0]);assert.equal(await page.locator('#business-name').textContent(),f.accounts[0].business);
}));
