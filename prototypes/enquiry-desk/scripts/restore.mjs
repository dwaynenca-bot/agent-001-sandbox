import {restoreDatabase} from '../src/database.js';
process.umask(0o077);
const [source, destination, ...extra] = process.argv.slice(2);
if (!source || !destination || extra.length) throw new Error('Usage: npm run restore -- BACKUP_PATH NEW_DB_PATH');
await restoreDatabase(source, destination);
console.log('Restored to a new database; all restored sessions invalidated. Original and backup were preserved.');
