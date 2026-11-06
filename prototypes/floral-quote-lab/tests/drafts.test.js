import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDraft, validateDraft, listDrafts, saveDraft, fictionalExample, STORAGE_KEY} from '../src/drafts.js';
import {calculateQuote} from '../src/domain.js';
function storage() { const values = new Map(); return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}; }
test('draft schema is versioned and optional enquiry fields may be blank', () => { assert.equal(validateDraft(createDraft()).quote.currency, 'GBP'); });
test('save/reopen preserves exact enquiry, quotation and independent identities', () => {
  const s = storage(), first = fictionalExample('wedding'), second = fictionalExample('celebration');
  first.enquiry.email = 'alex@example.invalid'; first.enquiry.phone = 'fictional'; first.enquiry.eventDate = '2028-02-29';
  saveDraft(s, first); saveDraft(s, second);
  assert.deepEqual(listDrafts(s), [first, second]); assert.notEqual(first.id, second.id);
  const copy = listDrafts(s); copy[0].enquiry.name = 'Changed outside storage'; assert.notEqual(listDrafts(s)[0].enquiry.name, copy[0].enquiry.name);
});
test('saving an edit updates only the matching draft', () => {
  const s = storage(), a = fictionalExample(), b = fictionalExample('celebration'); saveDraft(s, a); saveDraft(s, b);
  a.enquiry.name = 'Edited fictional name'; saveDraft(s, a); assert.deepEqual(listDrafts(s), [a, b]);
});
test('fictional examples are editable data with independently verified totals', () => {
  assert.equal(calculateQuote(fictionalExample('wedding').quote).totalPence, 43000);
  assert.equal(calculateQuote(fictionalExample('celebration').quote).totalPence, 7100);
  assert.throws(() => fictionalExample('unknown'));
});
test('malformed enquiries, invalid email/calendar dates and unknown schema are rejected', () => {
  for (const patch of [{email: 'invalid'}, {eventDate: '2027-02-29'}, {eventDate: '2028-13-01'}, {eventDate: '1/1/2028'}, {name: 'x'.repeat(201)}, {notes: 'x'.repeat(4001)}, {phone: null}]) { const d = createDraft(); Object.assign(d.enquiry, patch); assert.throws(() => validateDraft(d)); }
  for (const patch of [{version: 2}, {id: '../bad'}, {id: ''}, {enquiry: {}}, {extra: 'unknown'}, {quote: {}}]) assert.throws(() => validateDraft({...createDraft(), ...patch}));
});
test('invalid saves do not overwrite any earlier data', () => {
  const s = storage(), d = fictionalExample(); saveDraft(s, d); const before = s.getItem(STORAGE_KEY); d.quote.items[0].unitPence = -1;
  assert.throws(() => saveDraft(s, d)); assert.equal(s.getItem(STORAGE_KEY), before);
});
test('corrupt, future-format and duplicate-identity storage is preserved and blocks saves', () => {
  const d = createDraft();
  for (const raw of ['{bad', 'null', '{"version":2,"drafts":[]}', JSON.stringify({version: 1, drafts: [{...d, version: 3}]}), JSON.stringify({version: 1, drafts: [d, d]})]) {
    const s = storage(); s.setItem(STORAGE_KEY, raw); assert.throws(() => listDrafts(s)); assert.throws(() => saveDraft(s, createDraft())); assert.equal(s.getItem(STORAGE_KEY), raw);
  }
});
test('quota and denied storage access propagate instead of claiming success', () => {
  const d = createDraft();
  assert.throws(() => listDrafts({getItem() { throw new Error('Access denied'); }}), /Access denied/);
  assert.throws(() => saveDraft({getItem() { return null; }, setItem() { throw new Error('Quota exceeded'); }}, d), /Quota exceeded/);
});
test('100-draft limit permits updates but prevents an additional draft', () => {
  const s = storage(), drafts = Array.from({length: 100}, (_, i) => createDraft('draft-'+i));
  s.setItem(STORAGE_KEY, JSON.stringify({version: 1, drafts})); const before = s.getItem(STORAGE_KEY);
  assert.throws(() => saveDraft(s, createDraft('extra')), /100-draft/); assert.equal(s.getItem(STORAGE_KEY), before);
  drafts[0].enquiry.name = 'Updated'; saveDraft(s, drafts[0]); assert.equal(listDrafts(s).length, 100); assert.equal(listDrafts(s)[0].enquiry.name, 'Updated');
});
