export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = message => { throw new HttpError(400, message); };
export const STATUSES = ['New', 'In progress', 'Closed'];
export function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) bad('Invalid request fields');
}
export function email(value) {
  if (typeof value !== 'string' || value.length > 200 || (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) bad('Invalid email address');
  return value.trim().toLowerCase();
}
export function loginInput(value) {
  object(value, ['email', 'password']);
  const normalized = email(value.email);
  if (!normalized || typeof value.password !== 'string' || value.password.length < 16 || Buffer.byteLength(value.password) > 256) bad('Invalid login fields');
  return {email: normalized, password: value.password};
}
export function enquiryInput(value, patch = false) {
  object(value, ['name', 'email', 'subject', 'message', 'status']);
  if (patch && !Object.keys(value).length) bad('Provide at least one field to update');
  const result = {};
  for (const [key, max] of [['name', 200], ['subject', 200], ['message', 4000]]) {
    if (patch && !Object.hasOwn(value, key)) continue;
    const text = Object.hasOwn(value, key) ? value[key] : (key === 'message' ? '' : undefined);
    if (typeof text !== 'string' || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || (key !== 'message' && !text.trim())) bad(`Invalid ${key}`);
    result[key] = text.trim();
  }
  if (!patch || Object.hasOwn(value, 'email')) result.email = email(Object.hasOwn(value, 'email') ? value.email : '');
  if (!patch || Object.hasOwn(value, 'status')) {
    const status = Object.hasOwn(value, 'status') ? value.status : 'New';
    if (!STATUSES.includes(status)) bad('Invalid status');
    result.status = status;
  }
  return result;
}
export function listInput(params) {
  const seen = new Set();
  for (const [key] of params) {
    if (!['limit', 'offset', 'status'].includes(key) || seen.has(key)) bad('Invalid query fields');
    seen.add(key);
  }
  const number = (name, fallback, min, max) => {
    const value = params.get(name); if (value === null) return fallback;
    if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) bad(`Invalid ${name}`);
    return Number(value);
  };
  const status = params.get('status'); if (status !== null && !STATUSES.includes(status)) bad('Invalid status');
  return {limit: number('limit', 25, 1, 50), offset: number('offset', 0, 0, 10000), status};
}
export const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
