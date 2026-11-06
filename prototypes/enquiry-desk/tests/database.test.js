import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {temporary, input} from './helpers.js';
import {openDatabase, seedFictional, transaction, backupDatabase, restoreDatabase, checkDatabase, SCHEMA_VERSION} from '../src/database.js';
import {createEnquiry, getEnquiry, updateEnquiry, listEnquiries} from '../src/enquiries.js';
import {tokenHash, randomToken} from '../src/auth.js';
let temp, db, accounts;
before(async () => { temp = temporary(); db = openDatabase(temp.databasePath); accounts = await seedFictional(db); });
after(() => { db.close(); temp.clean(); });
test('migration creates the versioned schema with integrity, foreign keys and private file mode', () => {
  checkDatabase(db); assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1); assert.equal(statSync(temp.databasePath).mode & 0o777, 0o600);
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 2);
});
test('reopening schema is idempotent and initialization refuses to replace accounts', async () => {
  const before = db.prepare('SELECT id,password_hash FROM users ORDER BY id').all();
  const reopened = openDatabase(temp.databasePath); checkDatabase(reopened); reopened.close();
  await assert.rejects(seedFictional(db), /already contains/);
  assert.ok(JSON.stringify(db.prepare('SELECT id,password_hash FROM users ORDER BY id').all()) === JSON.stringify(before));
});
test('database constraints reject cross-business creators, invalid status, empty fields and duplicate identities', () => {
  const [a,b] = accounts;
  assert.throws(() => createEnquiry(db, {userId: a.userId, businessId: b.businessId}, input('Forbidden')));
  const item = createEnquiry(db, a, input('Constraints'));
  assert.throws(() => db.prepare('UPDATE enquiries SET status=? WHERE id=?').run('Admin', item.id));
  assert.throws(() => db.prepare('UPDATE enquiries SET name=? WHERE id=?').run('', item.id));
  assert.throws(() => db.prepare('UPDATE enquiries SET business_id=? WHERE id=?').run(b.businessId, item.id));
  assert.throws(() => db.prepare('INSERT INTO businesses(id,name) VALUES(?,?)').run(a.businessId, 'Duplicate'));
});
test('transaction errors roll back all writes', () => {
  const id = randomUUID(); assert.throws(() => transaction(db, () => { db.prepare('INSERT INTO businesses(id,name) VALUES(?,?)').run(id, 'Temporary'); throw new Error('Abort'); }));
  assert.equal(db.prepare('SELECT count(*) AS n FROM businesses WHERE id=?').get(id).n, 0);
});
test('repository reads and updates enforce tenant predicates in both directions', () => {
  const [a,b] = accounts, first=createEnquiry(db,a,input('A private')),second=createEnquiry(db,b,input('B private'));
  for (const [actor,foreign] of [[a,second],[b,first]]) {
    assert.throws(() => getEnquiry(db,actor,foreign.id), error => error.status === 404);
    assert.throws(() => updateEnquiry(db,actor,foreign.id,{subject:'Forbidden'}), error => error.status === 404);
    assert.ok(!listEnquiries(db,actor).enquiries.some(row=>row.id===foreign.id));
  }
  assert.equal(getEnquiry(db,a,first.id).subject,'A private'); assert.equal(getEnquiry(db,b,second.id).subject,'B private');
});
test('online SQLite backup captures WAL data; restore preserves accounts/records and invalidates sessions', async () => {
  const item = createEnquiry(db,accounts[0],input('Before snapshot'));
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(randomToken()),accounts[0].userId,Date.now()+100000);
  const backup = join(temp.root,'backup.sqlite'), restored = join(temp.root,'restored.sqlite');
  await backupDatabase(db,backup);
  const later = createEnquiry(db,accounts[0],input('After snapshot'));
  await restoreDatabase(backup,restored);
  const copy = openDatabase(restored);
  try { checkDatabase(copy); assert.equal(getEnquiry(copy,accounts[0],item.id).subject,'Before snapshot'); assert.throws(()=>getEnquiry(copy,accounts[0],later.id)); assert.equal(copy.prepare('SELECT count(*) AS n FROM sessions').get().n,0); assert.equal(copy.prepare('SELECT count(*) AS n FROM users').get().n,2); }
  finally {copy.close();}
  assert.equal(getEnquiry(db,accounts[0],later.id).subject,'After snapshot');
});
test('backup and restore refuse to overwrite an existing destination', async () => {
  const destination=join(temp.root,'existing.sqlite'); await backupDatabase(db,destination);
  const existing = openDatabase(destination); const before=existing.prepare('SELECT count(*) AS n FROM enquiries').get().n; existing.close();
  await assert.rejects(backupDatabase(db,destination)); await assert.rejects(restoreDatabase(destination,temp.databasePath));
  const check=openDatabase(destination);assert.equal(check.prepare('SELECT count(*) AS n FROM enquiries').get().n,before);check.close();
});
test('future schemas and foreign databases are rejected without resetting them', async () => {
  const path=join(temp.root,'future.sqlite');await backupDatabase(db,path);const raw=new DatabaseSync(path);raw.exec('PRAGMA user_version=999');raw.close();
  assert.throws(()=>openDatabase(path),/Unsupported/);
  const read=new DatabaseSync(path);assert.equal(read.prepare('PRAGMA user_version').get().user_version,999);read.close();
  const foreign=join(temp.root,'foreign.sqlite'),other=new DatabaseSync(foreign);other.exec('CREATE TABLE other(value TEXT)');other.close();
  assert.throws(()=>openDatabase(foreign),/unrecognised/);
  const markedPath=join(temp.root,'marked.sqlite'),marked=new DatabaseSync(markedPath);marked.exec('PRAGMA application_id=123');marked.close();
  assert.throws(()=>openDatabase(markedPath),/unrecognised/);
  const missing=join(temp.root,'never.sqlite');assert.throws(()=>openDatabase(missing,{readOnly:true}));assert.ok(!existsSync(missing));
});
test('credential persistence failure rolls back account initialization', async () => {
  const path=join(temp.root,'seed-failure.sqlite'),empty=openDatabase(path);
  try { await assert.rejects(seedFictional(empty,()=>{throw new Error('Credential file unavailable');}));assert.equal(empty.prepare('SELECT count(*) AS n FROM users').get().n,0);assert.equal(empty.prepare('SELECT count(*) AS n FROM businesses').get().n,0); }
  finally {empty.close();}
});
