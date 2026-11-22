import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generarRide } from '../src/index.js';
import type { FacturaDocument } from '../src/types.js';
import { analizarPdf } from './pdf-analysis.js';

const documento = JSON.parse(
  readFileSync(new URL('./fixtures/reference/factura.json', import.meta.url), 'utf8'),
) as FacturaDocument;
const clave = '0308202601179001100100110010010000000011234567817';

describe('plantilla SRI de factura', () => {
  it('emite el formato del reporte SRI en una página A4', async () => {
    const pdf = await generarRide({
      documento,
      claveAcceso: clave,
      autorizacion: { numero: clave, fecha: '20/11/2026 12:03:33' },
      opciones: { plantilla: 'sri', incluirQr: false },
    });

    const paginas = await analizarPdf(pdf);
    expect(paginas).toHaveLength(1);
    const texto = paginas[0]!.texto;
    expect(paginas[0]!.ancho).toBeCloseTo(595, 0);
    expect(texto).toContain('NO TIENE LOGO');
    expect(texto).toContain('NÚMERO DE AUTORIZACIÓN');
    expect(texto).toContain('SUBTOTAL 15%');
    expect(texto).toContain('SUBTOTAL NO OBJETO DE IVA');
    expect(texto).toContain('TOTAL DESCUENTO');
    expect(texto).toContain('IRBPNR');
    expect(texto).toContain('Forma de pago');
    expect(texto).not.toContain('Detalle Adicional Detalle Adicional');
  });
});
