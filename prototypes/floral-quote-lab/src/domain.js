/** GBP amounts are non-negative safe integer pence; quantities are whole units.
 * No implicit coercion, rounding, tax, discounts or deposits are applied.
 */
export function pence(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Amount must be non-negative safe integer pence');
  return value;
}

export function parseMoney(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new TypeError('Enter pounds with up to two decimal places');
  }
  const [pounds, fraction = ''] = value.split('.');
  return pence(Number(BigInt(pounds) * 100n + BigInt(fraction.padEnd(2, '0'))));
}

export function formatMoney(value) {
  pence(value);
  const amount = BigInt(value);
  return `£${(amount / 100n).toLocaleString('en-GB')}.${String(amount % 100n).padStart(2, '0')}`;
}

function text(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(`${field} must contain 1–${max} characters`);
  return value;
}

function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError(`Invalid ${label} fields`);
  }
}

function line(value) {
  fields(value, ['id', 'description', 'quantity', 'unitPence'], 'line item');
  text(value.id, 'Item ID', 80);
  text(value.description, 'Description');
  if (!Number.isSafeInteger(value.quantity) || value.quantity < 1) throw new RangeError('Quantity must be a positive safe integer');
  pence(value.unitPence);
}

function charge(value) {
  fields(value, ['id', 'description', 'amountPence'], 'charge');
  text(value.id, 'Charge ID', 80);
  if (!['delivery', 'setup'].includes(value.id)) throw new TypeError('Charge must be delivery or setup');
  text(value.description, 'Description');
  pence(value.amountPence);
}

function safeAmount(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Quotation amount exceeds safe integer pence');
  return Number(value);
}

export function calculateQuote(quote) {
  fields(quote, ['version', 'currency', 'status', 'items', 'charges'], 'quotation');
  if (quote.version !== 1 || quote.currency !== 'GBP' || quote.status !== 'DRAFT') throw new TypeError('Unsupported quotation version, currency or status');
  if (!Array.isArray(quote.items) || !Array.isArray(quote.charges)) throw new TypeError('Items and charges must be arrays');
  const ids = new Set();
  for (const entry of [...quote.items, ...quote.charges]) {
    text(entry?.id, 'Entry ID', 80);
    if (ids.has(entry.id)) throw new TypeError('Entry IDs must be unique');
    ids.add(entry.id);
  }
  const lines = quote.items.map(item => {
    line(item);
    return {id: item.id, totalPence: safeAmount(BigInt(item.quantity) * BigInt(item.unitPence))};
  });
  quote.charges.forEach(charge);
  const subtotal = lines.reduce((sum, item) => sum + BigInt(item.totalPence), 0n);
  const charges = quote.charges.reduce((sum, item) => sum + BigInt(item.amountPence), 0n);
  return {lines, subtotalPence: safeAmount(subtotal), chargesPence: safeAmount(charges), totalPence: safeAmount(subtotal + charges)};
}

export function createQuote() {
  return {version: 1, currency: 'GBP', status: 'DRAFT', items: [], charges: []};
}

/** All edits return validated independent copies. A failed edit leaves the original intact. */
export function editQuote(quote, operation) {
  calculateQuote(quote);
  fields(operation, ['action', 'collection', 'id', 'value'], 'edit');
  const {action, collection, id, value} = operation;
  if (!['items', 'charges'].includes(collection) || !['add', 'update', 'remove'].includes(action)) throw new TypeError('Unsupported edit');
  const next = structuredClone(quote);
  const entries = next[collection];
  if (action === 'add') {
    entries.push(structuredClone(value));
  } else {
    const index = entries.findIndex(entry => entry.id === id);
    if (index < 0) throw new RangeError('Entry does not exist');
    if (action === 'remove') entries.splice(index, 1);
    else {
      fields(value, collection === 'items' ? ['description', 'quantity', 'unitPence'] : ['description', 'amountPence'], 'update');
      entries[index] = {...entries[index], ...value};
    }
  }
  calculateQuote(next);
  return next;
}
