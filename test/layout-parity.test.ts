import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analizarPdf } from './pdf-analysis.js';
import { esperarRectangulosSanos } from './helpers/pdf-assertions.js';
import { generarRide } from '../src/index.js';
import type { RideDocument } from '../src/types.js';

export function esperarPaginasIguales(observado: any, esperado: any, toleranciaPt = 0.5): void {
  expect(observado.length, 'diferencia en número de páginas').toBe(esperado.length);
  for (let i = 0; i < observado.length; i++) {
    const obs = observado[i];
    const esp = esperado[i];
    expect(obs.numero).toBe(esp.numero);
    expect(obs.ancho, 'ancho de página').toBeCloseTo(esp.ancho, 1);
    expect(obs.alto, 'alto de página').toBeCloseTo(esp.alto, 1);
    expect(obs.texto, 'texto de página').toBe(esp.texto);
    expect(obs.rects.length, `pág ${i + 1}: número de rectángulos`).toBe(esp.rects.length);
    for (let j = 0; j < obs.rects.length; j++) {
      const ro = obs.rects[j];
      const re = esp.rects[j];
      expect(ro.x, `pág ${i + 1} rect[${j}] x`).toBeCloseTo(re.x, toleranciaPt);
      expect(ro.y, `pág ${i + 1} rect[${j}] y`).toBeCloseTo(re.y, toleranciaPt);
      expect(ro.ancho, `pág ${i + 1} rect[${j}] ancho`).toBeCloseTo(re.ancho, toleranciaPt);
      expect(ro.alto, `pág ${i + 1} rect[${j}] alto`).toBeCloseTo(re.alto, toleranciaPt);
    }
  }
}

const BASE_REF = 'test/reference/v0.3.0';
const AUTH_DATE = '03/08/2026 10:00:00';

const CASOS: Array<[string, string, string]> = [
  ['factura', '0308202601179001100100110010010000000011234567817', 'test/fixtures/reference/factura.json'],
  ['nota-credito', '0308202604179001100100110010010000000031234567817', 'test/fixtures/reference/nota-credito.json'],
  ['nota-debito', '0308202605179001100100110010010000000041234567819', 'test/fixtures/reference/nota-debito.json'],
  ['liquidacion-compra', '0308202603179001100100110010010000000021234567815', 'test/fixtures/reference/liquidacion-compra.json'],
  ['guia-remision', '0308202606179001100100110010010000000051234567810', 'test/fixtures/reference/guia-remision.json'],
  ['retencion', '0308202607179001100100110010010000000061234567812', 'test/fixtures/reference/retencion.json'],
];

function loadJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('ride:layout-parity', () => {
  for (const [nombre, clave, docPath] of CASOS) {
    it(`compara geométricamente contra ${nombre}.pdf (páginas, texto, rects 0.5pt)`, async () => {
      const doc: RideDocument = loadJson(docPath);
      const nuevoPdf = await generarRide({
        documento: doc,
        claveAcceso: clave,
        autorizacion: { numero: clave, fecha: AUTH_DATE },
      });
      const paginasNuevo = await analizarPdf(nuevoPdf);
      const paginasRef = await analizarPdf(readFileSync(`${BASE_REF}/${nombre}.pdf`));

      esperarRectangulosSanos(paginasNuevo);
      esperarRectangulosSanos(paginasRef);
      esperarPaginasIguales(paginasNuevo, paginasRef, 0.5);
    });
  }

  it('genera consistente (determinismo documento→PDF mismo contenido)', async () => {
    const doc: RideDocument = {
      tipo: '01',
      infoTributaria: {
        ambiente: '1',
        tipoEmision: '1',
        razonSocial: 'COMERCIAL AMEPHIA S.A.',
        ruc: '1790011001001',
        estab: '001',
        ptoEmi: '001',
        secuencial: '000000001',
        dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
      },
      fechaEmision: '03/08/2026',
      tipoIdentificacionComprador: '05',
      razonSocialComprador: 'Juan Pérez',
      identificacionComprador: '1710034065',
      totalSinImpuestos: '100.00',
      totalDescuento: '0.00',
      importeTotal: '112.00',
      obligadoContabilidad: 'SI',
      totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', valor: '12.00' }],
      detalles: [{
        codigoPrincipal: 'PROD001',
        descripcion: 'Servicio de consultoría',
        cantidad: '1.000000',
        precioUnitario: '100.000000',
        descuento: '0.00',
        precioTotalSinImpuesto: '100.00',
        impuestos: [{ codigo: '2', codigoPorcentaje: '4', tarifa: '12.00', baseImponible: '100.00', valor: '12.00' }],
      }],
      pagos: [{ formaPago: '01', total: '112.00' }],
    };
    const claveAcceso = '0308202601179001100100110010010000000011234567817';
    const pdf1 = await generarRide({ documento: doc, claveAcceso });
    const pdf2 = await generarRide({ documento: doc, claveAcceso });
    const p1 = await analizarPdf(pdf1);
    const p2 = await analizarPdf(pdf2);
    esperarPaginasIguales(p1, p2);
  });
});
