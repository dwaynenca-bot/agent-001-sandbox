import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { parseInventory, compareInventories, reportCsv } from './inventory';
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
