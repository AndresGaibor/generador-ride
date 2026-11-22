import type { Pago } from '../types.js';
import type { TotalesRide } from '../types.js';
import { formatMonto } from '../money.js';
import {
  TAMANO_TITULO,
  PADDING_CAJA,
  ESPACIO_LINEA,
  SEPARACION_COLUMNAS,
  FRACCION_PIE_IZQUIERDA,
  SEPARACION_PIE,
  TITULO_INFO_ADICIONAL,
} from './constants.js';
import { alturaUtilPagina, asegurarEspacio } from './pagination.js';
import { construirColumnas, drawTablaGenerica, medirTablaGenerica, ColumnaTabla } from './details.js';
import { drawTotales, medirTotales } from './totals.js';
import { formaPagoLabel } from './labels.js';
import type { AreaRide, LineaCaja } from './primitives.js';
import {
  dibujarCaja,
  medirCaja,
  noVacio,
} from './primitives.js';

export interface ContenidoPie {
  infoAdicional?: Record<string, string>;
  pagos?: Pago[];
  totales?: TotalesRide;
}

export function drawInfoAdicional(
  doc: PDFKit.PDFDocument,
  infoAdicional: Record<string, string> | undefined,
  area: AreaRide,
  altoMinimo?: number,
): number {
  const lineas = lineasInfoAdicional(infoAdicional, area.width);
  if (lineas.length === 0) {
    return area.y;
  }
  return dibujarCaja(doc, area, lineas, { titulo: TITULO_INFO_ADICIONAL, altoMinimo });
}

function lineasInfoAdicional(infoAdicional: Record<string, string> | undefined, anchoArea: number): LineaCaja[] {
  const entradas = infoAdicional
    ? Object.entries(infoAdicional).filter(([, valor]) => noVacio(valor))
    : [];
  if (entradas.length === 0) {
    return [];
  }
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const anchoClave = Math.floor(anchoCaja * 0.4);
  return [
    { texto: TITULO_INFO_ADICIONAL, negrita: true, tamano: TAMANO_TITULO },
    { texto: '', espaciador: ESPACIO_LINEA * 2 },
    ...entradas.map(([clave, valor]) => ({
      texto: `${clave}: ${valor}`,
      columnas: [
        { texto: `${clave}:`, ancho: anchoClave },
        { texto: valor, ancho: anchoCaja - anchoClave, ajustar: true },
      ],
    })),
  ];
}

export function medirInfoAdicional(
  doc: PDFKit.PDFDocument,
  infoAdicional: Record<string, string> | undefined,
  ancho: number,
): number {
  const lineas = lineasInfoAdicional(infoAdicional, ancho);
  return lineas.length === 0 ? 0 : medirCaja(doc, lineas, ancho);
}

function columnasFormasPago(ancho: number): ColumnaTabla[] {
  return construirColumnas(ancho, [
    ['Forma de pago', 0.72, 'left'],
    ['Valor', 0.28, 'right'],
  ]);
}

function filasFormasPago(pagos: Pago[]): string[][] {
  return pagos.map((pago) => {
    const etiqueta = formaPagoLabel(pago.formaPago);
    const partes = [(pago.formaPago ? `${pago.formaPago} - ${etiqueta}` : etiqueta).toUpperCase()];
    if (pago.plazo) partes.push(`Plazo: ${pago.plazo}`);
    if (pago.unidadTiempo) partes.push(`Unidad de Tiempo: ${pago.unidadTiempo}`);
    return [partes.join(' — '), formatMonto(pago.total, 2)];
  });
}

export function drawFormasPago(doc: PDFKit.PDFDocument, pagos: Pago[], area: AreaRide): number {
  return drawTablaGenerica(doc, columnasFormasPago(area.width), filasFormasPago(pagos), area);
}

export function medirFormasPago(doc: PDFKit.PDFDocument, pagos: Pago[], ancho: number): number {
  return medirTablaGenerica(doc, columnasFormasPago(ancho), filasFormasPago(pagos));
}

export function drawBloqueTexto(doc: PDFKit.PDFDocument, titulo: string, lineas: string[], area: AreaRide): number {
  return dibujarCaja(doc, area, lineasBloqueTexto(titulo, lineas), { titulo });
}

function lineasBloqueTexto(titulo: string, lineas: string[]): LineaCaja[] {
  return [
    { texto: titulo, negrita: true, tamano: TAMANO_TITULO },
    ...lineas.map((texto) => ({ texto })),
  ];
}

export function medirBloqueTexto(
  doc: PDFKit.PDFDocument,
  titulo: string,
  lineas: string[],
  ancho: number,
): number {
  return medirCaja(doc, lineasBloqueTexto(titulo, lineas), ancho);
}

export function drawPie(doc: PDFKit.PDFDocument, contenido: ContenidoPie, area: AreaRide): number {
  const { anchoIzquierda, anchoDerecha } = anchosPie(area.width);
  const xDerecha = area.x + anchoIzquierda + SEPARACION_COLUMNAS;

  const altoInfo = medirInfoAdicional(doc, contenido.infoAdicional, anchoIzquierda);
  const altoPagos = contenido.pagos?.length ? medirFormasPago(doc, contenido.pagos, anchoIzquierda) : 0;
  const altoIzquierda = altoInfo + (altoInfo > 0 && altoPagos > 0 ? SEPARACION_PIE : 0) + altoPagos;
  const altoDerecha = contenido.totales ? medirTotales(doc, contenido.totales, anchoDerecha) : 0;

  return drawBloquesEnFila(
    doc,
    area.y,
    altoIzquierda,
    altoDerecha,
    (yFila) => {
      let y = yFila;
      if (altoInfo > 0) {
        const altoCaja = altoInfo + Math.max(0, altoDerecha - altoIzquierda);
        y = drawInfoAdicional(doc, contenido.infoAdicional, { x: area.x, y, width: anchoIzquierda }, altoCaja);
        if (altoPagos > 0) y += SEPARACION_PIE;
      }
      if (altoPagos > 0) {
        y = drawFormasPago(doc, contenido.pagos as Pago[], { x: area.x, y, width: anchoIzquierda });
      }
      return y;
    },
    (yFila) =>
      contenido.totales
        ? drawTotales(doc, contenido.totales, { x: xDerecha, y: yFila, width: anchoDerecha })
        : yFila,
    SEPARACION_PIE,
  );
}

export function medirPie(doc: PDFKit.PDFDocument, contenido: ContenidoPie, ancho: number): number {
  const { anchoIzquierda, anchoDerecha } = anchosPie(ancho);
  const altoInfo = medirInfoAdicional(doc, contenido.infoAdicional, anchoIzquierda);
  const altoPagos = contenido.pagos?.length ? medirFormasPago(doc, contenido.pagos, anchoIzquierda) : 0;
  return Math.max(
    altoInfo + (altoInfo > 0 && altoPagos > 0 ? SEPARACION_PIE : 0) + altoPagos,
    contenido.totales ? medirTotales(doc, contenido.totales, anchoDerecha) : 0,
  );
}

function anchosPie(ancho: number): { anchoIzquierda: number; anchoDerecha: number } {
  const anchoIzquierda = Math.floor((ancho - SEPARACION_COLUMNAS) * FRACCION_PIE_IZQUIERDA);
  return { anchoIzquierda, anchoDerecha: ancho - anchoIzquierda - SEPARACION_COLUMNAS };
}

export function drawBloquesEnFila(
  doc: PDFKit.PDFDocument,
  y: number,
  altoIzquierda: number,
  altoDerecha: number,
  izquierda: (y: number) => number,
  derecha: (y: number) => number,
  separacion = 0,
): number {
  const alto = Math.max(altoIzquierda, altoDerecha);
  if (alto > alturaUtilPagina(doc)) {
    let yActual = asegurarEspacio(doc, y, alturaUtilPagina(doc));
    yActual = izquierda(yActual) + separacion;
    yActual = asegurarEspacio(doc, yActual, alturaUtilPagina(doc));
    return derecha(yActual);
  }
  const yFila = asegurarEspacio(doc, y, alto);
  return Math.max(izquierda(yFila), derecha(yFila));
}
