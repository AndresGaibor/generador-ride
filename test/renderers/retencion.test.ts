import { describe, expect, it } from 'vitest';
import { generarRideRetencion } from '../../src/renderers/retencion.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const retencionMinima = {
  tipo: '07' as const,
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
  dirEstablecimiento: 'Av. Principal 123, Quito',
  tipoIdentificacionSujetoRetenido: '04',
  razonSocialSujetoRetenido: 'SUJETO RETENIDO TEST',
  identificacionSujetoRetenido: '1234567890001',
  periodoFiscal: '012024',
  docsSustento: [
    {
      codSustento: '1',
      codDocSustento: '01',
      numDocSustento: '001-001-000000001',
      fechaEmisionDocSustento: '01/01/2024',
      totalSinImpuestos: '1000.00',
      importeTotal: '1120.00',
      impuestosDocSustento: [
        { codImpuestoDocSustento: '2', codigoPorcentaje: '2', baseImponible: '1000.00', tarifa: '12', valorImpuesto: '120.00' },
      ],
      retenciones: [
        { codigo: '2', codigoRetencion: '22', baseImponible: '1000.00', porcentajeRetener: '10', valorRetenido: '120.00' },
      ],
      pagos: [{ formaPago: '01', total: '1120.00' }],
    },
  ],
};

describe('ride:renderer:retencion', () => {
  it('generarRideRetencion produces valid PDF', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideRetencion includes RUC del emisor', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideRetencion incluye razón social del sujeto retenido', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('SUJETO RETENIDO TEST');
  });

  it('generarRideRetencion incluye razón social del emisor', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideRetencion includes sujeto retenido', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('SUJETO RETENIDO TEST');
  });

  it('generarRideRetencion incluye número de retención', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideRetencion includes numDocSustento', async () => {
    const result = await generarRideRetencion({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideRetencion handles multiple retenciones', async () => {
    const docMultiRet = {
      ...retencionMinima,
      docsSustento: [
        {
          ...retencionMinima.docsSustento[0],
          retenciones: [
            { codigo: '2', codigoRetencion: '22', baseImponible: '1000.00', porcentajeRetener: '10', valorRetenido: '120.00' },
            { codigo: '1', codigoRetencion: '301', baseImponible: '1000.00', porcentajeRetener: '1', valorRetenido: '10.00' },
          ],
        },
      ],
    };
    const result = await generarRideRetencion({ documento: docMultiRet, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideRetencion handles infoAdicional', async () => {
    const docWithInfo = {
      ...retencionMinima,
      infoAdicional: { 'Dirección': 'Av. Test 789, Quito' },
    };
    const result = await generarRideRetencion({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideRetencion handles autorizacion', async () => {
    const result = await generarRideRetencion({
      documento: retencionMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
