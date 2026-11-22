import type { FacturaDocument, RideOptions, TotalImpuesto } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { RideError } from '../errors.js';
import { dibujarCode128 } from '../barcode/code128.js';
import { crearQrMatrix, dibujarQr } from '../qr/qr-vector.js';
import { formatMonto } from '../money.js';
import { formaPagoLabel } from '../layout/labels.js';

const HELVETICA = 'Helvetica';
const HELVETICA_BOLD = 'Helvetica-Bold';
const MARGEN = 24;
const PADDING = 7;
const TINTA = '#000000';
const GRIS = '#eeeeee';
const ROJO = '#d0021b';

const AMBIENTE: Record<string, string> = { '1': 'PRUEBAS', '2': 'PRODUCCIÓN' };
const EMISION: Record<string, string> = { '1': 'NORMAL' };

interface Rect { x: number; y: number; w: number; h: number }

function texto(
  doc: PDFKit.PDFDocument,
  valor: string,
  x: number,
  y: number,
  w: number,
  opciones: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; color?: string } = {},
): number {
  doc
    .font(opciones.bold ? HELVETICA_BOLD : HELVETICA)
    .fontSize(opciones.size ?? 7)
    .fillColor(opciones.color ?? TINTA)
    .text(valor, x, y, { width: w, align: opciones.align ?? 'left', lineBreak: true });
  return doc.y;
}

function caja(doc: PDFKit.PDFDocument, r: Rect): void {
  doc.lineWidth(0.8).strokeColor(TINTA).rect(r.x, r.y, r.w, r.h).stroke();
}

function filaEtiquetaValor(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  etiqueta: string,
  valor: string,
  opciones: { etiquetaAncho?: number; bold?: boolean; etiquetaSize?: number; valorAlign?: 'left' | 'right' } = {},
): number {
  const anchoEtiqueta = opciones.etiquetaAncho ?? Math.min(88, w * 0.42);
  texto(doc, etiqueta, x, y, anchoEtiqueta, { bold: true, size: opciones.etiquetaSize ?? 6.8 });
  texto(doc, valor, x + anchoEtiqueta, y, w - anchoEtiqueta, {
    size: 6.8,
    bold: opciones.bold,
    align: opciones.valorAlign ?? 'left',
  });
  return Math.max(doc.y, y + 9);
}

function sumarImpuesto(impuestos: TotalImpuesto[], codigo: string, porcentaje?: string): number {
  return impuestos
    .filter((i) => i.codigo === codigo && (porcentaje === undefined || i.codigoPorcentaje === porcentaje))
    .reduce((total, i) => total + Number(i.valor || 0), 0);
}

function basesPorcentaje(impuestos: TotalImpuesto[], porcentaje: string): number {
  return impuestos
    .filter((i) => i.codigo === '2' && i.codigoPorcentaje === porcentaje)
    .reduce((total, i) => total + Number(i.baseImponible || 0), 0);
}

function filasTotales(documento: FacturaDocument): Array<[string, string]> {
  const impuestos = documento.totalConImpuestos;
  const filas: Array<[string, string]> = [];
  const cero = basesPorcentaje(impuestos, '0');
  if (cero > 0) filas.push(['SUBTOTAL 0%', formatMonto(cero.toFixed(2), 2)]);
  const otros = new Map<string, number>();
  for (const imp of impuestos) {
    if (imp.codigo !== '2') continue;
    if (imp.codigoPorcentaje === '0' || imp.codigoPorcentaje === '6' || imp.codigoPorcentaje === '7') continue;
    otros.set(imp.codigoPorcentaje, (otros.get(imp.codigoPorcentaje) ?? 0) + Number(imp.baseImponible || 0));
  }
  for (const [porcentaje, base] of otros) {
    const etiqueta = { '2': '12%', '3': '14%', '4': '15%', '5': '5%' }[porcentaje] ?? `${porcentaje}%`;
    filas.push([`SUBTOTAL ${etiqueta}`, formatMonto(base.toFixed(2), 2)]);
  }
  filas.push(['SUBTOTAL NO OBJETO DE IVA', formatMonto(basesPorcentaje(impuestos, '6').toFixed(2), 2)]);
  filas.push(['SUBTOTAL EXENTO DE IVA', formatMonto(basesPorcentaje(impuestos, '7').toFixed(2), 2)]);
  filas.push(['SUBTOTAL SIN IMPUESTOS', formatMonto(documento.totalSinImpuestos, 2)]);
  filas.push(['TOTAL DESCUENTO', formatMonto(documento.totalDescuento, 2)]);
  filas.push(['ICE', formatMonto(sumarImpuesto(impuestos, '3').toFixed(2), 2)]);
  const iva = sumarImpuesto(impuestos, '2');
  if (iva > 0) filas.push(['IVA', formatMonto(iva.toFixed(2), 2)]);
  filas.push(['IRBPNR', formatMonto(sumarImpuesto(impuestos, '5').toFixed(2), 2)]);
  filas.push(['PROPINA', formatMonto(documento.propina ?? '0.00', 2)]);
  filas.push(['VALOR TOTAL', formatMonto(documento.importeTotal, 2)]);
  return filas;
}

function filasComprador(documento: FacturaDocument): Array<[string, string, string, string]> {
  const identificacion = documento.tipoIdentificacionComprador
    ? `${documento.identificacionComprador} (${etiquetaIdentificacion(documento.tipoIdentificacionComprador)})`
    : documento.identificacionComprador;
  return [
    ['Razón Social / Nombres y Apellidos:', documento.razonSocialComprador, 'Identificación:', identificacion],
    ['Fecha', documento.fechaEmision, '', ''],
    ['Direccion:', documento.direccionComprador ?? '', 'Placa / Matrícula:', documento.placa ?? ''],
    ['', '', 'Guía', documento.guiaRemision ?? ''],
  ];
}

function etiquetaIdentificacion(codigo: string): string {
  const etiquetas: Record<string, string> = {
    '04': 'RUC', '05': 'Cédula de Identidad', '06': 'Pasaporte', '07': 'Consumidor Final',
    '08': 'Identificación del Exterior', '09': 'Placa',
  };
  return etiquetas[codigo] ?? codigo;
}

export async function generarRideFacturaSri(opciones: RideOptions<FacturaDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;
  doc.font(HELVETICA).fillColor(TINTA);

  const anchoPagina = doc.page.width;
  const anchoUtil = anchoPagina - MARGEN * 2;
  const y0 = MARGEN;

  const altoCabecera = 205;
  const anchoIzquierda = Math.floor(anchoUtil * 0.455);
  const anchoDerecha = anchoUtil - anchoIzquierda;

  // Cabecera izquierda: emisor
  caja(doc, { x: MARGEN, y: y0, w: anchoIzquierda, h: altoCabecera });
  let y = y0 + PADDING;
  const xIzq = MARGEN + PADDING;
  const anchoTextoIzq = anchoIzquierda - PADDING * 2;
  if (logo) {
    try {
      doc.image(logo.slice().buffer, xIzq, y, { fit: [120, 54] });
    } catch {
      throw new RideError('El logo del emisor no se pudo procesar.', 'RIDE_INVALID_LOGO');
    }
    y += 58;
  } else {
    texto(doc, 'NO TIENE LOGO', xIzq, y, anchoTextoIzq, { bold: true, size: 13, color: ROJO });
    y += 34;
  }
  texto(doc, documento.infoTributaria.razonSocial, xIzq, y, anchoTextoIzq, { bold: true, size: 8.5 });
  y = Math.max(doc.y, y + 10) + 8;
  for (const [etiqueta, valor] of [
    ['Dirección Matriz:', documento.infoTributaria.dirMatriz],
    ['Dirección Sucursal:', documento.dirEstablecimiento ?? ''],
  ] as const) {
    y = filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, etiqueta, valor, { etiquetaAncho: 92 }) + 2;
  }
  if (documento.contribuyenteEspecial) {
    y = filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, 'Contribuyente Especial Nro', documento.contribuyenteEspecial, {
      etiquetaAncho: 92,
    }) + 2;
  }
  if (documento.obligadoContabilidad) {
    filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, 'OBLIGADO A LLEVAR CONTABILIDAD', documento.obligadoContabilidad, {
      etiquetaAncho: 150,
      valorAlign: 'right',
    });
  }

  // Cabecera derecha: comprobante
  const xDer = MARGEN + anchoIzquierda;
  caja(doc, { x: xDer, y: y0, w: anchoDerecha, h: altoCabecera });
  const xTextoDer = xDer + PADDING;
  const anchoTextoDer = anchoDerecha - PADDING * 2;
  y = y0 + PADDING;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'R.U.C.:', documento.infoTributaria.ruc, { etiquetaAncho: 38 }) + 2;
  texto(doc, 'FACTURA', xTextoDer, y, anchoTextoDer, { bold: true, size: 13 });
  y = Math.max(doc.y, y + 17) + 2;
  const numero = `${documento.infoTributaria.estab}-${documento.infoTributaria.ptoEmi}-${documento.infoTributaria.secuencial}`;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'No.', numero, { etiquetaAncho: 26 }) + 4;
  texto(doc, 'NÚMERO DE AUTORIZACIÓN', xTextoDer, y, anchoTextoDer, { size: 6.8 });
  y += 9;
  texto(doc, autorizacion?.numero ?? 'COMPROBANTE NO AUTORIZADO', xTextoDer, y, anchoTextoDer, {
    bold: true,
    size: 6.5,
    color: autorizacion ? TINTA : ROJO,
  });
  y = Math.max(doc.y, y + 8) + 2;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'FECHA Y HORA DE AUTORIZACIÓN:', autorizacion?.fecha ?? '', {
    etiquetaAncho: 130,
    etiquetaSize: 6.2,
    valorAlign: 'right',
  }) + 6;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'AMBIENTE:', AMBIENTE[documento.infoTributaria.ambiente] ?? '', {
    etiquetaAncho: 108,
  }) + 2;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'EMISIÓN:', EMISION[documento.infoTributaria.tipoEmision ?? '1'] ?? '', {
    etiquetaAncho: 108,
  }) + 3;
  texto(doc, 'CLAVE DE ACCESO', xTextoDer, y, anchoTextoDer, { size: 7.5 });
  y += 12;
  dibujarCode128(doc, claveAcceso, { x: xTextoDer, y, ancho: anchoTextoDer, alto: 26 });
  y += 28;
  texto(doc, claveAcceso, xTextoDer, y, anchoTextoDer, { size: 6, align: 'center' });

  // Comprador
  y = y0 + altoCabecera + 10;
  const altoComprador = 74;
  caja(doc, { x: MARGEN, y, w: anchoUtil, h: altoComprador });
  const filasComp = filasComprador(documento);
  const altoFila = altoComprador / filasComp.length;
  for (let i = 0; i < filasComp.length; i++) {
    const [etiqueta, valor, etiquetaExtra, valorExtra] = filasComp[i]!;
    const fy = y + i * altoFila + 4;
    if (etiqueta) {
      texto(doc, etiqueta, MARGEN + PADDING, fy, 140, { bold: true, size: 6.8 });
      texto(doc, valor, MARGEN + PADDING + 140, fy, anchoUtil * 0.55 - 140 - PADDING, { size: 6.8 });
    }
    if (etiquetaExtra) {
      texto(doc, etiquetaExtra, MARGEN + anchoUtil * 0.55, fy, 76, { bold: true, size: 6.8 });
      texto(doc, valorExtra, MARGEN + anchoUtil * 0.55 + 76, fy, anchoUtil * 0.45 - 76 - PADDING, { size: 6.8 });
    }
  }

  // Detalles
  y += altoComprador + 8;
  const columnas: Array<[string, number, 'left' | 'center' | 'right']> = [
    ['Cod.\nPrincipal', 8.5, 'left'],
    ['Cod.\nAuxiliar', 7.5, 'left'],
    ['Cantidad', 6.5, 'right'],
    ['Descripción', 18.5, 'left'],
    ['Detalle Adicional', 11, 'left'],
    ['Precio Unitario', 8, 'right'],
    ['Subsidio', 6.5, 'right'],
    ['Precio sin Subsidio', 7.5, 'right'],
    ['Descuento', 7, 'right'],
    ['Precio Total', 9, 'right'],
  ];
  const suma = columnas.reduce((s, [, w]) => s + w, 0);
  const anchos = columnas.map(([, w]) => Math.floor((anchoUtil * w) / suma));
  anchos[anchos.length - 1] += anchoUtil - anchos.reduce((a, b) => a + b, 0);

  const altoEncabezado = 26;
  const dibujarEncabezadoDetalles = (): void => {
    doc.rect(MARGEN, y, anchoUtil, altoEncabezado).fillAndStroke(GRIS, TINTA);
    let x = MARGEN;
    for (let i = 0; i < columnas.length; i++) {
      texto(doc, columnas[i]![0], x + 2, y + 5, anchos[i]! - 4, { bold: true, size: 6, align: 'center' });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoEncabezado).stroke();
      x += anchos[i]!;
    }
    y += altoEncabezado;
  };
  dibujarEncabezadoDetalles();

  const altoFilaDetalle = 20;
  const limiteDetalles = doc.page.height - MARGEN - 250;
  for (const detalle of documento.detalles) {
    if (y + altoFilaDetalle > limiteDetalles) {
      doc.addPage();
      y = MARGEN;
      dibujarEncabezadoDetalles();
    }
    const extra = Object.entries(detalle.detallesAdicionales ?? {})
      .slice(0, 1)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    const celdas = [
      detalle.codigoPrincipal ?? '',
      detalle.codigoAuxiliar ?? '',
      detalle.cantidad,
      detalle.descripcion,
      extra,
      formatMonto(detalle.precioUnitario, 2),
      '0.00',
      formatMonto(detalle.precioTotalSinImpuesto, 2),
      formatMonto(detalle.descuento, 2),
      formatMonto(detalle.precioTotalSinImpuesto, 2),
    ];
    doc.lineWidth(0.6).rect(MARGEN, y, anchoUtil, altoFilaDetalle).stroke();
    let x = MARGEN;
    for (let i = 0; i < columnas.length; i++) {
      const align = columnas[i]![2];
      texto(doc, celdas[i]!, x + 3, y + 5, anchos[i]! - 6, { size: 6.8, align });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoFilaDetalle).stroke();
      x += anchos[i]!;
    }
    y += altoFilaDetalle;
  }

  // Pie: información adicional y pagos a la izquierda; totales a la derecha
  y += 10;
  const anchoTotales = Math.floor(anchoUtil * 0.405);
  const anchoPieIzq = anchoUtil - anchoTotales - 8;
  const filas = filasTotales(documento);
  const altoFilaTotal = 13;
  const xTotales = MARGEN + anchoPieIzq + 8;

  const info = Object.entries(documento.infoAdicional ?? {}).filter(([, v]) => v.trim() !== '');
  const altoInfo = Math.max(56, 18 + info.length * 12);
  const pagos = documento.pagos ?? [];
  const altoPagos = 18 + Math.max(1, pagos.length) * 14;
  if (y + Math.max(altoInfo + 4 + altoPagos, filas.length * altoFilaTotal + 35) > doc.page.height - MARGEN) {
    doc.addPage();
    y = MARGEN;
  }
  caja(doc, { x: MARGEN, y, w: anchoPieIzq, h: altoInfo });
  texto(doc, 'Información Adicional', MARGEN + PADDING, y + 5, anchoPieIzq - PADDING * 2, { size: 7, align: 'center' });
  let yi = y + 20;
  for (const [clave, valor] of info) {
    texto(doc, clave, MARGEN + PADDING, yi, anchoPieIzq * 0.32, { size: 6.5 });
    texto(doc, valor, MARGEN + PADDING + anchoPieIzq * 0.32, yi, anchoPieIzq * 0.6, { size: 6.5 });
    yi += 12;
  }

  const yPagos = y + altoInfo + 4;
  caja(doc, { x: MARGEN, y: yPagos, w: anchoPieIzq, h: altoPagos });
  doc.rect(MARGEN, yPagos, anchoPieIzq, 15).fillAndStroke(GRIS, TINTA);
  doc.moveTo(MARGEN + anchoPieIzq * 0.7, yPagos).lineTo(MARGEN + anchoPieIzq * 0.7, yPagos + altoPagos).stroke();
  texto(doc, 'Forma de pago', MARGEN + PADDING, yPagos + 4, anchoPieIzq * 0.7 - PADDING * 2, { bold: true, size: 6.5, align: 'center' });
  texto(doc, 'Valor', MARGEN + anchoPieIzq * 0.72, yPagos + 4, anchoPieIzq * 0.26, { bold: true, size: 6.5, align: 'right' });
  let yp = yPagos + 15;
  for (const pago of pagos.length ? pagos : [{ formaPago: '', total: documento.importeTotal }]) {
    const etiqueta = pago.formaPago ? `${pago.formaPago} - ${formaPagoLabel(pago.formaPago)}` : 'Sin utilización del sistema financiero';
    texto(doc, etiqueta.toUpperCase(), MARGEN + PADDING, yp + 4, anchoPieIzq * 0.7 - PADDING * 2, { size: 6.5 });
    texto(doc, formatMonto(pago.total, 2), MARGEN + anchoPieIzq * 0.72, yp + 4, anchoPieIzq * 0.26, { size: 6.5, align: 'right' });
    doc.moveTo(MARGEN, yp).lineTo(MARGEN + anchoPieIzq, yp).stroke();
    yp += 14;
  }

  let yt = y;
  for (const [etiqueta, valor] of filas) {
    doc.rect(xTotales, yt, anchoTotales, altoFilaTotal).stroke();
    doc.moveTo(xTotales + anchoTotales * 0.68, yt).lineTo(xTotales + anchoTotales * 0.68, yt + altoFilaTotal).stroke();
    texto(doc, etiqueta, xTotales + 4, yt + 4, anchoTotales * 0.66, { size: 6.8 });
    texto(doc, valor, xTotales + anchoTotales * 0.69, yt + 4, anchoTotales * 0.29, { size: 6.8, align: 'right' });
    yt += altoFilaTotal;
  }
  for (const [etiqueta, valor] of [
    ['VALOR TOTAL SIN SUBSIDIO', formatMonto(documento.importeTotal, 2)],
    ['AHORRO POR SUBSIDIO\n(Incluye IVA cuando corresponda)', '0.00'],
  ] as const) {
    const alto = etiqueta.includes('\n') ? 22 : 13;
    doc.rect(xTotales, yt, anchoTotales, alto).stroke();
    doc.moveTo(xTotales + anchoTotales * 0.68, yt).lineTo(xTotales + anchoTotales * 0.68, yt + alto).stroke();
    texto(doc, etiqueta, xTotales + 4, yt + 3, anchoTotales * 0.66, { size: 6.5 });
    texto(doc, valor, xTotales + anchoTotales * 0.69, yt + 4, anchoTotales * 0.29, { size: 6.8, align: 'right' });
    yt += alto;
  }

  if (qr) {
    dibujarQr(doc, qr, { x: xTotales + anchoTotales - 52, y: yt + 6, size: 46 });
  }

  return finalizar();
}
