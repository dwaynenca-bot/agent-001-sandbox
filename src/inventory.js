import Papa from 'papaparse';

const required = ['sku', 'product_name', 'quantity'];
export function parseInventory(text, source) {
  const issues = [];
  const records = new Map();
  const unique = new Set();
  const occurrences = new Map();
  const issue = (detail, row = '', sku = '') => issues.push({ type: 'Invalid record', source, row, sku, name: '', a: null, b: null, difference: null, detail });
  if (!text.trim()) {
    issue('File is empty.');
    return { source, records, uniqueCount: 0, issues, duplicateCount: 0, fatal: true };
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', delimiter: ',', transformHeader: h => h.trim() });
  for (const error of parsed.errors) issue(`CSV error: ${error.message}`, Number.isInteger(error.row) ? error.row + 2 : '');
  const fields = parsed.meta.fields || [];
  const missing = required.filter(field => !fields.includes(field));
  if (missing.length) issue(`Missing required columns: ${missing.join(', ')}.`);
  if (parsed.meta.renamedHeaders) issue('Duplicate column names are not allowed.');
  if (!parsed.data.length) issue('File has no inventory records.');
  if (missing.length || parsed.errors.length || parsed.meta.renamedHeaders || !parsed.data.length) {
    return { source, records, uniqueCount: 0, issues, duplicateCount: 0, fatal: true };
  }
  parsed.data.forEach((record, index) => {
    const row = index + 2;
    const sku = (record.sku || '').trim();
    const quantity = (record.quantity || '').trim();
    let valid = true;
    if (!sku || /[\x00-\x1f\x7f]/.test(sku)) { issue('SKU must be nonempty and contain no control characters.', row, sku); valid = false; }
    else {
      unique.add(sku);
      occurrences.set(sku, [...(occurrences.get(sku) || []), row]);
    }
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(Number(quantity))) {
      issue('Quantity must be a nonnegative whole number within the safe integer range.', row, sku); valid = false;
    }
    if (valid) records.set(sku, { sku, name: record.product_name.trim(), quantity: Number(quantity) });
  });
  let duplicateCount = 0;
  for (const [sku, rows] of occurrences) {
    if (rows.length > 1) {
      duplicateCount++;
      records.delete(sku);
      issues.push({ type: 'Duplicate SKU', source, row: rows.join(', '), sku, name: '', a: null, b: null, difference: null, detail: `SKU occurs in records ${rows.join(', ')}. All occurrences excluded from comparison.` });
    }
  }
  return { source, records, uniqueCount: unique.size, issues, duplicateCount };
}

export function compareInventories(a, b) {
  const rows = [...a.issues, ...b.issues];
  if (a.fatal || b.fatal) return rows;
  // A SKU invalid or duplicated in either file must never appear as missing or matched.
  const blocked = new Set(rows.map(row => row.sku).filter(Boolean));
  for (const sku of new Set([...a.records.keys(), ...b.records.keys()])) {
    if (blocked.has(sku)) continue;
    const left = a.records.get(sku);
    const right = b.records.get(sku);
    const difference = left && right ? right.quantity - left.quantity : null;
    rows.push({ sku, name: left?.name || right?.name || '', a: left?.quantity ?? null, b: right?.quantity ?? null, difference,
      source: !left ? 'A' : !right ? 'B' : 'A + B', row: '',
      type: !left ? 'Missing from A' : !right ? 'Missing from B' : difference ? 'Quantity mismatch' : 'Match',
      detail: !left || !right ? 'SKU is absent from this inventory.' : difference ? 'Quantities differ between inventories.' : 'Quantities agree.' });
  }
  return rows;
}

// Spreadsheet formula protection for user-controlled text, including SKU and product name.
export function reportCsv(rows) {
  return Papa.unparse(rows.filter(row => row.type !== 'Match').map(row => ({
    issue: row.type, sku: row.sku, product_name: row.name, inventory_a_quantity: row.a,
    inventory_b_quantity: row.b, difference_b_minus_a: row.difference, source: row.source, record: row.row, detail: row.detail,
  })), { escapeFormulae: true, columns: ['issue', 'sku', 'product_name', 'inventory_a_quantity', 'inventory_b_quantity', 'difference_b_minus_a', 'source', 'record', 'detail'] });
}
