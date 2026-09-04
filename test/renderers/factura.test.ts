import { describe, expect, it } from 'vitest';
import { generarRideFactura } from '../../src/renderers/factura.js';
import { extractTextFromPdf } from '../helpers/pdf-text.js';

const CLAVE_ACCESO_VALIDA = '12345678901234567890123456789012345678901234567';

const facturaMinima = {
  tipo: '01' as const,
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
  totalSinImpuestos: '100.00',
  totalDescuento: '10.00',
  importeTotal: '112.00',
  totalConImpuestos: [
    { codigo: '2', codigoPorcentaje: '2', baseImponible: '100.00', valor: '12.00' },
  ],
  detalles: [
    {
      descripcion: 'Producto test',
      cantidad: '1.000000',
      precioUnitario: '100.00',
      descuento: '10.00',
      precioTotalSinImpuesto: '100.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }],
    },
  ],
  pagos: [{ formaPago: '01', total: '112.00' }],
};

describe('ride:renderer:factura', () => {
  it('generarRideFactura produces a non-empty PDF buffer', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura produces valid PDF with %PDF header', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const header = new TextDecoder().decode(result.slice(0, 4));
    expect(header).toBe('%PDF');
  });

  it('generarRideFactura includes RUC del emisor', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890001');
  });

  it('generarRideFactura includes razón social del emisor', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('EMPRESA TEST CIA. LTDA.');
  });

  it('generarRideFactura includes razón social del comprador', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('CLIENTE TEST S.A.');
  });

  it('generarRideFactura includes número de factura formateado', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('001-001-000000001');
  });

  it('generarRideFactura includes valor total label', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('VALOR TOTAL');
  });

  it('generarRideFactura incluye valor total', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('112.00');
  });

  it('generarRideFactura incluye IVA label', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('IVA');
  });

  it('generarRideFactura incluye dirección matriz', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Av. Principal 123, Quito');
  });

  it('generarRideFactura incluye fecha de emisión', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('01/01/2024');
  });

  it('generarRideFactura incluye descripción del producto', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('Producto test');
  });

  it('generarRideFactura incluye clave de acceso (primeros dígitos)', async () => {
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    const content = await extractTextFromPdf(result);
    expect(content.text).toContain('1234567890');
  });

  it('generarRideFactura maneja infoAdicional', async () => {
    const docWithInfo = {
      ...facturaMinima,
      infoAdicional: { 'Email': 'test@example.com', 'Teléfono': '1234567' },
    };
    const result = await generarRideFactura({ documento: docWithInfo, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja direccionComprador', async () => {
    const docWithDireccion = {
      ...facturaMinima,
      direccionComprador: 'Calle Falsa 123, Quito',
    };
    const result = await generarRideFactura({ documento: docWithDireccion, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja guiaRemision', async () => {
    const docWithGuia = {
      ...facturaMinima,
      guiaRemision: '001-001-000000001',
    };
    const result = await generarRideFactura({ documento: docWithGuia, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja moneda', async () => {
    const docWithMoneda = {
      ...facturaMinima,
      moneda: 'USD',
    };
    const result = await generarRideFactura({ documento: docWithMoneda, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja PROPINA', async () => {
    const docWithPropina = {
      ...facturaMinima,
      propina: '5.00',
    };
    const result = await generarRideFactura({ documento: docWithPropina, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja logo (PNG válido)', async () => {
    const logoBuffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    const result = await generarRideFactura({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA, logo: logoBuffer });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja autorizacion', async () => {
    const result = await generarRideFactura({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja LETTER size', async () => {
    const result = await generarRideFactura({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      opciones: { tamano: 'LETTER' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja codigoBarras false', async () => {
    const result = await generarRideFactura({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      opciones: { codigoBarras: false },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja multiple details', async () => {
    const docMultiDetalle = {
      ...facturaMinima,
      detalles: [
        {
          descripcion: 'Producto 1',
          cantidad: '2.000000',
          precioUnitario: '50.00',
          descuento: '5.00',
          precioTotalSinImpuesto: '100.00',
          impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }],
        },
        {
          descripcion: 'Producto 2',
          cantidad: '1.000000',
          precioUnitario: '50.00',
          descuento: '5.00',
          precioTotalSinImpuesto: '50.00',
          impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '50.00', valor: '6.00' }],
        },
      ],
    };
    const result = await generarRideFactura({ documento: docMultiDetalle, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja multiple pagos', async () => {
    const docMultiPagos = {
      ...facturaMinima,
      pagos: [
        { formaPago: '01', total: '100.00' },
        { formaPago: '19', total: '12.00', plazo: '30', unidadTiempo: 'días' },
      ],
    };
    const result = await generarRideFactura({ documento: docMultiPagos, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRideFactura maneja details with detallesAdicionales', async () => {
    const docConExtras = {
      ...facturaMinima,
      detalles: [
        {
          descripcion: 'Producto test',
          cantidad: '1.000000',
          precioUnitario: '100.00',
          descuento: '10.00',
          precioTotalSinImpuesto: '100.00',
          impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }],
          detallesAdicionales: { 'Marca': 'TestBrand', 'Modelo': 'X100', 'Color': 'Negro' },
        },
      ],
    };
    const result = await generarRideFactura({ documento: docConExtras, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
