import { describe, expect, test } from 'vitest';
import { RideError, generarRide } from '../src/index.ts';

describe('public API', () => {
  test('RideError is exported as a class', () => {
    expect(RideError).toBeDefined();
    expect(typeof RideError).toBe('function');
  });

  test('RideError has correct error codes', () => {
    const err = new RideError('test', 'RIDE_UNSUPPORTED_DOCUMENT');
    expect(err.code).toBe('RIDE_UNSUPPORTED_DOCUMENT');
    expect(err.message).toBe('test');
    expect(err.name).toBe('RideError');
  });

  test('RideError preserves cause', () => {
    const cause = new Error('original');
    const err = new RideError('test', 'RIDE_INVALID_INPUT', { cause });
    expect(err.cause).toBe(cause);
  });

  test('RideError codes are all supported', () => {
    const codes = [
      'RIDE_UNSUPPORTED_DOCUMENT',
      'RIDE_INVALID_INPUT',
      'RIDE_INVALID_LOGO',
      'RIDE_RENDER_FAILED',
    ] as const;
    for (const code of codes) {
      const err = new RideError('test', code);
      expect(err.code).toBe(code);
    }
  });

  test('generarRide is exported as a function', () => {
    expect(generarRide).toBeDefined();
    expect(typeof generarRide).toBe('function');
  });

  test('generarRide throws RIDE_UNSUPPORTED_DOCUMENT for invalid tipo', async () => {
    await expect(
      generarRide({ documento: { tipo: '99' } as any, claveAcceso: '123' }),
    ).rejects.toThrow('Tipo de comprobante no soportado por el RIDE.');
    await expect(
      generarRide({ documento: { tipo: '99' } as any, claveAcceso: '123' }),
    ).rejects.toMatchObject({ code: 'RIDE_UNSUPPORTED_DOCUMENT' });
  });

  test('generarRide wraps unexpected renderer errors as RIDE_RENDER_FAILED', async () => {
    await expect(
      generarRide({ documento: { tipo: '01' } as any, claveAcceso: '123' }),
    ).rejects.toMatchObject({ code: 'RIDE_RENDER_FAILED' });
  });
});
