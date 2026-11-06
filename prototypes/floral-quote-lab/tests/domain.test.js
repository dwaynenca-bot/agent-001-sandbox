import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQuote, editQuote, calculateQuote, parseMoney, formatMoney} from '../src/domain.js';

const item = (id = 'bouquet', quantity = 3, unitPence = 1010) => ({id, description: 'Fictional bouquet', quantity, unitPence});
const add = (quote, value, collection = 'items') => editQuote(quote, {action: 'add', collection, value});

test('empty draft totals zero, with no implied tax treatment', () => {
  assert.deepEqual(calculateQuote(createQuote()), {lines: [], subtotalPence: 0, chargesPence: 0, totalPence: 0});
  assert.equal(createQuote().status, 'DRAFT');
});
test('GBP strings convert exactly to pence without floating-point multiplication', () => {
  for (const [input, expected] of [['0', 0], ['0.01', 1], ['1.1', 110], ['19.99', 1999], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) assert.equal(parseMoney(input), expected);
});
test('money parser rejects ambiguous, rounded, negative and non-string inputs', () => {
  for (const value of ['', ' ', ' 1.00', '1.00 ', '-1', '+1', '.50', '1.', '01', '1.001', '1e3', '1,000', '£10', 'Infinity', 'NaN', 1, null, undefined, '90071992547409.92', '9'.repeat(10000)]) assert.throws(() => parseMoney(value), String(value).slice(0, 40));
});
test('formatting preserves exact pence including the safe integer boundary', () => {
  assert.equal(formatMoney(0), '£0.00');
  assert.equal(formatMoney(1010), '£10.10');
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER), '£90,071,992,547,409.91');
  assert.throws(() => formatMoney(-1));
});
test('multiple line totals, delivery and setup are separately included', () => {
  let q = add(add(createQuote(), item()), item('table', 2, 999));
  q = add(q, {id: 'delivery', description: 'Delivery', amountPence: 2500}, 'charges');
  q = add(q, {id: 'setup', description: 'Setup', amountPence: 1500}, 'charges');
  assert.deepEqual(calculateQuote(q), {lines: [{id: 'bouquet', totalPence: 3030}, {id: 'table', totalPence: 1998}], subtotalPence: 5028, chargesPence: 4000, totalPence: 9028});
});
test('optional charges may be omitted or explicitly zero; free items are valid', () => {
  let q = add(createQuote(), item('gift', 1, 0));
  q = add(q, {id: 'delivery', description: 'Delivery', amountPence: 0}, 'charges');
  assert.equal(calculateQuote(q).totalPence, 0);
});
test('all quantities must be positive whole safe integers', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, '2', null, undefined, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => add(createQuote(), {...item('q'), quantity: value}), String(value));
});
test('prices and charges reject negatives, fractions, non-finite values and coercion', () => {
  for (const value of [-1, .5, NaN, Infinity, '100', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => add(createQuote(), {...item('p'), unitPence: value}));
    assert.throws(() => add(createQuote(), {id: 'setup', description: 'Setup', amountPence: value}, 'charges'));
  }
});
test('multiplication overflow is rejected; safe boundary is accepted', () => {
  assert.equal(calculateQuote(add(createQuote(), item('max', 1, Number.MAX_SAFE_INTEGER))).totalPence, Number.MAX_SAFE_INTEGER);
  assert.throws(() => add(createQuote(), item('over', 2, Number.MAX_SAFE_INTEGER)), /safe integer/);
});
test('subtotal, charge sum and combined total overflow are each rejected', () => {
  const max = add(createQuote(), item('max', 1, Number.MAX_SAFE_INTEGER));
  assert.throws(() => add(max, item('extra', 1, 1)), /safe integer/);
  assert.throws(() => add(max, {id: 'delivery', description: 'Delivery', amountPence: 1}, 'charges'), /safe integer/);
  const delivery = add(createQuote(), {id: 'delivery', description: 'Delivery', amountPence: Number.MAX_SAFE_INTEGER}, 'charges');
  assert.throws(() => add(delivery, {id: 'setup', description: 'Setup', amountPence: 1}, 'charges'), /safe integer/);
});
test('editing and removing an item recalculates totals without mutating previous drafts', () => {
  const original = add(createQuote(), item());
  const edited = editQuote(original, {action: 'update', collection: 'items', id: 'bouquet', value: {quantity: 2, unitPence: 1200, description: 'Edited fictional bouquet'}});
  assert.equal(calculateQuote(original).totalPence, 3030);
  assert.equal(calculateQuote(edited).totalPence, 2400);
  const removed = editQuote(edited, {action: 'remove', collection: 'items', id: 'bouquet'});
  assert.equal(calculateQuote(removed).totalPence, 0);
  assert.equal(edited.items.length, 1);
});
test('editing/removing delivery and setup uses the same validation', () => {
  const q = add(createQuote(), {id: 'setup', description: 'Setup', amountPence: 100}, 'charges');
  const next = editQuote(q, {action: 'update', collection: 'charges', id: 'setup', value: {amountPence: 200}});
  assert.equal(calculateQuote(next).totalPence, 200);
  assert.equal(calculateQuote(q).totalPence, 100);
  assert.equal(calculateQuote(editQuote(next, {action: 'remove', collection: 'charges', id: 'setup'})).totalPence, 0);
});
test('failed edits are atomic and caller-owned entries are cloned', () => {
  const input = item();
  const q = add(createQuote(), input);
  input.unitPence = 1;
  const before = JSON.stringify(q);
  assert.throws(() => editQuote(q, {action: 'update', collection: 'items', id: 'bouquet', value: {quantity: 0}}));
  assert.equal(JSON.stringify(q), before);
  assert.equal(q.items[0].unitPence, 1010);
});
test('missing entries, unknown operations, identity edits and duplicate IDs are rejected', () => {
  const q = add(createQuote(), item());
  assert.throws(() => add(q, item()));
  for (const action of ['update', 'remove']) assert.throws(() => editQuote(q, {action, collection: 'items', id: 'missing', value: {quantity: 1}}));
  assert.throws(() => editQuote(q, {action: 'replace', collection: 'items'}));
  assert.throws(() => editQuote(q, {action: 'add', collection: '__proto__', value: item()}));
  assert.throws(() => editQuote(q, {action: 'update', collection: 'items', id: 'bouquet', value: {id: 'changed'}}));
});
test('unsupported quote shapes, fields, empty labels and charge types are rejected', () => {
  for (const q of [null, {}, {...createQuote(), version: 2}, {...createQuote(), currency: 'USD'}, {...createQuote(), status: 'FINAL'}, {...createQuote(), items: null}, {...createQuote(), tax: 20}]) assert.throws(() => calculateQuote(q));
  assert.throws(() => add(createQuote(), {...item(), description: '  '}));
  assert.throws(() => add(createQuote(), {...item(), description: 'x'.repeat(201)}));
  assert.throws(() => add(createQuote(), {...item(), extra: 1}));
  assert.throws(() => add(createQuote(), {id: 'tax', description: 'Tax', amountPence: 1}, 'charges'));
  assert.throws(() => calculateQuote({...createQuote(), items: [item('delivery')], charges: [{id: 'delivery', description: 'Delivery', amountPence: 0}]}));
});
