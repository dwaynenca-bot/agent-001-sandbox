import {openDatabase, backupDatabase} from '../src/database.js';
process.umask(0o077);
const [source, destination, ...extra] = process.argv.slice(2);
if (!source || !destination || extra.length) throw new Error('Usage: npm run backup -- SOURCE_DB NEW_BACKUP_PATH');
const db = openDatabase(source, {readOnly: true});
try { await backupDatabase(db, destination); console.log('Consistent database backup created.'); }
finally { db.close(); }
