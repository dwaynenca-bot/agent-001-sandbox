import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase, seedFictional} from '../src/database.js';
import {startServer} from '../src/server.js';
export function temporary() {
  const parent = process.env.ENQUIRY_TEST_ROOT || tmpdir(); mkdirSync(parent, {recursive: true, mode: 0o700});
  const root = mkdtempSync(join(parent, 'enquiry-desk-'));
  return {root, databasePath: join(root, 'desk.sqlite'), clean: () => rmSync(root, {recursive: true, force: true})};
}
export async function fixture() {
  const temp = temporary(), db = openDatabase(temp.databasePath);
  const accounts = await seedFictional(db); db.close();
  const time = {now: Date.now()}, errors = [];
  const app = await startServer({databasePath: temp.databasePath, clock: () => time.now, onError: () => errors.push('generic request failure')});
  return {...temp, app, accounts, time, errors, async close() { await app.close(); temp.clean(); }};
}
export async function request(app, path, {method = 'GET', auth, json, raw, headers = {}} = {}) {
  const h = {};
  if (!['GET', 'HEAD'].includes(method)) h.origin = app.origin;
  if (auth) { h.cookie = auth.cookie; h['x-csrf-token'] = auth.csrf; }
  if (json !== undefined || raw !== undefined) h['content-type'] = 'application/json';
  Object.assign(h, headers); for (const [key, value] of Object.entries(h)) if (value === null) delete h[key];
  const response = await fetch(app.origin + path, {method, headers: h, body: json !== undefined ? JSON.stringify(json) : raw, redirect: 'manual'});
  const text = await response.text();
  return {status: response.status, body: text ? JSON.parse(text) : undefined, headers: response.headers};
}
export async function login(app, account, previous) {
  const r = await request(app, '/api/login', {method: 'POST', auth: previous, json: {email: account.email, password: account.password}});
  if (r.status !== 200) throw new Error('Test login failed, HTTP '+r.status);
  return {cookie: r.headers.get('set-cookie').split(';')[0], csrf: r.body.csrfToken, body: r.body, header: r.headers.get('set-cookie')};
}
export const input = subject => ({name: 'Fictional contact', email: 'contact@example.invalid', subject, message: 'Fictional training enquiry only.'});
