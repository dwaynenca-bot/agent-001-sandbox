import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { parseInventory, compareInventories, reportCsv, fullComparisonCsv } from './inventory';
const header = 'sku,product_name,quantity\n';
const parse = (rows, source = 'A') => parseInventory(header + rows, source);
const compare = (a, b) => compareInventories(parse(a), parse(b, 'B'));
describe('inventory validation and comparison', () => {
  it('matches identical inventories including zero quantity', () => {
    const result = compare('a,Apple,0\nb,Banana,2', 'a,Apple,0\nb,Banana,2');
    expect(result.map(r => r.type)).toEqual(['Match', 'Match']);
    expect(result.map(r => r.difference)).toEqual([0, 0]);
  });
  it('detects missing SKUs in both directions without inventing quantities', () => {
    const result = compare('a,Apple,2', 'b,Banana,3');
    expect(result.map(r => r.type)).toEqual(['Missing from B', 'Missing from A']);
    expect(result[0].b).toBeNull(); expect(result[1].a).toBeNull();
    expect(result.every(r => r.difference === null)).toBe(true);
  });
  it('calculates positive and negative B minus A differences', () => {
    const result = compare('a,Apple,7\nb,Banana,2', 'a,Apple,3\nb,Banana,9');
    expect(result.map(r => r.difference)).toEqual([-4, 7]);
    expect(result.every(r => r.type === 'Quantity mismatch')).toBe(true);
  });
  it('normalizes surrounding SKU whitespace but preserves case and ignores product similarity', () => {
    const result = compare(' a ,Same name,1\nA,Same name,2', 'a,New name,1');
    expect(result.map(r => r.type)).toEqual(['Match', 'Missing from B']);
  });
  it('flags duplicate SKUs and excludes every occurrence from comparison', () => {
    const a = parse(' a ,One,1\na,Two,5');
    expect(a.uniqueCount).toBe(1); expect(a.duplicateCount).toBe(1); expect(a.records.size).toBe(0);
    expect(compareInventories(a, parse('a,One,1', 'B')).map(r => r.type)).toEqual(['Duplicate SKU']);
  });
  it('does not let an invalid duplicate overwrite or validate another occurrence', () => {
    const result = compare('a,One,1\na,Two,nope', 'a,One,1');
    expect(result.map(r => r.type)).toEqual(['Invalid record', 'Duplicate SKU']);
  });
  it.each(['', '-1', '1.5', 'nope', 'NaN', 'Infinity', '2units', '1e2', '9007199254740992'])('rejects invalid quantity %j', quantity => {
    const result = compare(`a,Apple,${quantity}`, 'a,Apple,1');
    expect(result).toHaveLength(1); expect(result[0].type).toBe('Invalid record');
  });
  it('accepts safe integer boundaries', () => {
    expect(parse('a,Apple,9007199254740991').issues).toHaveLength(0);
  });
  it('supports quoted commas, escaped quotes and multiline product names', () => {
    const a = parse('a,"Lamp, brass",2\nb,"A ""great""\nproduct",4');
    expect(a.issues).toHaveLength(0);
    expect(a.records.get('a').name).toBe('Lamp, brass');
    expect(a.records.get('b').name).toBe('A "great"\nproduct');
  });
  it('rejects blank SKU values', () => {
    expect(parse('  ,Apple,2').issues[0].detail).toContain('SKU');
  });
  it.each(['', '  \n', header])('rejects empty or header-only files', text => {
    const a = parseInventory(text, 'A');
    expect(a.issues.length).toBeGreaterThan(0);
    expect(compareInventories(a, parse('a,Apple,1', 'B')).every(r => r.type === 'Invalid record')).toBe(true);
  });
  it('reports missing required columns and prevents misleading missing-SKU results', () => {
    const a = parseInventory('sku,quantity\na,1', 'A');
    expect(a.issues[0].detail).toContain('product_name');
    expect(compareInventories(a, parse('b,Banana,1', 'B'))).toEqual(a.issues);
  });
  it.each(['a,"Unclosed,2', 'a,Apple,2,extra', 'a,Apple'])('reports malformed CSV %j', rows => {
    expect(parse(rows).fatal).toBe(true);
  });
  it('rejects duplicate headers', () => {
    expect(parseInventory('sku,product_name,quantity,sku\na,Apple,1,b', 'A').fatal).toBe(true);
  });
  it('exports only issues, preserving numeric differences and quoted text', () => {
    const rows = compare('a,"Lamp, brass",4\nb,Book,2', 'a,"Lamp, brass",1\nb,Book,2');
    const exported = Papa.parse(reportCsv(rows), { header: true }).data;
    expect(exported).toHaveLength(1);
    expect(exported[0].product_name).toBe('Lamp, brass');
    expect(exported[0].difference_b_minus_a).toBe('-3');
  });
  it('protects CSV exports against spreadsheet formulas', () => {
    const csv = reportCsv([{ type: 'Missing from B', sku: '=1+1', name: '@SUM(1)', a: 1, b: null, difference: null }]);
    const row = Papa.parse(csv, { header: true }).data[0];
    expect(row.sku).toBe("'=1+1"); expect(row.product_name).toBe("'@SUM(1)");
  });
});

describe('full comparison CSV', () => {
  const exported = rows => Papa.parse(fullComparisonCsv(rows), { header: true }).data;
  it('includes matches, signed differences and missing SKUs with blank quantities', () => {
    const rows = exported(compare('a,Apple,0\nb,"Lamp, brass",4\nc,Cherry,2\nd,Date,1', 'a,Apple,0\nb,Lamp,1\nc,Cherry,5\ne,Elderberry,7'));
    expect(rows.map(r => r.comparison_status)).toEqual(['Match', 'Quantity mismatch', 'Quantity mismatch', 'Missing from B', 'Missing from A']);
    expect(rows[0]).toEqual({ sku: 'a', product_name: 'Apple', inventory_a_quantity: '0', inventory_b_quantity: '0', difference_b_minus_a: '0', comparison_status: 'Match' });
    expect(rows[1].product_name).toBe('Lamp, brass');
    expect(rows.map(r => r.difference_b_minus_a)).toEqual(['0', '-3', '3', '', '']);
    expect(rows[3].inventory_b_quantity).toBe('');
    expect(rows[4].inventory_a_quantity).toBe('');
  });
  it('excludes SKUs invalid or duplicated in either inventory', () => {
    const rows = exported(compare('a,Apple,1\na,Apple,2\nb,Banana,nope\nc,Cherry,3\nd,Date,4\ne,End,0', 'a,Apple,1\nb,Banana,2\nc,Cherry,nope\nd,Date,1\nd,Date,2\ne,End,0'));
    expect(rows.map(r => r.sku)).toEqual(['e']);
  });
  it('exports only headers when file-level validation prevents comparison', () => {
    const rows = compareInventories(parseInventory('', 'A'), parse('a,Apple,1', 'B'));
    expect(fullComparisonCsv(rows)).toBe('sku,product_name,inventory_a_quantity,inventory_b_quantity,difference_b_minus_a,comparison_status\r\n');
  });
  it.each(['=1+1', '+SUM(1)', '-1+2', '@SUM(1)'])('escapes formula-like SKU and multiline product text %s', value => {
    const input = Papa.unparse([{sku: value, product_name: value + ',"quoted"\nnext', quantity: 1}]);
    const rows = exported(compareInventories(parseInventory(input, 'A'), parseInventory(input, 'B')));
    expect(rows[0].sku).toBe("'" + value);
    expect(rows[0].product_name).toBe("'" + value + ',"quoted"\nnext');
  });
});

describe('duplicate occurrence accumulation regressions', () => {
  it('retains every record number for a heavily repeated normalized SKU', () => {
    const count = 20000;
    const a = parse(Array.from({ length: count }, (_, i) => `${i % 2 ? ' dup ' : 'dup'},Fictional,1`).join('\n'));
    const records = Array.from({ length: count }, (_, i) => i + 2).join(', ');
    expect(a.uniqueCount).toBe(1);
    expect(a.duplicateCount).toBe(1);
    expect([...a.records]).toEqual([]);
    expect(a.issues).toEqual([{ type: 'Duplicate SKU', source: 'A', row: records, sku: 'dup', name: '', a: null, b: null, difference: null,
      detail: `SKU occurs in records ${records}. All occurrences excluded from comparison.` }]);
  });

  it('preserves first-seen duplicate order, invalid-first issue order and case-sensitive identities', () => {
    const a = parse(' b ,First,1\na,Second,2\nb,Invalid,nope\nsolo,Solo,0\n a ,Again,3\nB,Uppercase,4');
    expect(a.uniqueCount).toBe(4);
    expect(a.duplicateCount).toBe(2);
    expect(a.issues.map(({ type, sku, row }) => ({ type, sku, row }))).toEqual([
      { type: 'Invalid record', sku: 'b', row: 4 },
      { type: 'Duplicate SKU', sku: 'b', row: '2, 4' },
      { type: 'Duplicate SKU', sku: 'a', row: '3, 6' },
    ]);
    expect([...a.records.keys()]).toEqual(['solo', 'B']);
    const rows = compareInventories(a, parse('a,Other,1\nb,Other,1\nsolo,Solo,0\nB,Uppercase,4', 'B'));
    expect(rows.map(row => row.type)).toEqual(['Invalid record', 'Duplicate SKU', 'Duplicate SKU', 'Match', 'Match']);
    expect(rows.filter(row => row.a !== null).map(row => row.sku)).toEqual(['solo', 'B']);
  });

  it('collects all occurrences even when the first and last quantities are invalid', () => {
    const a = parse('x,Invalid first,nope\nx,Valid middle,1\nx,Invalid last,-1');
    expect(a.issues.map(({ type, row }) => ({ type, row }))).toEqual([
      { type: 'Invalid record', row: 2 }, { type: 'Invalid record', row: 4 }, { type: 'Duplicate SKU', row: '2, 3, 4' },
    ]);
    expect(compareInventories(a, parse('x,Other,1', 'B'))).toEqual(a.issues);
  });

  it('keeps duplicate diagnostics and formula protection in issues export and excludes duplicates from full export', () => {
    const rows = compare('=1+1,First,1\n+keep,@SUM(1),4\n=1+1,Second,2', '=1+1,Other,1\n+keep,Other,1');
    const issues = Papa.parse(reportCsv(rows), { header: true }).data;
    expect(issues.map(row => row.issue)).toEqual(['Duplicate SKU', 'Quantity mismatch']);
    expect(issues[0]).toMatchObject({ sku: "'=1+1", record: '2, 4', detail: 'SKU occurs in records 2, 4. All occurrences excluded from comparison.' });
    expect(issues[1]).toMatchObject({ sku: "'+keep", product_name: "'@SUM(1)", difference_b_minus_a: '-3' });
    expect(Papa.parse(fullComparisonCsv(rows), { header: true }).data).toEqual([
      { sku: "'+keep", product_name: "'@SUM(1)", inventory_a_quantity: '4', inventory_b_quantity: '1', difference_b_minus_a: '-3', comparison_status: 'Quantity mismatch' },
    ]);
  });
});
