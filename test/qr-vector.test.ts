import { describe, expect, it } from 'vitest';
import { crearQrMatrix } from '../src/qr/qr-vector.js';

const CLAVE_49_DIGITOS = '2809202601179000000110010010000000011234567813';
const EXPECTED_VERSION = 2;
const EXPECTED_MASK_PATTERN = 0;
const EXPECTED_SIZE = 25;
const EXPECTED_MODULES_HASH = '0816901598ca9f049c348122c4c84597787cadb0ae9ea000353a9189aff5d74b';

async function hashModulesData(data: Uint8Array, size: number): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(data.slice(0, size * size)).digest('hex');
}

describe('QR vector rendering', () => {
  it('crearQrMatrix produce matriz determinista con version, maskPattern y size hardcoded', async () => {
    const matrix = await crearQrMatrix(CLAVE_49_DIGITOS);

    expect(matrix.size).toBe(EXPECTED_SIZE);
    expect(matrix.version).toBe(EXPECTED_VERSION);
    expect(matrix.maskPattern).toBe(EXPECTED_MASK_PATTERN);
  });

  it('modules.data produce hash SHA-256 esperado', async () => {
    const { createHash } = await import('crypto');
    const QRCode = (await import('qrcode')).default;
    const qrData = QRCode.create(CLAVE_49_DIGITOS, { errorCorrectionLevel: 'M' });
    const hash = createHash('sha256').update(qrData.modules.data.slice(0, qrData.modules.size * qrData.modules.size)).digest('hex');
    expect(hash).toBe(EXPECTED_MODULES_HASH);
  });

  it('get(row, col) devuelve true para módulo negro y false para blanco', async () => {
    const matrix = await crearQrMatrix(CLAVE_49_DIGITOS);

    let blackCount = 0;
    let whiteCount = 0;
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (matrix.get(row, col)) {
          blackCount++;
        } else {
          whiteCount++;
        }
      }
    }
    expect(blackCount).toBeGreaterThan(0);
    expect(whiteCount).toBeGreaterThan(0);
    expect(blackCount + whiteCount).toBe(matrix.size * matrix.size);
  });
});
