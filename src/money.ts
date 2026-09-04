import { RideError } from './errors.js';

const MONTO_PATTERN = /^\d+(\.\d{1,6})?$/;

export function isMonto(s: string): boolean {
  return MONTO_PATTERN.test(s);
}

export function toCents(monto: string): number {
  if (!isMonto(monto)) {
    throw new RideError(`Monto inválido: '${monto}'`, 'RIDE_INVALID_INPUT', {
      cause: new Error('Debe ser un número no negativo con hasta 6 decimales.'),
    });
  }

  const [intPart, fracPart = ''] = monto.split('.');
  const fracPadded = fracPart.padEnd(6, '0');
  const totalMicro = BigInt(intPart) * 1_000_000n + BigInt(fracPadded);
  const cents = (totalMicro + 5_000n) / 10_000n;

  return Number(cents);
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const intPart = Math.floor(absCents / 100);
  const centPart = absCents % 100;

  return `${sign}${intPart}.${centPart.toString().padStart(2, '0')}`;
}

export function formatMonto(monto: string, decimals: number): string {
  if (!isMonto(monto)) {
    throw new RideError(`Monto inválido: '${monto}'`, 'RIDE_INVALID_INPUT', {
      cause: new Error('Debe ser un número no negativo con hasta 6 decimales.'),
    });
  }

  const [intPart, fracPart = ''] = monto.split('.');
  const workScale = Math.max(decimals, fracPart.length);
  const fracPadded = fracPart.padEnd(workScale, '0');
  const totalMicro = BigInt(intPart) * 10n ** BigInt(workScale) + BigInt(fracPadded || '0');

  const divisor = 10n ** BigInt(workScale - decimals);
  const half = divisor / 2n;
  const rounded = (totalMicro + half) / divisor;

  const roundedStr = rounded.toString().padStart(decimals + 1, '0');
  const cut = roundedStr.length - decimals;
  const intOut = roundedStr.slice(0, cut);
  const fracOut = roundedStr.slice(cut);

  return decimals > 0 ? `${intOut}.${fracOut}` : intOut;
}
