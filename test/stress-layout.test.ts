import { describe, expect, it } from 'vitest';
import { generarRide } from '../src/index.js';
import { analizarPdf } from './pdf-analysis.js';
import { esperarRectangulosSanos, esperarEtiquetasConSuImporte, cajaDe, localizar, tieneBordeAlrededor } from './helpers/pdf-assertions.js';
import type { FacturaDocument, NotaCreditoDocument, LiquidacionCompraDocument, NotaDebitoDocument, GuiaRemisionDocument, RetencionDocument, Pago } from '../src/index.js';
import type { RideDocument } from '../src/types.js';

const CLAVE_FACTURA = '0308202601179001100100110010010000000011234567817';
const CLAVE_NC = '0308202604179001100100110010010000000031234567817';
const CLAVE_LC = '0308202603179001100100110010010000000021234567815';
const CLAVE_ND = '0308202605179001100100110010010000000041234567819';
const CLAVE_GR = '0308202606179001100100110010010000000051234567810';
const CLAVE_RET = '0308202607179001100100110010010000000061234567812';

const ETIQUETAS_TOTALES = [
  'VALOR TOTAL',
  'SUBTOTAL SIN IMPUESTOS',
  'SUBTOTAL IVA 0%',
  'SUBTOTAL NO OBJETO IVA',
  'SUBTOTAL EXENTO IVA',
  'DESCUENTO',
  'IVA',
  'ICE',
  'PROPINA',
  'SUBTOTAL 0%',
  'SUBTOTAL NO OBJETO DE IVA',
  'SUBTOTAL EXENTO DE IVA',
  'TOTAL DESCUENTO',
];

const INFO_ADICIONAL_6 = {
  Email: 'cliente@example.com',
  Telefono: '0999999999',
  Direccion: 'Calle Falsa 123, Quito',
  Vendedor: 'Ana Torres',
  Observacion: 'Entrega en bodega',
  OrdenCompra: 'OC-2026-0001',
};

function facturaBase(): FacturaDocument {
  return {
    tipo: '01',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'COMERCIAL AMEPHIA S.A.',
      nombreComercial: 'AMEPHIA',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000001',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    fechaEmision: '03/08/2026',
    tipoIdentificacionComprador: '05',
    razonSocialComprador: 'Juan Pérez',
    identificacionComprador: '1710034065',
    totalSinImpuestos: '100.00',
    totalDescuento: '0.00',
    importeTotal: '112.00',
    obligadoContabilidad: 'SI',
    totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', valor: '12.00' }],
    detalles: [{
      codigoPrincipal: 'PROD001',
      descripcion: 'Servicio de consultoría',
      cantidad: '1.000000',
      precioUnitario: '100.000000',
      descuento: '0.00',
      precioTotalSinImpuesto: '100.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '4', tarifa: '12.00', baseImponible: '100.00', valor: '12.00' }],
    }],
    pagos: [{ formaPago: '01', total: '112.00' }],
  };
}

function notaCreditoBase(): NotaCreditoDocument {
  return {
    tipo: '04',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'COMERCIAL AMEPHIA S.A.',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000003',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    fechaEmision: '03/08/2026',
    dirEstablecimiento: 'Av. Amazonas N24-03, Quito',
    tipoIdentificacionComprador: '05',
    razonSocialComprador: 'Juan Pérez',
    identificacionComprador: '1710034065',
    contribuyenteEspecial: '5368',
    obligadoContabilidad: 'SI',
    codDocModificado: '01',
    numDocModificado: '001-001-000000001',
    fechaEmisionDocSustento: '01/08/2026',
    totalSinImpuestos: '100.00',
    valorModificacion: '112.00',
    moneda: 'DOLAR',
    totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', valor: '12.00' }],
    detalles: [{
      codigoInterno: 'PROD001',
      descripcion: 'Devolución: servicio de consultoría',
      cantidad: '1.000000',
      precioUnitario: '100.000000',
      descuento: '0.00',
      precioTotalSinImpuesto: '100.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '4', tarifa: '12.00', baseImponible: '100.00', valor: '12.00' }],
    }],
    motivo: 'Devolución de mercadería',
  };
}

function liquidacionBase(): LiquidacionCompraDocument {
  return {
    tipo: '03',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'COMERCIAL AMEPHIA S.A.',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000002',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    fechaEmision: '03/08/2026',
    dirEstablecimiento: 'Av. Amazonas N24-03, Quito',
    contribuyenteEspecial: '5368',
    obligadoContabilidad: 'SI',
    tipoIdentificacionProveedor: '05',
    razonSocialProveedor: 'María Gómez',
    identificacionProveedor: '1710034065',
    direccionProveedor: 'Calle Sucre 456, Quito',
    totalSinImpuestos: '50.00',
    totalDescuento: '0.00',
    importeTotal: '56.00',
    moneda: 'DOLAR',
    totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '50.00', valor: '6.00' }],
    detalles: [{
      codigoPrincipal: 'PROD002',
      descripcion: 'Compra de maíz duro',
      cantidad: '10.000000',
      precioUnitario: '5.000000',
      descuento: '0.00',
      precioTotalSinImpuesto: '50.00',
      impuestos: [{ codigo: '2', codigoPorcentaje: '4', tarifa: '12.00', baseImponible: '50.00', valor: '6.00' }],
    }],
    pagos: [{ formaPago: '01', total: '56.00' }],
  };
}

function guiaRemisionBase(): GuiaRemisionDocument {
  return {
    tipo: '06',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'COMERCIAL AMEPHIA S.A.',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000005',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    dirEstablecimiento: 'Av. Amazonas N24-03, Quito',
    dirPartida: 'Bodega Central, Av. Eloy Alfaro N32-100, Quito',
    razonSocialTransportista: 'Transportes Rápidos S.A.',
    tipoIdentificacionTransportista: '04',
    rucTransportista: '1790011001001',
    obligadoContabilidad: 'SI',
    contribuyenteEspecial: '5368',
    fechaIniTransporte: '03/08/2026',
    fechaFinTransporte: '04/08/2026',
    placa: 'PBX1234',
    destinatarios: [{
      identificacionDestinatario: '1710034065',
      razonSocialDestinatario: 'Juan Pérez',
      dirDestinatario: 'Calle Falsa 123, Quito',
      motivoTraslado: 'Venta',
      codDocSustento: '01',
      numDocSustento: '001-001-000000001',
      numAutDocSustento: '1234567890123',
      fechaEmisionDocSustento: '03/08/2026',
      detalles: [{
        codigoInterno: 'PROD001',
        descripcion: 'Caja de repuestos',
        cantidad: '5.00',
      }],
    }],
  };
}

function retencionBase(): RetencionDocument {
  return {
    tipo: '07',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'AGENTE RETENCION S.A.',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000006',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    fechaEmision: '03/08/2026',
    dirEstablecimiento: 'Av. Amazonas N24-03, Quito',
    contribuyenteEspecial: '5368',
    obligadoContabilidad: 'SI',
    tipoIdentificacionSujetoRetenido: '04',
    tipoSujetoRetenido: '01',
    razonSocialSujetoRetenido: 'Proveedor EC S.A.',
    identificacionSujetoRetenido: '1790011002001',
    periodoFiscal: '08/2026',
    docsSustento: [{
      codSustento: '01',
      codDocSustento: '01',
      numDocSustento: '001-001-000000100',
      fechaEmisionDocSustento: '01/08/2026',
      totalSinImpuestos: '1000.00',
      importeTotal: '1120.00',
      impuestosDocSustento: [{
        codImpuestoDocSustento: '2',
        codigoPorcentaje: '4',
        baseImponible: '1000.00',
        tarifa: '12.00',
        factorProporcionalidad: '1.00',
        baseImponibleModificada: '1000.00',
        valorImpuesto: '120.00',
      }],
      retenciones: [{
        codigo: '2',
        codigoRetencion: '303',
        baseImponible: '1000.00',
        porcentajeRetener: '10',
        valorRetenido: '100.00',
      }],
      pagos: [{ formaPago: '01', total: '1020.00' }],
    }],
  };
}

function notaDebitoBase(): NotaDebitoDocument {
  return {
    tipo: '05',
    infoTributaria: {
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'COMERCIAL AMEPHIA S.A.',
      ruc: '1790011001001',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000004',
      dirMatriz: 'Av. Amazonas N24-03 y Colón, Quito',
    },
    fechaEmision: '03/08/2026',
    dirEstablecimiento: 'Av. Amazonas N24-03, Quito',
    tipoIdentificacionComprador: '05',
    razonSocialComprador: 'Juan Pérez',
    identificacionComprador: '1710034065',
    contribuyenteEspecial: '5368',
    obligadoContabilidad: 'SI',
    rise: 'Contribuyente Régimen RISE',
    codDocModificado: '01',
    numDocModificado: '001-001-000000001',
    fechaEmisionDocSustento: '01/08/2026',
    totalSinImpuestos: '100.00',
    impuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '100.00', valor: '12.00' }],
    valorTotal: '112.00',
    pagos: [{ formaPago: '01', total: '112.00' }],
    motivos: [{ razon: 'Intereses por mora', valor: '100.00' }],
  };
}

function facturaCon(nDetalles: number, opciones: { pagos?: number; infoAdicional?: Record<string, string> } = {}): FacturaDocument {
  const base = facturaBase().detalles[0];
  const pagos: Pago[] = opciones.pagos
    ? Array.from({ length: opciones.pagos }, () => ({ formaPago: '01', total: '112.00' }))
    : [{ formaPago: '01', total: '112.00' }];
  return {
    ...facturaBase(),
    detalles: Array.from({ length: nDetalles }, (_, i) => ({
      ...base,
      codigoPrincipal: `PROD${String(i + 1).padStart(3, '0')}`,
      descripcion: `Servicio de consultoría ${i + 1}`,
    })),
    pagos,
    infoAdicional: opciones.infoAdicional ?? { Email: 'test@example.com' },
  };
}

function notaCreditoCon(nDetalles: number): NotaCreditoDocument {
  const base = notaCreditoBase().detalles[0];
  return {
    ...notaCreditoBase(),
    detalles: Array.from({ length: nDetalles }, (_, i) => ({
      ...base,
      codigoInterno: `PROD${String(i + 1).padStart(3, '0')}`,
      descripcion: `Servicio devuelto ${i + 1}`,
    })),
  };
}

function liquidacionCon(nDetalles: number): LiquidacionCompraDocument {
  const base = liquidacionBase().detalles[0];
  return {
    ...liquidacionBase(),
    detalles: Array.from({ length: nDetalles }, (_, i) => ({
      ...base,
      codigoPrincipal: `PROD${String(i + 1).padStart(3, '0')}`,
      descripcion: `Compra ${i + 1}`,
    })),
    infoAdicional: INFO_ADICIONAL_6,
  };
}

function guiaRemisionCon(nDetalles: number): GuiaRemisionDocument {
  const base = guiaRemisionBase();
  return {
    ...base,
    destinatarios: base.destinatarios.map(d => ({
      ...d,
      detalles: Array.from({ length: nDetalles }, (_, j) => ({
        codigoInterno: `PROD${String(j + 1).padStart(3, '0')}`,
        descripcion: `Bulto ${j + 1}`,
        cantidad: '5.00',
      })),
    })),
    infoAdicional: INFO_ADICIONAL_6,
  };
}

function retencionCon(nDetalles: number): RetencionDocument {
  const base = retencionBase();
  return {
    ...base,
    docsSustento: Array.from({ length: nDetalles }, (_, i) => ({
      ...base.docsSustento[0],
      numDocSustento: `001-001-${String(i + 1).padStart(9, '0')}`,
    })),
    infoAdicional: INFO_ADICIONAL_6,
  };
}

function notaDebitoCon(nDetalles: number): NotaDebitoDocument {
  const base = notaDebitoBase();
  return {
    ...base,
    motivos: Array.from({ length: nDetalles }, (_, i) => ({
      razon: `Interés ${i + 1}`,
      valor: '100.00',
    })),
    infoAdicional: INFO_ADICIONAL_6,
  };
}

describe('ride:stress:layout', () => {
  it('31 detalles + 6 campos de información adicional: ninguna caja cruza de página ni parte "VALOR TOTAL" de su importe', async () => {
    const pdf = await generarRide({ documento: facturaCon(31, { infoAdicional: INFO_ADICIONAL_6 }), claveAcceso: CLAVE_FACTURA });
    const paginas = await analizarPdf(pdf);
    esperarRectangulosSanos(paginas);
    esperarEtiquetasConSuImporte(paginas, ETIQUETAS_TOTALES);
    for (const pagina of paginas) {
      if (pagina.texto.includes('VALOR TOTAL')) {
        expect(pagina.texto).toContain('112.00');
      }
    }
    const todo = paginas.map(p => p.texto).join('\n');
    for (const [clave, valor] of Object.entries(INFO_ADICIONAL_6)) {
      expect(todo).toContain(clave);
      expect(todo).toContain(valor);
    }
    expect(todo).toContain('Información Adicional');
  });

  it('barrido de 20 a 45 filas (factura): rectángulos sanos y etiquetas con su importe en todas las páginas', async () => {
    for (let filas = 20; filas <= 45; filas++) {
      const paginas = await analizarPdf(
        await generarRide({ documento: facturaCon(filas, { infoAdicional: INFO_ADICIONAL_6 }), claveAcceso: CLAVE_FACTURA }),
      );
      esperarRectangulosSanos(paginas);
      esperarEtiquetasConSuImporte(paginas, ETIQUETAS_TOTALES);
      const todo = paginas.map(p => p.texto).join('\n');
      expect(todo, `con ${filas} filas`).toContain(`Servicio de consultoría ${filas}`);
    }
  }, 60_000);

  it('barrido de 20 a 45 filas (nota de crédito): rectángulos sanos y etiquetas con su importe en todas las páginas', async () => {
    for (let filas = 20; filas <= 45; filas++) {
      const paginas = await analizarPdf(
        await generarRide({ documento: notaCreditoCon(filas), claveAcceso: CLAVE_NC }),
      );
      esperarRectangulosSanos(paginas);
      esperarEtiquetasConSuImporte(paginas, ETIQUETAS_TOTALES);
      const todo = paginas.map(p => p.texto).join('\n');
      expect(todo, `con ${filas} filas`).toContain(`Servicio devuelto ${filas}`);
    }
  }, 60_000);

  it('sin logo, la caja del emisor se ajusta a su contenido; con logo, las dos cajas de la cabecera cierran a la misma altura', async () => {
    const sinLogo = await analizarPdf(await generarRide({ documento: facturaBase(), claveAcceso: CLAVE_FACTURA }));
    const emisorSinLogo = cajaDe(sinLogo, 'COMERCIAL AMEPHIA S.A.');
    const comprobanteSinLogo = cajaDe(sinLogo, 'R.U.C.:');

    const abajoEmisor = emisorSinLogo.y + emisorSinLogo.alto;
    const abajoComprobante = comprobanteSinLogo.y + comprobanteSinLogo.alto;
    expect(abajoComprobante - abajoEmisor).toBeGreaterThan(80);

    const logo = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);
    const conLogo = await analizarPdf(await generarRide({ documento: facturaBase(), claveAcceso: CLAVE_FACTURA, logo }));
    const emisorConLogo = cajaDe(conLogo, 'COMERCIAL AMEPHIA S.A.');
    const comprobanteConLogo = cajaDe(conLogo, 'R.U.C.:');
    expect(
      Math.abs(emisorConLogo.y + emisorConLogo.alto - (comprobanteConLogo.y + comprobanteConLogo.alto)),
    ).toBeLessThan(1);

    esperarRectangulosSanos(sinLogo);
    esperarRectangulosSanos(conLogo);
  });

  it('una fila de tabla más alta que una página: los importes van con su descripción y el encabezado se repite', async () => {
    const descripcion = Array.from({ length: 120 }, (_, i) => `linea-descripcion-${i + 1}`).join('\n');
    const documento: FacturaDocument = {
      ...facturaBase(),
      detalles: [{ ...facturaBase().detalles[0], descripcion }],
    };

    const paginas = await analizarPdf(await generarRide({ documento, claveAcceso: CLAVE_FACTURA }));

    esperarRectangulosSanos(paginas);

    const inicioDescripcion = localizar(paginas, 'linea-descripcion-1');
    expect(inicioDescripcion).toBeDefined();
    const paginaInicio = inicioDescripcion!.pagina;

    expect(paginaInicio.texto).toContain('100.00');
    expect(paginaInicio.texto).toContain('0.00');

    const paginasConDescripcion = paginas.filter(p => p.texto.includes('linea-descripcion-'));
    expect(paginasConDescripcion.length).toBeGreaterThan(1);
    for (const pagina of paginasConDescripcion) {
      expect(pagina.texto, `pág ${pagina.numero} sin encabezado de tabla`).toContain('Descripción');
      expect(pagina.texto, `pág ${pagina.numero} sin encabezado de tabla`).toContain('Precio Total');
    }

    const todo = paginas.map(p => p.texto).join('\n');
    for (const n of [1, 60, 86, 87, 120]) {
      expect(todo).toContain(`linea-descripcion-${n}`);
    }

    for (const pagina of paginasConDescripcion) {
      const item = pagina.items.find(i => i.texto.startsWith('linea-descripcion-'));
      if (item) {
        expect(tieneBordeAlrededor(pagina, item.x, item.y), `pág ${pagina.numero}: fila sin borde`).toBe(true);
      }
    }
  });

  it('30 detalles + 22 formas de pago: la tabla de formas de pago y la de totales caen en la misma página, ambas con borde', async () => {
    const paginas = await analizarPdf(
      await generarRide({ documento: facturaCon(30, { pagos: 22 }), claveAcceso: CLAVE_FACTURA }),
    );

    esperarRectangulosSanos(paginas);

    const izquierda = localizar(paginas, 'Información Adicional');
    const derecha = localizar(paginas, 'SUBTOTAL');
    const formasPago = localizar(paginas, 'Forma de Pago');
    expect(izquierda).toBeDefined();
    expect(derecha).toBeDefined();
    expect(formasPago).toBeDefined();

    expect(derecha!.pagina.numero).toBe(izquierda!.pagina.numero);
    expect(formasPago!.pagina.numero).toBe(izquierda!.pagina.numero);
    expect(Math.abs(derecha!.item.y - izquierda!.item.y)).toBeLessThan(12);

    if (izquierda) expect(tieneBordeAlrededor(izquierda.pagina, izquierda.item.x, izquierda.item.y)).toBe(true);
    if (derecha) expect(tieneBordeAlrededor(derecha.pagina, derecha.item.x, derecha.item.y)).toBe(true);
    if (formasPago) expect(tieneBordeAlrededor(formasPago.pagina, formasPago.item.x, formasPago.item.y)).toBe(true);

    esperarEtiquetasConSuImporte(paginas, ETIQUETAS_TOTALES);
    const filasPago = paginas.flatMap(p => p.items).filter(i => i.texto.includes('Sin utilización del sistema financiero'));
    expect(filasPago).toHaveLength(22);
  });

  it('una etiqueta que envuelve a varias líneas no queda pisada por la fila siguiente', async () => {
    const { crearDocumentoRide } = await import('../src/pdf/document.js');
    const { drawTotales } = await import('../src/layout/totals.js');
    const { doc, finalizar } = await crearDocumentoRide('A4');
    drawTotales(
      doc,
      {
        impuestos: [
          {
            codigo: '2',
            codigoPorcentaje: 'CODIGO-DESCONOCIDO-MUY-LARGO-QUE-ENVUELVE-EN-VARIAS-LINEAS',
            baseImponible: '100.00',
            valor: '12.00',
          },
        ],
        totalSinImpuestos: '100.00',
        importeTotal: '112.00',
      } as any,
      { x: 36, y: 36, width: 200 },
    );

    const paginas = await analizarPdf(await finalizar());
    expect(paginas).toHaveLength(1);
    const pagina = paginas[0];

    const itemUltimaLinea = pagina.items.find(i => i.texto.trim() === 'VARIAS-LINEAS');
    const itemSiguienteFila = pagina.items.find(i => i.texto.includes('SUBTOTAL'));

    if (itemUltimaLinea && itemSiguienteFila) {
      expect(itemSiguienteFila.y).not.toBeGreaterThan(itemUltimaLinea.y);
    }
    esperarRectangulosSanos(paginas);
  });

  it('un valor de información adicional más largo que una página se parte en cajas con borde, sin perder texto', async () => {
    const palabras = Array.from({ length: 1200 }, (_, i) => `palabra${i + 1}`).join(' ');
    const paginas = await analizarPdf(
      await generarRide({ documento: facturaCon(1, { infoAdicional: { Observacion: palabras } }), claveAcceso: CLAVE_FACTURA }),
    );

    esperarRectangulosSanos(paginas);
    const todo = paginas.map(p => p.texto).join(' ');
    for (const n of [1, 600, 1200]) {
      expect(todo).toContain(`palabra${n}`);
    }
    expect(todo).toContain('Información Adicional (continuación)');
  });

  const barridos: Array<[string, string, (filas: number) => RideDocument]> = [
    ['liquidación de compra', CLAVE_LC, (filas) => liquidacionCon(filas) as RideDocument],
    ['nota de débito', CLAVE_ND, (filas) => notaDebitoCon(filas) as RideDocument],
    ['guía de remisión', CLAVE_GR, (filas) => guiaRemisionCon(filas) as RideDocument],
    ['retención', CLAVE_RET, (filas) => retencionCon(filas) as RideDocument],
  ];

  for (const [nombre, clave, construir] of barridos) {
    it(`barrido de 20 a 45 filas (${nombre}): rectángulos sanos en todas las páginas`, async () => {
      for (let filas = 20; filas <= 45; filas++) {
        const paginas = await analizarPdf(await generarRide({ documento: construir(filas), claveAcceso: clave }));
        esperarRectangulosSanos(paginas);
        esperarEtiquetasConSuImporte(paginas, ETIQUETAS_TOTALES);
        const todo = paginas.map(p => p.texto).join('\n');
        expect(todo, `${nombre} con ${filas} filas`).toContain('OrdenCompra');
        expect(todo, `${nombre} con ${filas} filas`).toContain('OC-2026-0001');
      }
    }, 60_000);
  }

  it('unknown tax code (codigo 99): texto con etiqueta genérica y borde presente', async () => {
    const facturaCon99: FacturaDocument = {
      ...facturaBase(),
      totalConImpuestos: [
        { codigo: '99', codigoPorcentaje: '0', baseImponible: '100.00', valor: '10.00' },
      ],
      importeTotal: '110.00',
    };
    const paginas = await analizarPdf(
      await generarRide({ documento: facturaCon99, claveAcceso: CLAVE_FACTURA }),
    );
    esperarRectangulosSanos(paginas);
    const todo = paginas.map(p => p.texto).join('\n');
    expect(todo).toContain('OTRO IMPUESTO');
    expect(todo).toContain('10.00');
    const itemEtiqueta = paginas.flatMap(p => p.items).find(i => i.texto.includes('OTRO IMPUESTO'));
    expect(itemEtiqueta).toBeDefined();
    if (itemEtiqueta) {
      const importe = paginas.flatMap(p => p.items).find(
        i => i !== itemEtiqueta && Math.abs(i.y - itemEtiqueta.y) < 1 && /^\d+\.\d{2}$/.test(i.texto.trim()),
      );
      expect(importe, 'etiqueta unknown tax sin importe al lado').toBeDefined();
    }
  });

  it('factura sin autorización (sin clave de accesoAutorización): no falla', async () => {
    const factura = facturaBase();
    delete (factura as any).infoTributaria.claveAcceso;
    const pdf = await generarRide({ documento: factura, claveAcceso: CLAVE_FACTURA });
    const paginas = await analizarPdf(pdf);
    esperarRectangulosSanos(paginas);
    expect(paginas[0].texto).toContain('COMERCIAL AMEPHIA S.A.');
  });

  it('factura con autorización: la clave de acceso aparece', async () => {
    const pdf = await generarRide({
      documento: facturaBase(),
      claveAcceso: CLAVE_FACTURA,
      autorizacion: { numero: CLAVE_FACTURA, fecha: '03/08/2026 12:00:00' },
    });
    const paginas = await analizarPdf(pdf);
    esperarRectangulosSanos(paginas);
    expect(paginas[0].texto).toContain(CLAVE_FACTURA);
  });
});
