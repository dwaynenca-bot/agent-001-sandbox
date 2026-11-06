import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCallback);
export const SCRYPT = Object.freeze({N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024});
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const COOKIE = 'ed_session';
export const randomToken = () => randomBytes(32).toString('hex');
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const csrfFor = token => createHash('sha256').update('enquiry-desk-csrf\0' + token).digest('hex');
export function equalToken(a, b) {
  return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
function validPassword(password) { return typeof password === 'string' && password.length >= 16 && Buffer.byteLength(password) <= 256; }
export async function hashPassword(password) {
  if (!validPassword(password)) throw new TypeError('Password must have at least 16 characters and at most 256 UTF-8 bytes');
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${derived.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (!validPassword(password)) return false;
  const match = typeof encoded === 'string' && /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  // Unknown accounts consume the same work factor without a reusable dummy credential.
  const salt = match ? Buffer.from(match[1], 'hex') : randomBytes(16);
  const derived = await scrypt(password, salt, 64, SCRYPT);
  return !!match && timingSafeEqual(derived, Buffer.from(match[2], 'hex'));
}
export function cookieToken(header = '') {
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(token, {protocol = 'http:', clear = false} = {}) {
  if (!['http:', 'https:'].includes(protocol)) throw new TypeError('Unsupported cookie protocol');
  return `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_MS / 1000}${protocol === 'https:' ? '; Secure' : ''}`;
}
