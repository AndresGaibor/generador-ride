import type { AutorizacionRide, Detalle, InfoTributaria, Pago, TotalImpuesto } from '../types.js';
import { RideError } from '../errors.js';
import { dibujarCode128 } from '../barcode/code128.js';
import { dibujarQr } from '../qr/qr-vector.js';
import type { QrMatrix } from '../qr/qr-vector.js';
import { formatMonto } from '../money.js';
import { etiquetaCatalogo, formaPagoLabel, LABEL_AMBIENTE, LABEL_TIPO_EMISION } from './labels.js';

export const SRI_MARGEN = 24;
export const SRI_PADDING = 7;
export const SRI_TINTA = '#000000';
export const SRI_GRIS = '#eeeeee';
export const SRI_ROJO = '#d0021b';

const HELVETICA = 'Helvetica';
const HELVETICA_BOLD = 'Helvetica-Bold';

export interface RectSRI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OpcionesTextoSRI {
  bold?: boolean;
  size?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export function texto(
  doc: PDFKit.PDFDocument,
  valor: string,
  x: number,
  y: number,
  w: number,
  opciones: OpcionesTextoSRI = {},
): number {
  doc
    .font(opciones.bold ? HELVETICA_BOLD : HELVETICA)
    .fontSize(opciones.size ?? 7)
    .fillColor(opciones.color ?? SRI_TINTA)
    .text(valor, x, y, { width: w, align: opciones.align ?? 'left', lineBreak: true });
  return doc.y;
}

export function caja(doc: PDFKit.PDFDocument, r: RectSRI): void {
  doc.lineWidth(0.8).strokeColor(SRI_TINTA).rect(r.x, r.y, r.w, r.h).stroke();
}

export function filaEtiquetaValor(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  etiqueta: string,
  valor: string,
  opciones: {
    etiquetaAncho?: number;
    bold?: boolean;
    etiquetaSize?: number;
    valorAlign?: 'left' | 'right';
  } = {},
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

// ---------------------------------------------------------------------------
// Cabecera (emisor + comprobante)
// ---------------------------------------------------------------------------

export interface CabeceraSRI {
  titulo: string;
  razonSocial: string;
  ruc: string;
  numero: string;
  ambiente: string;
  tipoEmision: string;
  claveAcceso: string;
  autorizacion?: AutorizacionRide;
  logo?: Uint8Array;
  dirMatriz: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: string;
  /** Pares etiqueta/valor extra del bloque del emisor (agente de retención, RISE, ...). */
  lineasExtra?: Array<[string, string]>;
}

/**
 * Cabecera de la plantilla SRI: bloque izquierdo con el emisor (logo o
 * "NO TIENE LOGO") y bloque derecho con los datos del comprobante
 * (RUC, nombre, número, autorización, ambiente, emisión y clave de acceso
 * con su código Code 128). Devuelve la coordenada Y inferior de la cabecera.
 */
export function dibujarCabeceraSRI(doc: PDFKit.PDFDocument, cab: CabeceraSRI): number {
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  const y0 = SRI_MARGEN;
  const altoCabecera = 205;
  const anchoIzquierda = Math.floor(anchoUtil * 0.455);
  const anchoDerecha = anchoUtil - anchoIzquierda;

  // Bloque izquierdo: emisor
  caja(doc, { x: SRI_MARGEN, y: y0, w: anchoIzquierda, h: altoCabecera });
  let y = y0 + SRI_PADDING;
  const xIzq = SRI_MARGEN + SRI_PADDING;
  const anchoTextoIzq = anchoIzquierda - SRI_PADDING * 2;
  if (cab.logo) {
    try {
      doc.image(cab.logo.slice().buffer, xIzq, y, { fit: [120, 54] });
    } catch {
      throw new RideError('El logo del emisor no se pudo procesar.', 'RIDE_INVALID_LOGO');
    }
    y += 58;
  } else {
    texto(doc, 'NO TIENE LOGO', xIzq, y, anchoTextoIzq, { bold: true, size: 13, color: SRI_ROJO });
    y += 34;
  }
  texto(doc, cab.razonSocial, xIzq, y, anchoTextoIzq, { bold: true, size: 8.5 });
  y = Math.max(doc.y, y + 10) + 8;
  for (const [etiqueta, valor] of [
    ['Dirección Matriz:', cab.dirMatriz],
    ['Dirección Sucursal:', cab.dirEstablecimiento ?? ''],
  ] as const) {
    y = filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, etiqueta, valor, { etiquetaAncho: 92 }) + 2;
  }
  if (cab.contribuyenteEspecial) {
    y = filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, 'Contribuyente Especial Nro', cab.contribuyenteEspecial, {
      etiquetaAncho: 92,
    }) + 2;
  }
  for (const [etiqueta, valor] of cab.lineasExtra ?? []) {
    y = filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, etiqueta, valor, { etiquetaAncho: 92 }) + 2;
  }
  if (cab.obligadoContabilidad) {
    filaEtiquetaValor(doc, xIzq, y, anchoTextoIzq, 'OBLIGADO A LLEVAR CONTABILIDAD', cab.obligadoContabilidad, {
      etiquetaAncho: 150,
      valorAlign: 'right',
    });
  }

  // Bloque derecho: comprobante
  const xDer = SRI_MARGEN + anchoIzquierda;
  caja(doc, { x: xDer, y: y0, w: anchoDerecha, h: altoCabecera });
  const xTextoDer = xDer + SRI_PADDING;
  const anchoTextoDer = anchoDerecha - SRI_PADDING * 2;
  y = y0 + SRI_PADDING;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'R.U.C.:', cab.ruc, { etiquetaAncho: 38 }) + 2;
  texto(doc, cab.titulo, xTextoDer, y, anchoTextoDer, { bold: true, size: 13 });
  y = Math.max(doc.y, y + 17) + 2;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'No.', cab.numero, { etiquetaAncho: 26 }) + 4;
  texto(doc, 'NÚMERO DE AUTORIZACIÓN', xTextoDer, y, anchoTextoDer, { size: 6.8 });
  y += 9;
  texto(doc, cab.autorizacion?.numero ?? 'COMPROBANTE NO AUTORIZADO', xTextoDer, y, anchoTextoDer, {
    bold: true,
    size: 6.5,
    color: cab.autorizacion ? SRI_TINTA : SRI_ROJO,
  });
  y = Math.max(doc.y, y + 8) + 2;
  y = filaEtiquetaValor(doc, xTextoDer, y, anchoTextoDer, 'FECHA Y HORA DE AUTORIZACIÓN:', cab.autorizacion?.fecha ?? '', {
    etiquetaAncho: 130,
    etiquetaSize: 6.2,
    valorAlign: 'right',
  }) + 6;
  y = filaEtiquetaValor(
    doc,
    xTextoDer,
    y,
    anchoTextoDer,
    'AMBIENTE:',
    etiquetaCatalogo(LABEL_AMBIENTE, cab.ambiente as '1' | '2'),
    { etiquetaAncho: 108 },
  ) + 2;
  y = filaEtiquetaValor(
    doc,
    xTextoDer,
    y,
    anchoTextoDer,
    'EMISIÓN:',
    etiquetaCatalogo(LABEL_TIPO_EMISION, cab.tipoEmision as '1'),
    { etiquetaAncho: 108 },
  ) + 3;
  texto(doc, 'CLAVE DE ACCESO', xTextoDer, y, anchoTextoDer, { size: 7.5 });
  y += 12;
  dibujarCode128(doc, cab.claveAcceso, { x: xTextoDer, y, ancho: anchoTextoDer, alto: 26 });
  y += 28;
  texto(doc, cab.claveAcceso, xTextoDer, y, anchoTextoDer, { size: 6, align: 'center' });

  return y0 + altoCabecera;
}

export interface CabeceraDocumentoSRI {
  infoTributaria: InfoTributaria;
  titulo: string;
  claveAcceso: string;
  autorizacion?: AutorizacionRide;
  logo?: Uint8Array;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: string;
  lineasExtra?: Array<[string, string]>;
}

/** Cabecera SRI a partir de la información tributaria del comprobante. */
export function dibujarCabeceraDocumentoSRI(doc: PDFKit.PDFDocument, datos: CabeceraDocumentoSRI): number {
  return dibujarCabeceraSRI(doc, {
    titulo: datos.titulo,
    razonSocial: datos.infoTributaria.razonSocial,
    ruc: datos.infoTributaria.ruc,
    numero: `${datos.infoTributaria.estab}-${datos.infoTributaria.ptoEmi}-${datos.infoTributaria.secuencial}`,
    ambiente: datos.infoTributaria.ambiente,
    tipoEmision: datos.infoTributaria.tipoEmision ?? '1',
    claveAcceso: datos.claveAcceso,
    autorizacion: datos.autorizacion,
    logo: datos.logo,
    dirMatriz: datos.infoTributaria.dirMatriz,
    dirEstablecimiento: datos.dirEstablecimiento,
    contribuyenteEspecial: datos.contribuyenteEspecial,
    obligadoContabilidad: datos.obligadoContabilidad,
    lineasExtra: datos.lineasExtra,
  });
}

// ---------------------------------------------------------------------------
// Banda de sujeto (comprador, proveedor, transportista, ...)
// ---------------------------------------------------------------------------

const ETIQUETAS_IDENTIFICACION: Record<string, string> = {
  '04': 'RUC',
  '05': 'Cédula de Identidad',
  '06': 'Pasaporte',
  '07': 'Consumidor Final',
  '08': 'Identificación del Exterior',
  '09': 'Placa',
};

export function etiquetaIdentificacionSRI(codigo: string): string {
  return ETIQUETAS_IDENTIFICACION[codigo] ?? codigo;
}

export function identificacionConTipoSRI(identificacion: string, tipo?: string): string {
  return tipo ? `${identificacion} (${etiquetaIdentificacionSRI(tipo)})` : identificacion;
}

export interface ParSRI {
  etiqueta: string;
  valor: string;
}

export interface FilaBandaSRI {
  izquierda?: ParSRI;
  derecha?: ParSRI;
}

export interface OpcionesBandaSRI {
  titulo?: string;
  altoFila?: number;
  fraccionDerecha?: number;
  anchoEtiquetaIzq?: number;
  anchoEtiquetaDer?: number;
}

/**
 * Caja de banda con pares etiqueta/valor (hasta dos por fila). Devuelve la
 * coordenada Y inferior de la banda.
 */
export function dibujarBandaSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  filas: FilaBandaSRI[],
  opciones: OpcionesBandaSRI = {},
): number {
  const altoFila = opciones.altoFila ?? 18.5;
  const fraccion = opciones.fraccionDerecha ?? 0.55;
  const anchoEtiquetaIzq = opciones.anchoEtiquetaIzq ?? 140;
  const anchoEtiquetaDer = opciones.anchoEtiquetaDer ?? 76;
  const altoTitulo = opciones.titulo ? 12 : 0;
  const alto = altoTitulo + filas.length * altoFila;

  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });

  let y = area.y;
  if (opciones.titulo) {
    texto(doc, opciones.titulo, area.x + SRI_PADDING, y + 3, area.width - SRI_PADDING * 2, {
      bold: true,
      size: 7,
      align: 'center',
    });
    y += altoTitulo;
  }

  const xDer = area.x + area.width * fraccion;
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const fy = y + i * altoFila + 4;
    if (fila.izquierda) {
      texto(doc, fila.izquierda.etiqueta, area.x + SRI_PADDING, fy, anchoEtiquetaIzq, { bold: true, size: 6.8 });
      texto(
        doc,
        fila.izquierda.valor,
        area.x + SRI_PADDING + anchoEtiquetaIzq,
        fy,
        area.width * fraccion - anchoEtiquetaIzq - SRI_PADDING,
        { size: 6.8 },
      );
    }
    if (fila.derecha) {
      texto(doc, fila.derecha.etiqueta, xDer, fy, anchoEtiquetaDer, { bold: true, size: 6.8 });
      texto(
        doc,
        fila.derecha.valor,
        xDer + anchoEtiquetaDer,
        fy,
        area.width * (1 - fraccion) - anchoEtiquetaDer - SRI_PADDING,
        { size: 6.8 },
      );
    }
  }

  return area.y + alto;
}

// ---------------------------------------------------------------------------
// Tabla con bordes y paginación
// ---------------------------------------------------------------------------

export interface ColumnaSRI {
  titulo: string;
  peso: number;
  align: 'left' | 'center' | 'right';
}

export interface OpcionesTablaSRI {
  titulo?: string;
  altoEncabezado?: number;
  altoFila?: number;
  tamanoCelda?: number;
  /** Y máxima antes de saltar de página; por defecto, el margen inferior. */
  limite?: number;
}

/**
 * Tabla con encabezado gris, bordes y paginación: cuando una fila no cabe
 * se abre una página nueva y se repite el encabezado. Devuelve la coordenada Y
 * inferior de la tabla.
 */
export function dibujarTablaSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  columnas: ColumnaSRI[],
  filas: string[][],
  opciones: OpcionesTablaSRI = {},
): number {
  const altoEncabezado = opciones.altoEncabezado ?? 26;
  const altoFila = opciones.altoFila ?? 20;
  const tamanoCelda = opciones.tamanoCelda ?? 6.8;
  const suma = columnas.reduce((acc, col) => acc + col.peso, 0);
  const anchos = columnas.map((col) => Math.floor((area.width * col.peso) / suma));
  anchos[anchos.length - 1] += area.width - anchos.reduce((a, b) => a + b, 0);

  let y = area.y;
  const limite = opciones.limite ?? doc.page.height - doc.page.margins.bottom;
  if (opciones.titulo) {
    texto(doc, opciones.titulo, area.x, y, area.width, { bold: true, size: 7 });
    y += 12;
  }
  const dibujarEncabezado = (): void => {
    doc.rect(area.x, y, area.width, altoEncabezado).fillAndStroke(SRI_GRIS, SRI_TINTA);
    let x = area.x;
    for (let i = 0; i < columnas.length; i++) {
      texto(doc, columnas[i]!.titulo, x + 2, y + 5, anchos[i]! - 4, { bold: true, size: 6, align: 'center' });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoEncabezado).stroke();
      x += anchos[i]!;
    }
    y += altoEncabezado;
  };

  if (y + altoEncabezado + altoFila > limite) {
    doc.addPage();
    y = SRI_MARGEN;
  }
  dibujarEncabezado();

  for (const fila of filas) {
    if (y + altoFila > limite) {
      doc.addPage();
      y = SRI_MARGEN;
      dibujarEncabezado();
    }
    doc.lineWidth(0.6).rect(area.x, y, area.width, altoFila).stroke();
    let x = area.x;
    for (let i = 0; i < columnas.length; i++) {
      texto(doc, fila[i] ?? '', x + 3, y + 5, anchos[i]! - 6, { size: tamanoCelda, align: columnas[i]!.align });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoFila).stroke();
      x += anchos[i]!;
    }
    y += altoFila;
  }

  return y;
}

/** Columnas de la tabla de detalle, con o sin las columnas de subsidio. */
export function columnasDetalle(conSubsidio: boolean): ColumnaSRI[] {
  const base: ColumnaSRI[] = [
    { titulo: 'Cod.\nPrincipal', peso: 8.5, align: 'left' },
    { titulo: 'Cod.\nAuxiliar', peso: 7.5, align: 'left' },
    { titulo: 'Cantidad', peso: 6.5, align: 'right' },
    { titulo: 'Descripción', peso: 18.5, align: 'left' },
    { titulo: 'Detalle Adicional', peso: 11, align: 'left' },
    { titulo: 'Precio Unitario', peso: 8, align: 'right' },
  ];
  if (conSubsidio) {
    base.push(
      { titulo: 'Subsidio', peso: 6.5, align: 'right' },
      { titulo: 'Precio sin Subsidio', peso: 7.5, align: 'right' },
    );
  }
  base.push({ titulo: 'Descuento', peso: 7, align: 'right' }, { titulo: 'Precio Total', peso: 9, align: 'right' });
  return base;
}

/** Celdas de una fila de detalle. */
export function celdasDetalle(detalle: Detalle, conSubsidio: boolean): string[] {
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
  ];
  if (conSubsidio) {
    celdas.push('0.00', formatMonto(detalle.precioTotalSinImpuesto, 2));
  }
  celdas.push(formatMonto(detalle.descuento, 2), formatMonto(detalle.precioTotalSinImpuesto, 2));
  return celdas;
}

// ---------------------------------------------------------------------------
// Totales
// ---------------------------------------------------------------------------

export interface OpcionesTotalesSRI {
  conSubtotales?: boolean;
  conDescuento?: boolean;
  conPropina?: boolean;
}

/**
 * Filas de la tabla de totales a partir de los impuestos del comprobante
 * (subtotales por porcentaje, ICE, IVA, IRBPNR, propina y valor total).
 */
export function calcularFilasTotalesSRI(params: {
  impuestos: TotalImpuesto[];
  totalSinImpuestos: string;
  totalDescuento?: string;
  propina?: string;
  importeTotal: string;
  opciones?: OpcionesTotalesSRI;
}): Array<[string, string]> {
  const { impuestos, totalSinImpuestos, totalDescuento, propina, importeTotal } = params;
  const conSubtotales = params.opciones?.conSubtotales ?? true;
  const conDescuento = params.opciones?.conDescuento ?? true;
  const conPropina = params.opciones?.conPropina ?? true;

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
  if (conSubtotales) {
    filas.push(['SUBTOTAL NO OBJETO DE IVA', formatMonto(basesPorcentaje(impuestos, '6').toFixed(2), 2)]);
    filas.push(['SUBTOTAL EXENTO DE IVA', formatMonto(basesPorcentaje(impuestos, '7').toFixed(2), 2)]);
    filas.push(['SUBTOTAL SIN IMPUESTOS', formatMonto(totalSinImpuestos, 2)]);
  }
  if (conDescuento) {
    filas.push(['TOTAL DESCUENTO', formatMonto(totalDescuento ?? '0.00', 2)]);
  }
  filas.push(['ICE', formatMonto(sumarImpuesto(impuestos, '3').toFixed(2), 2)]);
  const iva = sumarImpuesto(impuestos, '2');
  if (iva > 0) filas.push(['IVA', formatMonto(iva.toFixed(2), 2)]);
  filas.push(['IRBPNR', formatMonto(sumarImpuesto(impuestos, '5').toFixed(2), 2)]);
  if (conPropina) {
    filas.push(['PROPINA', formatMonto(propina ?? '0.00', 2)]);
  }
  filas.push(['VALOR TOTAL', formatMonto(importeTotal, 2)]);
  return filas;
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

export type FilaTotalSRI = [etiqueta: string, valor: string, alto?: number, tamanoEtiqueta?: number];

/**
 * Tabla de totales: una fila por par etiqueta/valor, con separador vertical
 * antes de la columna de importes. Devuelve la coordenada Y inferior.
 */
export function dibujarTotalesSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  filas: FilaTotalSRI[],
  opciones: { altoFila?: number; tamano?: number } = {},
): number {
  const altoFilaPorDefecto = opciones.altoFila ?? 13;
  const tamano = opciones.tamano ?? 6.8;
  let y = area.y;
  for (const [etiqueta, valor, altoFila = altoFilaPorDefecto, tamanoEtiqueta] of filas) {
    doc.rect(area.x, y, area.width, altoFila).stroke();
    doc.moveTo(area.x + area.width * 0.68, y).lineTo(area.x + area.width * 0.68, y + altoFila).stroke();
    texto(doc, etiqueta, area.x + 4, y + (tamanoEtiqueta ? 3 : 4), area.width * 0.66, {
      size: tamanoEtiqueta ?? tamano,
    });
    texto(doc, valor, area.x + area.width * 0.69, y + 4, area.width * 0.29, { size: tamano, align: 'right' });
    y += altoFila;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Información adicional y formas de pago
// ---------------------------------------------------------------------------

export function dibujarInformacionAdicionalSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  infoAdicional?: Record<string, string>,
): number {
  const info = Object.entries(infoAdicional ?? {}).filter(([, v]) => v.trim() !== '');
  const alto = Math.max(56, 18 + info.length * 12);
  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });
  texto(doc, 'Información Adicional', area.x + SRI_PADDING, area.y + 5, area.width - SRI_PADDING * 2, {
    size: 7,
    align: 'center',
  });
  let y = area.y + 20;
  for (const [clave, valor] of info) {
    texto(doc, clave, area.x + SRI_PADDING, y, area.width * 0.32, { size: 6.5 });
    texto(doc, valor, area.x + SRI_PADDING + area.width * 0.32, y, area.width * 0.6, { size: 6.5 });
    y += 12;
  }
  return area.y + alto;
}

export function dibujarFormasPagoSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  pagos: Pago[],
  total: string,
): number {
  const filas = pagos.length ? pagos : [{ formaPago: '', total }];
  const alto = 18 + filas.length * 14;
  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });
  doc.rect(area.x, area.y, area.width, 15).fillAndStroke(SRI_GRIS, SRI_TINTA);
  doc.moveTo(area.x + area.width * 0.7, area.y).lineTo(area.x + area.width * 0.7, area.y + alto).stroke();
  texto(doc, 'Forma de pago', area.x + SRI_PADDING, area.y + 4, area.width * 0.7 - SRI_PADDING * 2, {
    bold: true,
    size: 6.5,
    align: 'center',
  });
  texto(doc, 'Valor', area.x + area.width * 0.72, area.y + 4, area.width * 0.26, {
    bold: true,
    size: 6.5,
    align: 'right',
  });
  let y = area.y + 15;
  for (const pago of filas) {
    const etiqueta = pago.formaPago
      ? `${pago.formaPago} - ${formaPagoLabel(pago.formaPago)}`
      : 'Sin utilización del sistema financiero';
    texto(doc, etiqueta.toUpperCase(), area.x + SRI_PADDING, y + 4, area.width * 0.7 - SRI_PADDING * 2, { size: 6.5 });
    texto(doc, formatMonto(pago.total, 2), area.x + area.width * 0.72, y + 4, area.width * 0.26, {
      size: 6.5,
      align: 'right',
    });
    doc.moveTo(area.x, y).lineTo(area.x + area.width, y).stroke();
    y += 14;
  }
  return area.y + alto;
}

// ---------------------------------------------------------------------------
// Pie (información adicional + formas de pago + totales)
// ---------------------------------------------------------------------------

export interface PieSRI {
  infoAdicional?: Record<string, string>;
  pagos?: Pago[];
  total?: string;
  filasTotales?: FilaTotalSRI[];
  qr?: QrMatrix;
}

export function medirInformacionAdicionalSRI(infoAdicional?: Record<string, string>): number {
  const info = Object.entries(infoAdicional ?? {}).filter(([, v]) => v.trim() !== '');
  return Math.max(56, 18 + info.length * 12);
}

/**
 * Pie de la plantilla SRI: información adicional y formas de pago en la
 * columna izquierda, tabla de totales a la derecha. Sin totales, la columna
 * izquierda ocupa todo el ancho (guía de remisión).
 */
export function dibujarPieSRI(
  doc: PDFKit.PDFDocument,
  area: { x: number; y: number; width: number },
  pie: PieSRI,
): void {
  const anchoTotales = pie.filasTotales ? Math.floor(area.width * 0.405) : 0;
  const anchoIzq = pie.filasTotales ? area.width - anchoTotales - 8 : area.width;
  const xTotales = area.x + anchoIzq + 8;

  const altoInfo = medirInformacionAdicionalSRI(pie.infoAdicional);
  const altoPagos = pie.pagos ? 18 + Math.max(1, pie.pagos.length) * 14 : 0;
  const altoTotales = (pie.filasTotales ?? []).reduce((total, fila) => total + (fila[2] ?? 13), 0);

  let y = area.y;
  if (y + Math.max(altoInfo + (pie.pagos ? 4 + altoPagos : 0), altoTotales + 35) > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = SRI_MARGEN;
  }

  dibujarInformacionAdicionalSRI(doc, { x: area.x, y, width: anchoIzq }, pie.infoAdicional);
  if (pie.pagos) {
    dibujarFormasPagoSRI(doc, { x: area.x, y: y + altoInfo + 4, width: anchoIzq }, pie.pagos, pie.total ?? '0.00');
  }

  if (pie.filasTotales) {
    const yt = dibujarTotalesSRI(doc, { x: xTotales, y, width: anchoTotales }, pie.filasTotales);
    if (pie.qr) {
      dibujarQr(doc, pie.qr, { x: xTotales + anchoTotales - 52, y: yt + 6, size: 46 });
    }
  } else if (pie.qr) {
    dibujarQr(doc, pie.qr, { x: area.x + anchoIzq - 52, y: y + altoInfo + 6, size: 46 });
  }
}
