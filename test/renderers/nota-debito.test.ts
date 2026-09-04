import { describe, expect, it } from 'vitest';
import { generarRideNotaDebito } from '../../src/renderers/nota-debito.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const notaDebitoMinima = {
  tipo: '05' as const,
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
  totalSinImpuestos: '100.00',
  impuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: '100.00', valor: '12.00' }],
  valorTotal: '112.00',
  pagos: [{ formaPago: '01', total: '112.00' }],
  motivos: [{ razon: 'Ajuste por flete', valor: '12.00' }],
};

describe('ride:renderer:nota-debito', () => {
  it('generarRideNotaDebito produces valid PDF', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideNotaDebito includes RUC del emisor', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideNotaDebito incluye razón social del comprador', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('CLIENTE TEST S.A.');
  });

  it('generarRideNotaDebito incluye razón social del emisor', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideNotaDebito includes valor total', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('VALOR TOTAL');
  });

  it('generarRideNotaDebito incluye numDocModificado', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideNotaDebito incluye motivo', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Ajuste por flete');
  });

  it('generarRideNotaDebito incluye valor total', async () => {
    const result = await generarRideNotaDebito({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('112.00');
  });

  it('generarRideNotaDebito handles multiple motivos', async () => {
    const docMultiMotivos = {
      ...notaDebitoMinima,
      motivos: [
        { razon: 'Ajuste por flete', valor: '10.00' },
        { razon: 'Costo administrativo', valor: '2.00' },
      ],
    };
    const result = await generarRideNotaDebito({ documento: docMultiMotivos, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideNotaDebito handles infoAdicional', async () => {
    const docWithInfo = {
      ...notaDebitoMinima,
      infoAdicional: { 'Referencia': 'Nota débito Nro. 1' },
    };
    const result = await generarRideNotaDebito({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideNotaDebito handles autorizacion', async () => {
    const result = await generarRideNotaDebito({
      documento: notaDebitoMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
