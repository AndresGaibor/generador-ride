import { describe, expect, it } from 'vitest';
import { generarRideLiquidacionCompra } from '../../src/renderers/liquidacion-compra.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const liquidacionMinima = {
  tipo: '03' as const,
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
  tipoIdentificacionProveedor: '04',
  razonSocialProveedor: 'PROVEEDOR TEST S.A.',
  identificacionProveedor: '1234567890001',
  totalSinImpuestos: '50.00',
  totalDescuento: '5.00',
  importeTotal: '56.00',
  totalConImpuestos: [
    { codigo: '2', codigoPorcentaje: '2', baseImponible: '50.00', valor: '6.00' },
  ],
  detalles: [
    {
      descripcion: 'Item test',
      cantidad: '1.000000',
      precioUnitario: '50.00',
      descuento: '5.00',
      precioTotalSinImpuesto: '50.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '50.00', valor: '6.00' }],
    },
  ],
  pagos: [{ formaPago: '01', total: '56.00' }],
};

describe('ride:renderer:liquidacion-compra', () => {
  it('generarRideLiquidacionCompra produces valid PDF', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideLiquidacionCompra includes RUC del emisor', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideLiquidacionCompra incluye razón social del proveedor', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('PROVEEDOR TEST S.A.');
  });

  it('generarRideLiquidacionCompra incluye razón social del emisor', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideLiquidacionCompra incluye número de liquidación', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideLiquidacionCompra includes fecha de emisión', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('01/01/2024');
  });

  it('generarRideLiquidacionCompra incluye fecha de emisión', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('01/01/2024');
  });

  it('generarRideLiquidacionCompra incluye valor total', async () => {
    const result = await generarRideLiquidacionCompra({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('56.00');
  });

  it('generarRideLiquidacionCompra handles direccionProveedor', async () => {
    const docWithDireccion = {
      ...liquidacionMinima,
      direccionProveedor: 'Calle Falsa 456, Guayaquil',
    };
    const result = await generarRideLiquidacionCompra({ documento: docWithDireccion, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideLiquidacionCompra handles infoAdicional', async () => {
    const docWithInfo = {
      ...liquidacionMinima,
      infoAdicional: { 'Email': 'test@example.com' },
    };
    const result = await generarRideLiquidacionCompra({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideLiquidacionCompra handles autorizacion', async () => {
    const result = await generarRideLiquidacionCompra({
      documento: liquidacionMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
