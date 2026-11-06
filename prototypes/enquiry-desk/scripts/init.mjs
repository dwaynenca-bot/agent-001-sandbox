import {openSync, writeFileSync, fsyncSync, closeSync, unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase, seedFictional} from '../src/database.js';
process.umask(0o077);
const [database, credentials, ...extra] = process.argv.slice(2);
if (!database || !credentials || extra.length || resolve(database) === resolve(credentials)) throw new Error('Usage: npm run init -- DB_PATH NEW_PRIVATE_CREDENTIALS_PATH');
// Both paths are explicit. Refuse existing credential files; never print passwords.
const fd = openSync(resolve(credentials), 'wx', 0o600);
let db, completed = false;
try {
  db = openDatabase(database);
  await seedFictional(db, accounts => { writeFileSync(fd, JSON.stringify(accounts, null, 2) + '\n'); fsyncSync(fd); });
  completed = true;
  console.log('Initialized two fictional accounts. Credentials are in the specified private file; they were not printed.');
} finally { db?.close(); closeSync(fd); if (!completed) unlinkSync(resolve(credentials)); }
