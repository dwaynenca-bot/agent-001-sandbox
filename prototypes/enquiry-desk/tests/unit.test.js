import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {hashPassword, verifyPassword, randomToken, tokenHash, csrfFor, equalToken, cookieToken, sessionCookie, SCRYPT} from '../src/auth.js';
import {loginInput, enquiryInput, listInput, validId} from '../src/validation.js';
let password, hash;
const wrong = () => randomBytes(24).toString('base64url');
before(async () => { password = wrong(); hash = await hashPassword(password); });
test('scrypt uses documented work factor, random salt and a 64-byte derived key', async () => {
  assert.equal(SCRYPT.N, 131072); assert.equal(SCRYPT.r, 8); assert.equal(SCRYPT.p, 1);
  assert.ok(/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash));
  const second = await hashPassword(password); assert.ok(hash !== second); assert.ok(!hash.includes(password));
});
test('correct passwords authenticate, wrong and unknown users do not', async () => {
  assert.ok(await verifyPassword(password, hash)); assert.ok(!await verifyPassword(wrong(), hash)); assert.ok(!await verifyPassword(password, null));
});
test('malformed password inputs and unsupported stored work factors fail closed', async () => {
  await assert.rejects(hashPassword('short'));
  await assert.rejects(hashPassword('a'.repeat(257)));
  assert.ok(!await verifyPassword(null, hash));
  assert.ok(!await verifyPassword(password, hash.replace('131072', '1')));
});
test('session tokens have 256 bits, are independent, and domain-separate CSRF values', () => {
  const a = randomToken(), b = randomToken(); assert.match(a, /^[a-f0-9]{64}$/); assert.ok(a !== b);
  assert.ok(tokenHash(a) !== a); assert.ok(csrfFor(a) !== tokenHash(a)); assert.ok(equalToken(csrfFor(a), csrfFor(a))); assert.ok(!equalToken(csrfFor(a), csrfFor(b)));
  for (const invalid of [null, '', '0', ['x'], 'g'.repeat(64)]) assert.ok(!equalToken(invalid, csrfFor(a)));
});
test('cookies are HttpOnly/Strict; HTTPS requires Secure; logout clears the cookie', () => {
  const token = randomToken(), local = sessionCookie(token);
  assert.ok(local.includes('HttpOnly')); assert.ok(local.includes('SameSite=Strict')); assert.ok(!local.includes('Secure'));
  assert.ok(sessionCookie(token, {protocol: 'https:'}).includes('; Secure'));
  assert.ok(sessionCookie('', {clear: true}).includes('Max-Age=0')); assert.throws(() => sessionCookie(token, {protocol: 'ftp:'}));
});
test('ambiguous, malformed or missing session cookies are rejected', () => {
  const token = randomToken(); assert.ok(cookieToken('other=1; ed_session='+token) === token);
  for (const value of ['', 'ed_session=x', 'ed_session='+token+'; ed_session='+token, 'ed_session='+'g'.repeat(64)]) assert.equal(cookieToken(value), null);
});
test('login fields are allowlisted and bounded', () => {
  assert.equal(loginInput({email: 'OWNER@ORCHARD.EXAMPLE', password}).email, 'owner@orchard.example');
  for (const value of [null, [], {}, {email: 'bad', password}, {email: 'a@b.example', password: 'short'}, {email: 'a@b.example', password, businessId: 'forged'}]) assert.throws(() => loginInput(value));
});
test('enquiry validation permits only bounded business fields and known statuses', () => {
  assert.deepEqual(enquiryInput({name: ' Fictional ', subject: ' Hello '}), {name: 'Fictional', subject: 'Hello', message: '', email: '', status: 'New'});
  assert.deepEqual(enquiryInput({status: 'Closed'}, true), {status: 'Closed'});
  for (const value of [null, [], {}, {name: '', subject: 'x'}, {name: 'x', subject: 'x', email: 'bad'}, {name: 'x', subject: 'x', message: 'x'.repeat(4001)}, {name: 'x', subject: 'x', status: 'Admin'}, {name: 'x', subject: 'x', business_id: 'other'}, {name: 'x', subject: 'x', created_by: 'other'}, {name: 'x\0', subject: 'x'}]) assert.throws(() => enquiryInput(value));
  assert.throws(() => enquiryInput({}, true));
  for (const key of ['name', 'subject', 'message', 'email', 'status']) assert.throws(() => enquiryInput({[key]: null}, true));
});
test('pagination/status filters reject injected or duplicate query fields', () => {
  assert.deepEqual(listInput(new URLSearchParams()), {limit: 25, offset: 0, status: null});
  assert.deepEqual(listInput(new URLSearchParams('limit=2&offset=1&status=Closed')), {limit: 2, offset: 1, status: 'Closed'});
  for (const query of ['limit=0', 'limit=51', 'offset=-1', 'offset=10001', 'limit=1e2', 'limit=1&limit=2', 'businessId=other', 'status=Unknown']) assert.throws(() => listInput(new URLSearchParams(query)));
});
test('malformed record identifiers are not accepted as database identities', () => {
  for (const value of [null, '', '../db', "' OR 1=1 --", '0'.repeat(36)]) assert.ok(!validId(value));
});
