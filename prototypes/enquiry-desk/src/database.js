import {DatabaseSync, backup} from 'node:sqlite';
import {mkdirSync, existsSync, lstatSync, chmodSync, openSync, closeSync, unlinkSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {randomUUID, randomBytes} from 'node:crypto';
import {hashPassword} from './auth.js';
const APPLICATION_ID = 0x45445131;
export const SCHEMA_VERSION = 1;
export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
function identity(db) {
  if (db.prepare('PRAGMA application_id').get().application_id !== APPLICATION_ID || db.prepare('PRAGMA user_version').get().user_version !== SCHEMA_VERSION) throw new Error('Unsupported database identity or schema version');
}
export function checkDatabase(db) {
  identity(db);
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Database integrity check failed');
}
export function openDatabase(filename, {readOnly = false} = {}) {
  filename = resolve(filename);
  if (existsSync(filename) && (!lstatSync(filename).isFile() || lstatSync(filename).isSymbolicLink())) throw new Error('Database must be a regular file');
  if (readOnly && !existsSync(filename)) throw new Error('Database does not exist');
  if (!readOnly) mkdirSync(dirname(filename), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(filename, {readOnly});
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    if (!readOnly) {
      chmodSync(filename, 0o600);
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version === 0) {
        if (db.prepare('PRAGMA application_id').get().application_id !== 0 || db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length) throw new Error('Refusing to migrate an unrecognised database');
        transaction(db, () => db.exec(`
          CREATE TABLE businesses(id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200)) STRICT;
          CREATE TABLE users(id TEXT PRIMARY KEY NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id), email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(email) BETWEEN 3 AND 200), password_hash TEXT NOT NULL, UNIQUE(id,business_id)) STRICT;
          CREATE TABLE sessions(token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash)=64), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL CHECK(expires_at>0)) STRICT;
          CREATE INDEX sessions_expiry ON sessions(expires_at);
          CREATE TABLE enquiries(id TEXT PRIMARY KEY NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id), created_by TEXT NOT NULL, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200), email TEXT NOT NULL DEFAULT '' CHECK(length(email)<=200), subject TEXT NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 200), message TEXT NOT NULL DEFAULT '' CHECK(length(message)<=4000), status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New','In progress','Closed')), created_at INTEGER NOT NULL CHECK(created_at>=0), updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), FOREIGN KEY(created_by,business_id) REFERENCES users(id,business_id)) STRICT;
          CREATE INDEX enquiries_business_created ON enquiries(business_id,created_at DESC,id DESC);
          PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${SCHEMA_VERSION};
        `));
      }
      identity(db);
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    } else identity(db);
    return db;
  } catch (error) { db.close(); throw error; }
}
export async function seedFictional(db, persistCredentials = () => {}) {
  if (db.prepare('SELECT count(*) AS n FROM users').get().n || db.prepare('SELECT count(*) AS n FROM businesses').get().n) throw new Error('Initialization refused: database already contains accounts');
  const accounts = [];
  for (const [name, email] of [['Orchard Studio (fictional)', 'owner@orchard.example'], ['Lantern Workshop (fictional)', 'owner@lantern.example']]) {
    const password = randomBytes(24).toString('base64url');
    accounts.push({businessId: randomUUID(), userId: randomUUID(), business: name, email, password, passwordHash: await hashPassword(password)});
  }
  transaction(db, () => {
    if (db.prepare('SELECT count(*) AS n FROM businesses').get().n) throw new Error('Initialization refused: database already contains accounts');
    for (const a of accounts) {
      db.prepare('INSERT INTO businesses(id,name) VALUES(?,?)').run(a.businessId, a.business);
      db.prepare('INSERT INTO users(id,business_id,email,password_hash) VALUES(?,?,?,?)').run(a.userId, a.businessId, a.email, a.passwordHash);
    }
    persistCredentials(accounts.map(({email, password, business}) => ({email, password, business})));
  });
  return accounts;
}
async function newBackup(db, destination) {
  destination = resolve(destination);
  mkdirSync(dirname(destination), {recursive: true, mode: 0o700});
  // Reserve an exclusive file; never overwrite an existing backup or database.
  const fd = openSync(destination, 'wx', 0o600); closeSync(fd);
  try { await backup(db, destination); chmodSync(destination, 0o600); }
  catch (error) { unlinkSync(destination); throw error; }
  return destination;
}
export async function backupDatabase(db, destination) { checkDatabase(db); return newBackup(db, destination); }
export async function restoreDatabase(source, destination) {
  const sourceDb = openDatabase(source, {readOnly: true});
  try {
    checkDatabase(sourceDb); await newBackup(sourceDb, destination);
    const restored = openDatabase(destination);
    try { transaction(restored, () => restored.prepare('DELETE FROM sessions').run()); checkDatabase(restored); }
    finally { restored.close(); }
    return resolve(destination);
  } finally { sourceDb.close(); }
}
