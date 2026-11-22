import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generarRide } from '../src/index.js';
import type { RideDocument } from '../src/types.js';
import { analizarPdf } from './pdf-analysis.js';
import type { PaginaPdf } from './pdf-analysis.js';
import { esperarRectangulosSanos } from './helpers/pdf-assertions.js';

interface CasoSri {
  nombre: string;
  fixture: string;
  clave: string;
  etiquetas: string[];
  etiquetasAusentes?: string[];
}

const CASOS: CasoSri[] = [
  {
    nombre: 'liquidación de compra',
    fixture: 'liquidacion-compra',
    clave: '0308202603179001100100110010010000000021234567815',
    etiquetas: [
      'LIQUIDACIÓN DE COMPRA',
      'PROVEEDOR',
      'Razón Social / Nombres y Apellidos:',
      'Identificación:',
      'Dirección:',
      'TOTAL DESCUENTO',
      'VALOR TOTAL',
      'Forma de pago',
    ],
  },
  {
    nombre: 'nota de crédito',
    fixture: 'nota-credito',
    clave: '0308202604179001100100110010010000000031234567817',
    etiquetas: [
      'NOTA DE CRÉDITO',
      'COMPRADOR',
      'DOCUMENTO MODIFICADO',
      'Comprobante que se modifica:',
      'MOTIVO',
      'Razón de Modificación:',
      'VALOR TOTAL',
      '112.00',
    ],
  },
  {
    nombre: 'nota de débito',
    fixture: 'nota-debito',
    clave: '0308202605179001100100110010010000000041234567819',
    etiquetas: [
      'NOTA DE DÉBITO',
      'COMPRADOR',
      'DOCUMENTO MODIFICADO',
      'MOTIVOS',
      'RAZÓN DE LA MODIFICACIÓN',
      'VALOR DE LA MODIFICACIÓN',
      'VALOR TOTAL',
    ],
    etiquetasAusentes: ['Forma de pago'],
  },
  {
    nombre: 'guía de remisión',
    fixture: 'guia-remision',
    clave: '0308202606179001100100110010010000000051234567810',
    etiquetas: [
      'GUÍA DE REMISIÓN',
      'TRANSPORTISTA',
      'Punto de Partida:',
      'DESTINATARIO',
      'Motivo Traslado:',
      'Caja de repuestos',
    ],
    etiquetasAusentes: ['VALOR TOTAL', 'Forma de pago'],
  },
  {
    nombre: 'comprobante de retención',
    fixture: 'retencion',
    clave: '0308202607179001100100110010010000000061234567812',
    etiquetas: [
      'COMPROBANTE DE RETENCIÓN',
      'SUJETO RETENIDO',
      'PERÍODO FISCAL',
      'DOCUMENTO SUSTENTO',
      'RETENCIONES',
      'VALOR RETENIDO',
      'TOTAL RETENIDO',
    ],
  },
];

function cargarFixture(nombre: string): RideDocument {
  return JSON.parse(readFileSync(new URL(`./fixtures/reference/${nombre}.json`, import.meta.url), 'utf8')) as RideDocument;
}

function esperarTextoDentroDelPapel(pagina: PaginaPdf): void {
  for (const item of pagina.items) {
    expect(item.x, `pág ${pagina.numero}: texto fuera del papel (x=${item.x})`).toBeGreaterThanOrEqual(-0.5);
    expect(item.y, `pág ${pagina.numero}: texto fuera del papel (y=${item.y})`).toBeGreaterThanOrEqual(-0.5);
    expect(item.x, `pág ${pagina.numero}: texto fuera del papel (x=${item.x})`).toBeLessThanOrEqual(pagina.ancho);
    expect(item.y, `pág ${pagina.numero}: texto fuera del papel (y=${item.y})`).toBeLessThanOrEqual(pagina.alto);
  }
}

describe('plantilla SRI en todos los comprobantes', () => {
  for (const caso of CASOS) {
    it(`emite ${caso.nombre} en una página A4 con sus etiquetas clave`, async () => {
      const pdf = await generarRide({
        documento: cargarFixture(caso.fixture),
        claveAcceso: caso.clave,
        autorizacion: { numero: caso.clave, fecha: '20/11/2026 12:03:33' },
        opciones: { plantilla: 'sri', incluirQr: false },
      });

      const paginas = await analizarPdf(pdf);
      expect(paginas).toHaveLength(1);
      const pagina = paginas[0]!;
      expect(pagina.ancho).toBeCloseTo(595, 0);
      esperarRectangulosSanos(paginas);
      esperarTextoDentroDelPapel(pagina);

      for (const etiqueta of caso.etiquetas) {
        expect(pagina.texto, `falta "${etiqueta}"`).toContain(etiqueta);
      }
      for (const etiqueta of caso.etiquetasAusentes ?? []) {
        expect(pagina.texto, `no debería aparecer "${etiqueta}"`).not.toContain(etiqueta);
      }
    });
  }
});
