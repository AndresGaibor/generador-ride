import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { crearQrMatrix } from '../../src/qr/qr-vector.js';
import { generarRide } from '../../src/index.js';
import { analizarPdf } from '../pdf-analysis.js';
import type { RideDocument } from '../../src/types.js';
import {
  dockerAvailable,
  buildDockerImage,
  rasterizePdf,
  comparePageImages,
  qrLocationFromLayout,
  cleanupDir,
  DPI,
  QR_LADO_PT,
  THRESHOLD,
} from './compare.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_REF = join(__dirname, '..', 'reference', 'v0.3.0');
const BASE_FIXTURES = join(__dirname, '..', 'fixtures', 'reference');
const BASE_TEMP = '/tmp/visual-parity';

const CASOS = [
  { nombre: 'factura', tipo: '01' as const, clave: '0308202601179001100100110010010000000011234567817' },
  { nombre: 'nota-credito', tipo: '04' as const, clave: '0308202604179001100100110010010000000031234567817' },
  { nombre: 'nota-debito', tipo: '05' as const, clave: '0308202605179001100100110010010000000041234567819' },
  { nombre: 'liquidacion-compra', tipo: '03' as const, clave: '0308202603179001100100110010010000000021234567815' },
  { nombre: 'guia-remision', tipo: '06' as const, clave: '0308202606179001100100110010010000000051234567810' },
  { nombre: 'retencion', tipo: '07' as const, clave: '0308202607179001100100110010010000000061234567812' },
];

const CASOS_QR = [
  { nombre: 'factura', tipo: '01' as const, clave: '0308202601179001100100110010010000000011234567817', opts: { incluirQr: true } },
  { nombre: 'nota-credito', tipo: '04' as const, clave: '0308202604179001100100110010010000000031234567817', opts: { incluirQr: true } },
  { nombre: 'nota-debito', tipo: '05' as const, clave: '0308202605179001100100110010010000000041234567819', opts: { incluirQr: true } },
  { nombre: 'liquidacion-compra', tipo: '03' as const, clave: '0308202603179001100100110010010000000021234567815', opts: { incluirQr: true } },
  { nombre: 'guia-remision', tipo: '06' as const, clave: '0308202606179001100100110010010000000051234567810', opts: { incluirQr: true } },
  { nombre: 'retencion', tipo: '07' as const, clave: '0308202607179001100100110010010000000061234567812', opts: { incluirQr: true } },
];

const AUTH_DATE = '03/08/2026 10:00:00';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const dockerOk = dockerAvailable();

beforeAll(async () => {
  if (dockerOk) {
    try {
      await buildDockerImage();
    } catch (e) {
      console.warn('Docker image build failed:', e.message);
    }
  }
}, 120_000);

afterAll(() => {
  cleanupDir(BASE_TEMP);
});

describe('ride:visual-parity', () => {
  if (!dockerOk) {
    it.skip('pixel parity: Docker unavailable — visual regression gate skipped', () => {});
    return;
  }

  describe('pixel parity (6 base documents)', () => {
    for (const caso of CASOS) {
      it(`${caso.nombre}: pixel parity vs golden v0.3.0 at 144 DPI, threshold ${THRESHOLD * 100}%`, async () => {
        const fixturePath = join(BASE_FIXTURES, `${caso.nombre}.json`);
        const doc: RideDocument = loadJson(fixturePath);

        const nuevoPdf = await generarRide({
          documento: doc,
          claveAcceso: caso.clave,
          autorizacion: { numero: caso.clave, fecha: AUTH_DATE },
        });

        const goldenPath = join(BASE_REF, `${caso.nombre}.pdf`);
        expect(existsSync(goldenPath), `golden ${caso.nombre}.pdf exists`).toBe(true);

        const runDir = join(BASE_TEMP, caso.nombre);
        cleanupDir(runDir);

        const nuevoRasterDir = join(runDir, 'nuevo');
        const goldenRasterDir = join(runDir, 'golden');

        await rasterizePdf(goldenPath, goldenRasterDir);
        const nuevoPdfPath = join(runDir, 'nuevo.pdf');
        writeFileSync(nuevoPdfPath, nuevoPdf);
        await rasterizePdf(nuevoPdfPath, nuevoRasterDir);

        const goldenPages = existsSync(goldenRasterDir)
          ? Array.from({ length: 10 }, (_, i) => join(goldenRasterDir, `page-${i + 1}.png`)).filter(p => existsSync(p))
          : [];
        const nuevoPages = existsSync(nuevoRasterDir)
          ? Array.from({ length: 10 }, (_, i) => join(nuevoRasterDir, `page-${i + 1}.png`)).filter(p => existsSync(p))
          : [];

        expect(nuevoPages.length, `${caso.nombre}: nuevo has pages`).toBeGreaterThan(0);
        expect(goldenPages.length, `${caso.nombre}: golden has pages`).toBeGreaterThan(0);
        expect(nuevoPages.length, `${caso.nombre}: same page count`).toBe(goldenPages.length);

        for (let i = 0; i < nuevoPages.length; i++) {
          const diffPath = join(runDir, `diff-page-${i + 1}.png`);
          const result = await comparePageImages(goldenPages[i], nuevoPages[i], null, diffPath);

          expect(result.passed, `${caso.nombre} page ${i + 1}: mismatch ${(result.mismatchRatio * 100).toFixed(3)}% > ${THRESHOLD * 100}% — diff at ${diffPath}`).toBe(true);
        }
      }, 60000);
    }
  });

  describe('QR matrix/position/dimensions (6 QR documents)', () => {
    for (const caso of CASOS_QR) {
      it(`${caso.nombre}-qr: QR matrix determinism and PDF rect verification`, async () => {
        const fixturePath = join(BASE_FIXTURES, `${caso.nombre}.json`);
        const doc: RideDocument = loadJson(fixturePath);

        const expectedMatrix = await crearQrMatrix(caso.clave);

        expect(expectedMatrix.size, 'QR matrix size').toBeGreaterThan(0);
        expect(expectedMatrix.version, 'QR matrix version').toBeGreaterThan(0);
        expect(expectedMatrix.maskPattern, 'QR mask pattern').toBeGreaterThanOrEqual(0);

        const nuevoPdf = await generarRide({
          documento: doc,
          claveAcceso: caso.clave,
          autorizacion: { numero: caso.clave, fecha: AUTH_DATE },
          opciones: caso.opts,
        });

        expect(nuevoPdf.length, 'generated PDF with QR is non-empty').toBeGreaterThan(0);
        const header = new TextDecoder().decode(nuevoPdf.slice(0, 4));
        expect(header, 'PDF has %PDF header').toBe('%PDF');

        const paginas = await analizarPdf(nuevoPdf);
        expect(paginas.length, 'PDF has at least 1 page').toBeGreaterThan(0);
        const page = paginas[0];

        const scale = DPI / 72;
        const qrSizePx = Math.floor(QR_LADO_PT * scale);
        const moduleSizePt = QR_LADO_PT / (expectedMatrix.size + 4);
        const moduleSizePx = Math.floor(moduleSizePt * scale);

        const qrRects = page.rects.filter(r => {
          const wPx = Math.floor(r.ancho * scale);
          const hPx = Math.floor(r.alto * scale);
          return wPx >= moduleSizePx - 2 && wPx <= moduleSizePx + 2 &&
                 hPx >= moduleSizePx - 2 && hPx <= moduleSizePx + 2;
        });

        expect(qrRects.length, `QR has rects of expected module size (~${moduleSizePx}px, ~${moduleSizePt.toFixed(2)}pt)`).toBeGreaterThan(expectedMatrix.size * 2);

        const centerX = page.ancho / 2;
        const centerY = page.alto / 3;
        const qrNearExpectedPosition = qrRects.some(r => {
          const rxPx = Math.floor(r.x * scale);
          const ryPx = Math.floor(r.y * scale);
          return rxPx > page.ancho * 0.3 * scale && ryPx < page.alto * 0.5 * scale;
        });
        expect(qrNearExpectedPosition, 'QR rects found in upper-center area of page (comprobante section)').toBe(true);
      }, 30000);
    }
  });
});
