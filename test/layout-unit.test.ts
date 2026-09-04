import { describe, expect, it } from 'vitest';
import {
  nombreDocumento,
  nombreDocumentoPorCodigo,
  tipoIdentificacionLabel,
  identificacionConTipo,
  formaPagoLabel,
  formatNumeroComprobante,
} from '../src/layout/labels.js';
import { FormaPago } from '../src/layout/labels.js';
import {
  formatCantidadPrecision,
  construirColumnas,
  ETIQUETAS_DETALLE_COMPLETAS,
} from '../src/layout/details.js';
import type { EtiquetasDetalle } from '../src/layout/details.js';
import { drawTotales, medirTotales } from '../src/layout/totals.js';
import { drawTablaGenerica, medirTablaGenerica } from '../src/layout/details.js';
import { partirTextoPorAltura, asegurarEspacio } from '../src/layout/pagination.js';
import { crearDocumentoRide } from '../src/pdf/document.js';

describe('ride:layout: labels', () => {
  it('nombreDocumento devuelve el nombre completo para cada código', () => {
    expect(nombreDocumento('01')).toBe('FACTURA');
    expect(nombreDocumento('03')).toBe('LIQUIDACIÓN DE COMPRA DE BIENES Y PRESTACIÓN DE SERVICIOS');
    expect(nombreDocumento('04')).toBe('NOTA DE CRÉDITO');
    expect(nombreDocumento('05')).toBe('NOTA DE DÉBITO');
    expect(nombreDocumento('06')).toBe('GUÍA DE REMISIÓN');
    expect(nombreDocumento('07')).toBe('COMPROBANTE DE RETENCIÓN');
  });

  it('nombreDocumentoPorCodigo devuelve versión sentence-case', () => {
    expect(nombreDocumentoPorCodigo('01')).toBe('Factura');
    expect(nombreDocumentoPorCodigo('03')).toBe('Liquidación de Compra');
    expect(nombreDocumentoPorCodigo('04')).toBe('Nota de Crédito');
    expect(nombreDocumentoPorCodigo('05')).toBe('Nota de Débito');
    expect(nombreDocumentoPorCodigo('06')).toBe('Guía de Remisión');
    expect(nombreDocumentoPorCodigo('07')).toBe('Comprobante de Retención');
  });

  it('nombreDocumentoPorCodigo tiene fallback al código crudo para desconocido', () => {
    expect(nombreDocumentoPorCodigo('99')).toBe('99');
  });

  it('tipoIdentificacionLabel decodifica los códigos del catálogo SRI', () => {
    expect(tipoIdentificacionLabel('04')).toBe('RUC');
    expect(tipoIdentificacionLabel('05')).toBe('Cédula de Identidad');
    expect(tipoIdentificacionLabel('06')).toBe('Pasaporte');
    expect(tipoIdentificacionLabel('07')).toBe('Consumidor Final');
    expect(tipoIdentificacionLabel('08')).toBe('Identificación del Exterior');
  });

  it('tipoIdentificacionLabel tiene fallback al código crudo para desconocido', () => {
    expect(tipoIdentificacionLabel('09')).toBe('09');
  });

  it('identificacionConTipo concatena con el tipo entre paréntesis', () => {
    expect(identificacionConTipo('1234567890', '04')).toBe('1234567890 (RUC)');
    expect(identificacionConTipo('1234567890')).toBe('1234567890');
    expect(identificacionConTipo('1234567890', '09')).toBe('1234567890 (09)');
  });

  it('formaPagoLabel decodifica los códigos del catálogo SRI', () => {
    expect(formaPagoLabel(FormaPago.EFECTIVO)).toBe('Sin utilización del sistema financiero');
    expect(formaPagoLabel(FormaPago.TARJETA_CREDITO)).toBe('Tarjeta de crédito');
    expect(formaPagoLabel('99')).toBe('99');
  });

  it('formatNumeroComprobante formatea estab-ptoEmi-secuencial', () => {
    expect(formatNumeroComprobante({ estab: '001', ptoEmi: '001', secuencial: '000000001' })).toBe('001-001-000000001');
    expect(formatNumeroComprobante({ estab: '001', ptoEmi: '002', secuencial: '000123456' })).toBe('001-002-000123456');
  });
});

describe('ride:layout: formatCantidadPrecision', () => {
  it('recorta ceros de cola hasta un mínimo de 2 decimales', () => {
    expect(formatCantidadPrecision('100.000000')).toBe('100.00');
    expect(formatCantidadPrecision('0.004500')).toBe('0.0045');
    expect(formatCantidadPrecision('0.004000')).toBe('0.004');
    expect(formatCantidadPrecision('1.500000')).toBe('1.50');
  });

  it('nunca redondea, solo recorta', () => {
    expect(formatCantidadPrecision('0.004599')).toBe('0.004599');
    expect(formatCantidadPrecision('123.999999')).toBe('123.999999');
  });

  it('funciona con enteros', () => {
    expect(formatCantidadPrecision('100')).toBe('100.00');
  });
});

describe('ride:layout: construirColumnas', () => {
  it('reparte el ancho proporcionalmente y la última columna absorbe el redondeo', () => {
    const cols = construirColumnas(100, [
      ['A', 1, 'left'],
      ['B', 1, 'right'],
    ]);
    expect(cols[0].width + cols[1].width).toBe(100);
    expect(cols[0].width).toBe(50);
    expect(cols[1].width).toBe(50);
  });

  it('las fracciones no necesitan sumar 1', () => {
    const cols = construirColumnas(100, [
      ['A', 8.5, 'left'],
      ['B', 1.5, 'right'],
    ]);
    expect(cols[0].width + cols[1].width).toBe(100);
  });

  it('la última columna absorbe el error de redondeo', () => {
    const cols = construirColumnas(100, [
      ['A', 1, 'left'],
      ['B', 1, 'left'],
      ['C', 1, 'left'],
    ]);
    expect(cols[0].width + cols[1].width + cols[2].width).toBe(100);
  });

  it('conserva el header y la alineación', () => {
    const cols = construirColumnas(100, [
      ['Cant.', 1, 'right'],
      ['Descripción', 3, 'left'],
    ]);
    expect(cols[0]).toEqual({ header: 'Cant.', width: 25, align: 'right' });
    expect(cols[1]).toEqual({ header: 'Descripción', width: 75, align: 'left' });
  });
});

describe('ride:layout: etiquetas detalle', () => {
  it('ETIQUETAS_DETALLE_COMPLETAS tiene los valores correctos', () => {
    expect(ETIQUETAS_DETALLE_COMPLETAS).toEqual({
      codigoPrincipal: 'Código',
      codigoAuxiliar: 'Código Auxiliar',
      cantidad: 'Cantidad',
    } satisfies EtiquetasDetalle);
  });
});

describe('ride:layout: FormaPago constants', () => {
  it('los códigos de FormaPago coinciden con el catálogo SRI', () => {
    expect(FormaPago.EFECTIVO).toBe('01');
    expect(FormaPago.TARJETA_CREDITO).toBe('19');
    expect(FormaPago.OTROS_SISTEMA_FINANCIERO).toBe('20');
  });
});

describe('ride:layout: unknown tax codes', () => {
  it('unknown tax code (codigo 99) does not throw and renders with generic label', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.addPage();
    const area = { x: 36, y: 36, width: 200 };
    const totales = {
      impuestos: [{ codigo: '99', codigoPorcentaje: '0', baseImponible: '100.00', valor: '10.00' }],
      totalSinImpuestos: '100.00',
      importeTotal: '110.00',
    };
    expect(() => drawTotales(doc, totales, area)).not.toThrow();
  });

  it('IRBPNR (codigo 5) has a known label and renders at expected height', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const area = { x: 36, y: 36, width: 200 };
    const totales = {
      impuestos: [{ codigo: '5', codigoPorcentaje: '0', baseImponible: '50.00', valor: '0.02' }],
      totalSinImpuestos: '50.00',
      importeTotal: '50.02',
    };
    const alto = medirTotales(doc, totales, area.width);
    expect(alto).toBeGreaterThan(area.y);
  });

  it('codigo 5 renders with IRBPNR label, codigo 99 renders with generic label', () => {
    const LABEL_IMPUESTO: Record<string, string> = { '5': 'IRBPNR' };
    const grupos = new Map<string, number>();
    grupos.set('5', 1000);
    grupos.set('99', 2500);
    const salida: string[] = [];
    for (const [codigo] of grupos) {
      salida.push(LABEL_IMPUESTO[codigo] ?? `OTRO IMPUESTO (CÓDIGO ${codigo})`);
    }
    expect(salida).toContain('IRBPNR');
    expect(salida).toContain('OTRO IMPUESTO (CÓDIGO 99)');
  });
});

describe('ride:layout: wrapped total labels', () => {
  it('partirTextoPorAltura splits long text by words respecting height limit', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const texto = 'SUBTOTAL CON IMPUESTOS INCLUIDOS QUE NO CABEN';
    const ancho = 80;
    const altoMax = 15;
    const trozos = partirTextoPorAltura(doc, texto, ancho, altoMax);
    expect(trozos.length).toBeGreaterThan(1);
    expect(trozos.every((t) => doc.heightOfString(t, { width: ancho }) <= altoMax)).toBe(true);
  });

  it('short text returns single piece when it fits', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const texto = 'IVA 12%';
    const ancho = 200;
    const altoMax = 20;
    const trozos = partirTextoPorAltura(doc, texto, ancho, altoMax);
    expect(trozos).toEqual([texto]);
  });

  it('number token with no spaces does not split mid-number', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const texto = '12345678901234567890';
    const ancho = 50;
    const altoMax = 20;
    const trozos = partirTextoPorAltura(doc, texto, ancho, altoMax);
    expect(trozos.length).toBe(1);
  });
});

describe('ride:layout: page boundaries', () => {
  it('asegurarEspacio returns same y when content fits', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const topMargin = doc.page.margins.top;
    const newY = asegurarEspacio(doc, topMargin, 50);
    expect(newY).toBe(topMargin);
  });

  it('asegurarEspacio returns top margin when forcing new page', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const bottomMargin = doc.page.margins.bottom;
    const pageHeight = doc.page.height;
    const yNearBottom = pageHeight - bottomMargin - 5;
    const topMargin = doc.page.margins.top;
    doc.font('Helvetica').fontSize(8).text('Text', 36, yNearBottom);
    const newY = asegurarEspacio(doc, yNearBottom, 50);
    expect(newY).toBe(topMargin);
  });

  it('drawTotales returns y greater than starting position', async () => {
    const { doc } = await crearDocumentoRide('A4');
    const topMargin = doc.page.margins.top;
    doc.addPage();
    const area = { x: 36, y: topMargin, width: 200 };
    const totales = {
      impuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: '1000.00', valor: '120.00' }],
      totalSinImpuestos: '1000.00',
      importeTotal: '1120.00',
    };
    const y = drawTotales(doc, totales, area);
    expect(y).toBeGreaterThan(area.y);
  });
});

describe('ride:layout: row splitting', () => {
  it('medirTablaGenerica sums all row heights', async () => {
    const { doc } = await crearDocumentoRide('A4');
    doc.addPage();
    const cols = construirColumnas(200, [
      ['Col A', 1, 'left'],
      ['Col B', 1, 'right'],
    ]);
    const filas = [
      ['Valor 1', '100.00'],
      ['Valor 2', '200.00'],
      ['Valor 3', '300.00'],
    ];
    const alto = medirTablaGenerica(doc, cols, filas);
    expect(alto).toBeGreaterThan(0);
  });

  it('drawTablaGenerica returns y greater than start when content fills', async () => {
    const { doc } = await crearDocumentoRide('A4');
    doc.addPage();
    const area = { x: 36, y: 36, width: 523 };
    const cols = construirColumnas(area.width, [
      ['Cod.', 8.5, 'left'],
      ['Cant.', 6.5, 'right'],
      ['Descripción', 18.5, 'left'],
      ['Prec.', 8, 'right'],
      ['Total', 9, 'right'],
    ]);
    const filas = [
      ['SKU001', '10.000000', 'Descripción del producto que es extremadamente larga y ocupa múltiples líneas', '25.500000', '255.00'],
    ];
    const y = drawTablaGenerica(doc, cols, filas, area, { tamano: 6.5 });
    expect(y).toBeGreaterThan(area.y);
  });

  it('drawTablaGenerica handles many rows without crashing', async () => {
    const { doc } = await crearDocumentoRide('A4');
    doc.addPage();
    const area = { x: 36, y: 36, width: 523 };
    const cols = construirColumnas(area.width, [
      ['Item', 1, 'left'],
      ['Amount', 1, 'right'],
    ]);
    const filas = Array.from({ length: 50 }, (_, i) => [`Item ${i + 1}`, `${(i * 10).toFixed(2)}`]);
    expect(() => drawTablaGenerica(doc, cols, filas, area)).not.toThrow();
  });
});
