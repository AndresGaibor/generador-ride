import { describe, expect, it } from 'vitest';
import { RideError, generarRide } from '../src/index.js';

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

const guiaRemisionMinima = {
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

describe('ride:dispatcher', () => {
  it('generarRide dispatches to factura renderer for tipo 01', async () => {
    const result = await generarRide({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide dispatches to liquidacion-compra renderer for tipo 03', async () => {
    const result = await generarRide({ documento: liquidacionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide dispatches to nota-credito renderer for tipo 04', async () => {
    const result = await generarRide({ documento: notaCreditoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide dispatches to nota-debito renderer for tipo 05', async () => {
    const result = await generarRide({ documento: notaDebitoMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide dispatches to guia-remision renderer for tipo 06', async () => {
    const result = await generarRide({ documento: guiaRemisionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide dispatches to retencion renderer for tipo 07', async () => {
    const result = await generarRide({ documento: retencionMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide throws RIDE_UNSUPPORTED_DOCUMENT for unknown tipo', async () => {
    await expect(
      generarRide({ documento: { tipo: '99' } as any, claveAcceso: CLAVE_ACCESO_VALIDA }),
    ).rejects.toThrow('Tipo de comprobante no soportado por el RIDE.');
    await expect(
      generarRide({ documento: { tipo: '99' } as any, claveAcceso: CLAVE_ACCESO_VALIDA }),
    ).rejects.toMatchObject({ code: 'RIDE_UNSUPPORTED_DOCUMENT' });
  });

  it('generarRide passes logo option through', async () => {
    const logoBuffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    const result = await generarRide({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA, logo: logoBuffer });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide passes autorizacion option through', async () => {
    const result = await generarRide({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      autorizacion: { numero: CLAVE_ACCESO_VALIDA, fecha: '01/01/2024 12:00:00' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide uses codigoBarras option (default true)', async () => {
    const result = await generarRide({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide uses tamano option (default A4)', async () => {
    const result = await generarRide({ documento: facturaMinima, claveAcceso: CLAVE_ACCESO_VALIDA });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide handles LETTER size', async () => {
    const result = await generarRide({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      opciones: { tamano: 'LETTER' },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generarRide handles codigoBarras false', async () => {
    const result = await generarRide({
      documento: facturaMinima,
      claveAcceso: CLAVE_ACCESO_VALIDA,
      opciones: { codigoBarras: false },
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
