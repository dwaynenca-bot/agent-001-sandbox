import { it, expect } from 'vitest';
import { parseInventory, compareInventories } from './inventory';

it('accepts leading-zero quantities as numeric values', () => {
  const a = parseInventory(['sku,product_name,quantity', 'a,Apple,001'].join('\n'), 'A');
  const b = parseInventory(['sku,product_name,quantity', 'a,Apple,1'].join('\n'), 'B');
  expect(a.issues).toHaveLength(0);
  expect(b.issues).toHaveLength(0);
  const result = compareInventories(a, b);
  expect(result).toHaveLength(1);
  expect(result[0].type).toBe('Match');
  expect(result[0].a).toBe(1);
  expect(result[0].b).toBe(1);
});
