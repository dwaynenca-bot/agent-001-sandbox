import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {openDatabase, transaction} from './database.js';
import {HttpError, loginInput, listInput} from './validation.js';
import {randomToken, tokenHash, csrfFor, equalToken, verifyPassword, cookieToken, sessionCookie, SESSION_MS} from './auth.js';
import {createEnquiry, getEnquiry, listEnquiries, updateEnquiry} from './enquiries.js';
const BODY_LIMIT = 16384;
function jsonBody(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) { req.resume(); throw new HttpError(415, 'Use application/json'); }
  if (Number(req.headers['content-length']) > BODY_LIMIT) { req.resume(); throw new HttpError(413, 'Request body too large'); }
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) { chunks = []; if (!rejected) { rejected = true; reject(new HttpError(413, 'Request body too large')); } }
      else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)))); }
      catch { reject(new HttpError(400, 'Invalid JSON body')); }
    });
    req.on('error', () => reject(new HttpError(400, 'Could not read request body')));
  });
}
export async function startServer({databasePath, port = 0, clock = Date.now, onError = () => console.error('Enquiry Desk request failed')} = {}) {
  if (!databasePath) throw new TypeError('databasePath is required');
  const db = openDatabase(databasePath);
  let origin, loginInFlight = 0;
  const failures = new Map();
  function send(res, status, data) { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(data === undefined ? undefined : JSON.stringify(data)); }
  function requireOrigin(req) {
    if (req.headers.origin !== origin || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) throw new HttpError(403, 'Request origin not allowed');
  }
  function session(req) {
    const token = cookieToken(req.headers.cookie);
    if (!token) throw new HttpError(401, 'Authentication required');
    const actor = db.prepare('SELECT u.id AS userId,u.business_id AS businessId,u.email,b.name AS businessName,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id JOIN businesses b ON b.id=u.business_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token), clock());
    if (!actor) throw new HttpError(401, 'Authentication required');
    return {token, actor};
  }
  function viewSession(actor, token) { return {user: {email: actor.email, businessName: actor.businessName}, csrfToken: csrfFor(token), expiresAt: actor.expiresAt}; }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      if (req.headers.host !== new URL(origin).host) throw new HttpError(403, 'Request host not allowed');
      const url = new URL(req.url, origin);
      if (url.origin !== origin) throw new HttpError(403, 'Request origin not allowed');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/' && !url.search) {
        const page = await readFile(new URL('../public/index.html', import.meta.url));
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(page); return;
      }
      if (!path.startsWith('/api/')) throw new HttpError(404, 'Route not found');
      if (req.method === 'POST' && path === '/api/login' && !url.search) {
        requireOrigin(req); const input = loginInput(await jsonBody(req)), key = req.socket.remoteAddress;
        const now = clock(), state = failures.get(key);
        if ((state && state.until > now && state.count >= 5) || loginInFlight >= 2) { res.setHeader('Retry-After', '60'); throw new HttpError(429, 'Too many login attempts; try again later'); }
        if (failures.size > 1000) for (const [key, entry] of failures) if (entry.until <= now) failures.delete(key);
        const count = state && state.until > now ? state.count : 0;
        failures.set(key, {count: count + 1, until: now + 60000});
        loginInFlight++;
        let user, valid;
        try {
          user = db.prepare('SELECT id,password_hash FROM users WHERE email=? COLLATE NOCASE').get(input.email);
          valid = await verifyPassword(input.password, user?.password_hash);
        } finally { loginInFlight--; }
        if (!valid) throw new HttpError(401, 'Invalid email or password');
        failures.delete(key);
        const token = randomToken(), expiresAt = clock() + SESSION_MS, previous = cookieToken(req.headers.cookie);
        transaction(db, () => {
          db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(clock());
          if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(previous));
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), user.id, expiresAt);
        });
        res.setHeader('Set-Cookie', sessionCookie(token));
        const actor = db.prepare('SELECT u.email,b.name AS businessName FROM users u JOIN businesses b ON b.id=u.business_id WHERE u.id=?').get(user.id);
        send(res, 200, viewSession({...actor, expiresAt}, token)); return;
      }
      const {actor, token} = session(req);
      if (!['GET', 'HEAD'].includes(req.method)) {
        requireOrigin(req);
        if (!equalToken(req.headers['x-csrf-token'], csrfFor(token))) throw new HttpError(403, 'CSRF verification failed');
      }
      if (req.method === 'GET' && path === '/api/session' && !url.search) { send(res, 200, viewSession(actor, token)); return; }
      if (req.method === 'POST' && path === '/api/logout' && !url.search) {
        db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token)); res.setHeader('Set-Cookie', sessionCookie('', {clear: true})); send(res, 204); return;
      }
      if (path === '/api/enquiries') {
        if (req.method === 'GET') { send(res, 200, listEnquiries(db, actor, listInput(url.searchParams))); return; }
        if (req.method === 'POST' && !url.search) { const item = createEnquiry(db, actor, await jsonBody(req), clock()); res.setHeader('Location', `/api/enquiries/${item.id}`); send(res, 201, item); return; }
      }
      const match = /^\/api\/enquiries\/([^/]+)$/.exec(path);
      if (match && !url.search) {
        if (req.method === 'GET') { send(res, 200, getEnquiry(db, actor, match[1])); return; }
        if (req.method === 'PATCH') { send(res, 200, updateEnquiry(db, actor, match[1], await jsonBody(req), clock())); return; }
      }
      throw new HttpError(404, 'Route not found');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) { try { onError(); } catch {} }
      if (!res.headersSent) send(res, status, {error: status === 500 ? 'Internal server error' : error.message});
      else res.end();
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 50;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  catch (error) { db.close(); throw error; }
  origin = `http://127.0.0.1:${server.address().port}`;
  return {origin, db, server, async close() { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); db.close(); }};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const port = Number(process.env.PORT || 4180);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const app = await startServer({databasePath: resolve(process.env.ENQUIRY_DB || 'var/enquiry-desk.sqlite'), port});
  console.log(JSON.stringify({event: 'listening', origin: app.origin}));
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (closing) return; closing = true; await app.close(); process.exit(0); });
}
