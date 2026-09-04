import { generarRide } from 'generador-ride';

const CLAVE_ACCESO = '12345678901234567890123456789012345678901234567';
const LOGO_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0),
);

const facturaFixture = {
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

const liquidacionFixture = {
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

const notaCreditoFixture = {
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

const notaDebitoFixture = {
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

const guiaRemisionFixture = {
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

const retencionFixture = {
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

function getDocumento(tipo: string) {
  switch (tipo) {
    case '01': return facturaFixture;
    case '03': return liquidacionFixture;
    case '04': return notaCreditoFixture;
    case '05': return notaDebitoFixture;
    case '06': return guiaRemisionFixture;
    case '07': return retencionFixture;
    default: return facturaFixture;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') ?? '01';
    const logo = url.searchParams.get('logo') === 'true';
    const qr = url.searchParams.get('qr') === 'true';
    const auth = url.searchParams.get('auth') === 'true';

    const logoBuffer = logo ? LOGO_PNG : undefined;

    const opciones: Record<string, unknown> = {
      incluirQr: qr,
      codigoBarras: true,
    };

    const rideOptions: Record<string, unknown> = {
      documento: getDocumento(tipo),
      claveAcceso: CLAVE_ACCESO,
      ...(logoBuffer ? { logo: logoBuffer } : {}),
      ...(auth ? { autorizacion: { numero: CLAVE_ACCESO, fecha: '01/01/2024 12:00:00' } } : {}),
      opciones,
    };

    const pdfBytes = await generarRide(rideOptions as Parameters<typeof generarRide>[0]);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  },
};
