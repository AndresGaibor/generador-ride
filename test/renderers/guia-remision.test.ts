import { describe, expect, it } from 'vitest';
import { generarRideGuiaRemision } from '../../src/renderers/guia-remision.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const guiaMinima = {
  tipo: '06' as const,
  infoTributaria: {
    ambiente: '1' as const,
    razonSocial: 'EMPRESA TEST CIA. LTDA.',
    ruc: '1234567890001',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    dirMatriz: 'Av. Principal 123, Quito',
  },
  dirEstablecimiento: 'Av. Principal 123, Quito',
  dirPartida: 'Av. Principal 123, Quito',
  razonSocialTransportista: 'TRANSPORTISTA TEST S.A.',
  tipoIdentificacionTransportista: '04',
  rucTransportista: '1234567890001',
  fechaIniTransporte: '01/01/2024',
  fechaFinTransporte: '02/01/2024',
  placa: 'ABC-1234',
  destinatarios: [
    {
      identificacionDestinatario: '1234567890001',
      razonSocialDestinatario: 'DESTINATARIO TEST',
      dirDestinatario: 'Calle Secundaria 456, Guayaquil',
      motivoTraslado: 'Venta',
      detalles: [{ descripcion: 'Mercadería', cantidad: '10', codigoInterno: 'SKU001' }],
    },
  ],
};

describe('ride:renderer:guia-remision', () => {
  it('generarRideGuiaRemision produces valid PDF', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideGuiaRemision includes RUC del emisor', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideGuiaRemision incluye razón social del transportista', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('TRANSPORTISTA TEST S.A.');
  });

  it('generarRideGuiaRemision incluye razón social del emisor', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideGuiaRemision incluye placa', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('ABC-1234');
  });

  it('generarRideGuiaRemision incluye destinatario razon social', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('DESTINATARIO TEST');
  });

  it('generarRideGuiaRemision includes motivo traslado', async () => {
    const result = await generarRideGuiaRemision({ documento: guiaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Motivo Traslado:');
  });

  it('generarRideGuiaRemision handles multiple destinatarios', async () => {
    const docMulti = {
      ...guiaMinima,
      destinatarios: [
        ...guiaMinima.destinatarios,
        {
          identificacionDestinatario: '1234567890002',
          razonSocialDestinatario: 'OTRO DESTINATARIO',
          dirDestinatario: 'Calle Nueva 789, Cuenca',
          motivoTraslado: 'Venta',
          detalles: [{ descripcion: 'Otra mercadería', cantidad: '5', codigoInterno: 'SKU002' }],
        },
      ],
    };
    const result = await generarRideGuiaRemision({ documento: docMulti, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideGuiaRemision handles infoAdicional', async () => {
    const docWithInfo = {
      ...guiaMinima,
      infoAdicional: { 'Observaciones': 'Mercadería frágil' },
    };
    const result = await generarRideGuiaRemision({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideGuiaRemision handles autorizacion', async () => {
    const result = await generarRideGuiaRemision({
      documento: guiaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
