import { describe, expect, it } from 'vitest';
import { generarRideNotaCredito } from '../../src/renderers/nota-credito.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const notaCreditoMinima = {
  tipo: '04' as const,
  infoTributaria: {
    ambiente: '1' as const,
    razonSocial: 'EMPRESA TEST CIA. LTDA.',
    ruc: '1234567890001',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    dirMatriz: 'Av. Principal 123, Quito',
  },
  fechaEmision: '01/01/2024',
  tipoIdentificacionComprador: '04',
  razonSocialComprador: 'CLIENTE TEST S.A.',
  identificacionComprador: '1234567890001',
  codDocModificado: '01',
  numDocModificado: '001-001-000000001',
  fechaEmisionDocSustento: '01/01/2024',
  totalSinImpuestos: '50.00',
  valorModificacion: '56.00',
  totalConImpuestos: [
    { codigo: '2', codigoPorcentaje: '2', baseImponible: '50.00', valor: '6.00' },
  ],
  detalles: [
    {
      descripcion: 'Item test',
      cantidad: '1.000000',
      precioUnitario: '50.00',
      descuento: '0.00',
      precioTotalSinImpuesto: '50.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '50.00', valor: '6.00' }],
    },
  ],
  motivo: 'Devolución por defecto',
};

describe('ride:renderer:nota-credito', () => {
  it('generarRideNotaCredito produces valid PDF', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideNotaCredito includes RUC del emisor', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideNotaCredito incluye razón social del comprador', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('CLIENTE TEST S.A.');
  });

  it('generarRideNotaCredito incluye razón social del emisor', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideNotaCredito includes motivo label', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Razón de Modificación:');
  });

  it('generarRideNotaCredito incluye numDocModificado', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideNotaCredito incluye motivo', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Devolución por defecto');
  });

  it('generarRideNotaCredito includes valor modificación', async () => {
    const result = await generarRideNotaCredito({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('56.00');
  });

  it('generarRideNotaCredito handles infoAdicional', async () => {
    const docWithInfo = {
      ...notaCreditoMinima,
      infoAdicional: { 'Observación': 'Nota de crédito por devolución' },
    };
    const result = await generarRideNotaCredito({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideNotaCredito handles autorizacion', async () => {
    const result = await generarRideNotaCredito({
      documento: notaCreditoMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
