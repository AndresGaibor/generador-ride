import { describe, expect, test } from 'vitest';
import { formatMonto, fromCents, isMonto, toCents } from '../src/money.js';

describe('toCents', () => {
  test('converts a monto with 2 decimals', () => {
    expect(toCents('100.00')).toBe(10000);
  });

  test('converts a monto with 1 decimal', () => {
    expect(toCents('0.1')).toBe(10);
  });

  test('rounds half-up when third decimal is 5', () => {
    expect(toCents('1.005')).toBe(101);
  });

  test('truncates (no rounding up) when third decimal is less than 5', () => {
    expect(toCents('1.004')).toBe(100);
  });

  test('converts a monto without decimal part', () => {
    expect(toCents('100')).toBe(10000);
  });

  test('converts a monto with 6 decimals (max supported scale)', () => {
    expect(toCents('1.123456')).toBe(112);
  });

  test('throws on malformed monto', () => {
    expect(() => toCents('abc')).toThrow();
  });

  test('throws on negative monto', () => {
    expect(() => toCents('-1.00')).toThrow();
  });

  test('throws on more than 6 decimals', () => {
    expect(() => toCents('1.1234567')).toThrow();
  });
});

describe('fromCents', () => {
  test('formats cents to a 2-decimal monto', () => {
    expect(fromCents(11200)).toBe('112.00');
  });

  test('pads with zero when cents are a single digit', () => {
    expect(fromCents(5)).toBe('0.05');
  });

  test('formats zero', () => {
    expect(fromCents(0)).toBe('0.00');
  });
});

describe('formatMonto', () => {
  test('formats to 2 decimals a monto that already has 2 decimals', () => {
    expect(formatMonto('100.00', 2)).toBe('100.00');
  });

  test('formats to 6 decimals (quantity/unitprice scale)', () => {
    expect(formatMonto('1', 6)).toBe('1.000000');
    expect(formatMonto('1.000000', 6)).toBe('1.000000');
  });

  test('pads with zeros an integer monto to 2 decimals', () => {
    expect(formatMonto('0', 2)).toBe('0.00');
    expect(formatMonto('112', 2)).toBe('112.00');
  });

  test('rounds half-up when there are more decimals than destination scale', () => {
    expect(formatMonto('1.005', 2)).toBe('1.01');
    expect(formatMonto('1.004', 2)).toBe('1.00');
  });

  test('truncates without rounding when monto already matches destination scale exactly', () => {
    expect(formatMonto('12.345678', 6)).toBe('12.345678');
  });

  test('throws on invalid monto', () => {
    expect(() => formatMonto('abc', 2)).toThrow();
    expect(() => formatMonto('-1.00', 2)).toThrow();
  });
});

describe('isMonto', () => {
  test('rejects non-numeric strings', () => {
    expect(isMonto('abc')).toBe(false);
  });

  test('accepts integers', () => {
    expect(isMonto('100')).toBe(true);
  });

  test('accepts up to 6 decimals', () => {
    expect(isMonto('1.123456')).toBe(true);
  });

  test('rejects more than 6 decimals', () => {
    expect(isMonto('1.1234567')).toBe(false);
  });

  test('rejects negatives', () => {
    expect(isMonto('-1.00')).toBe(false);
  });
});
