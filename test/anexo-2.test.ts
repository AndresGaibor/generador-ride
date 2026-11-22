import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generarRide } from '../src/index.js';
import type { FacturaDocument, LiquidacionCompraDocument, RetencionDocument } from '../src/types.js';
import { analizarPdf } from './pdf-analysis.js';

const CLAVE = '1811202601125058383600120011000000000156082743519';

function fixture<T>(nombre: string): T {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/reference/${nombre}.json`, import.meta.url), 'utf8'),
  ) as T;
}

async function textoDe(
  documento: FacturaDocument | RetencionDocument | LiquidacionCompraDocument,
): Promise<string> {
  const pdf = await generarRide({
    documento,
    claveAcceso: CLAVE,
    autorizacion: { numero: CLAVE, fecha: '18/11/2026 11:10:42' },
  });
  const paginas = await analizarPdf(pdf);
  expect(paginas).toHaveLength(1);
  // El texto extraído corta las celdas de encabezado en varias líneas.
  return paginas[0]!.texto.replace(/\s+/g, ' ');
}

/**
 * Contrato del Anexo 2 de la ficha técnica del SRI (figuras 01-04): bloques,
 * etiquetas literales y columnas. Sustituye a la paridad contra teran, que
 * congelaba otra maqueta.
 */
describe('RIDE conforme al Anexo 2', () => {
  it('factura: bloques, diez columnas y totales en el orden del modelo', async () => {
    const texto = await textoDe(fixture<FacturaDocument>('factura'));

    for (const columna of [
      'Cod. Principal',
      'Cod. Auxiliar',
      'Cantidad',
      'Descripción',
      'Detalle Adicional',
      'Precio Unitario',
      'Subsidio',
      'Precio sin Subsidio',
      'Descuento',
      'Precio Total',
    ]) {
      expect(texto).toContain(columna);
    }

    const orden = [
      'Razón Social / Nombres y Apellidos:',
      'Identificación:',
      'Fecha Emisión:',
      'Placa / Matrícula:',
      'Guía Remisión:',
      'Dirección:',
      'SUBTOTAL 15%',
      'SUBTOTAL NO OBJETO DE IVA',
      'SUBTOTAL EXENTO DE IVA',
      'SUBTOTAL SIN IMPUESTOS',
      'TOTAL DESCUENTO',
      'ICE',
      'IVA 15%',
      'IRBPNR',
      'VALOR TOTAL',
    ];
    const posiciones = orden.map((etiqueta) => texto.indexOf(etiqueta));
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
    expect(texto).toContain('Forma de pago');

    // La factura del fixture no trae propina ni subsidio: no se inventan filas.
    expect(texto).not.toContain('MONEDA');
    expect(texto).not.toContain('PROPINA');
    expect(texto).not.toContain('AHORRO POR SUBSIDIO');
  });

  it('factura: imprime placa, guía, propina e información adicional cuando existen', async () => {
    const documento = fixture<FacturaDocument>('factura');
    documento.placa = 'PBX-1234';
    documento.guiaRemision = '002-001-000000123';
    documento.propina = '0.10';
    documento.infoAdicional = { Teléfono: '0984331248', Email: 'contabilidad@example.com' };

    const texto = await textoDe(documento);

    expect(texto).toContain('PBX-1234');
    expect(texto).toContain('002-001-000000123');
    expect(texto).toContain('PROPINA');
    expect(texto).toContain('Información Adicional');
    expect(texto).toContain('contabilidad@example.com');
    expect(texto.indexOf('IRBPNR')).toBeLessThan(texto.indexOf('PROPINA'));
    expect(texto.indexOf('PROPINA')).toBeLessThan(texto.indexOf('VALOR TOTAL'));
  });

  it('retención: la banda del sujeto no lleva placa, guía ni dirección', async () => {
    const texto = await textoDe(fixture<RetencionDocument>('retencion'));

    expect(texto).toContain('Razón Social / Nombres y Apellidos:');
    expect(texto).toContain('Identificación:');
    expect(texto).not.toContain('Placa / Matrícula:');
    expect(texto).not.toContain('Guía Remisión:');
    expect(texto).not.toContain('Dirección:');
  });

  it('liquidación: banda con placa y guía, totales sin ICE, IRBPNR ni devolución', async () => {
    const texto = await textoDe(fixture<LiquidacionCompraDocument>('liquidacion-compra'));

    expect(texto).toContain('Razón Social / Nombres y Apellidos:');
    expect(texto).toContain('Placa / Matrícula:');
    expect(texto).toContain('Guía Remisión:');
    expect(texto).toContain('Dirección:');
    expect(texto).not.toContain('IRBPNR');
    expect(texto).not.toContain('TOTAL DEVOLUCION IVA');
  });
});
