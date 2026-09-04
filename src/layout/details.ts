import type { Detalle } from '../types.js';
import { formatMonto } from '../money.js';
import {
  FUENTE_NORMAL,
  FUENTE_NEGRITA,
  TAMANO_TABLA,
  COLOR_TEXTO,
  COLOR_ENCABEZADO_TABLA,
  PADDING_CELDA,
  MAX_DETALLES_ADICIONALES,
  TAMANO_DETALLE,
} from './constants.js';
import { asegurarEspacio, alturaUtilPagina, limiteInferior, partirTextoPorAltura } from './pagination.js';
import { escribirTexto, tamanoQueCabe } from './primitives.js';
import type { AreaRide } from './primitives.js';

export interface ColumnaTabla {
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

export interface OpcionesTabla {
  conEncabezado?: boolean;
  tamano?: number;
  divisores?: boolean;
}

export interface EtiquetasDetalle {
  codigoPrincipal: string;
  codigoAuxiliar: string;
  cantidad: string;
}

const ETIQUETAS_DETALLE_FACTURA: EtiquetasDetalle = {
  codigoPrincipal: 'Cod. Principal',
  codigoAuxiliar: 'Cod. Auxiliar',
  cantidad: 'Cant.',
};

export const ETIQUETAS_DETALLE_COMPLETAS: EtiquetasDetalle = {
  codigoPrincipal: 'Código',
  codigoAuxiliar: 'Código Auxiliar',
  cantidad: 'Cantidad',
};

export interface OpcionesTablaDetalles {
  detallesAdicionales?: number;
  subsidio?: boolean;
  etiquetas?: Partial<EtiquetasDetalle>;
}

export function formatCantidadPrecision(valor: string): string {
  const normalizado = formatMonto(valor, 6);
  const [intPart, fracPart] = normalizado.split('.');
  const fracRecortada = (fracPart ?? '').replace(/0+$/, '');
  return `${intPart}.${fracRecortada.length < 2 ? fracRecortada.padEnd(2, '0') : fracRecortada}`;
}

function celdasDetalle(d: Detalle, opciones: OpcionesTablaDetalles): string[] {
  const columnasExtra = opciones.detallesAdicionales ?? MAX_DETALLES_ADICIONALES;
  const extras = Object.entries(d.detallesAdicionales ?? {}).map(([k, v]) => `${k}: ${v}`);
  const enColumnas = extras.slice(0, columnasExtra);
  const sobrantes = extras.slice(columnasExtra);

  const celdas = [
    d.codigoPrincipal ?? '',
    d.codigoAuxiliar ?? '',
    formatCantidadPrecision(d.cantidad),
    [d.descripcion, ...sobrantes].join('\n'),
    ...Array.from({ length: columnasExtra }, (_, i) => enColumnas[i] ?? ''),
    formatCantidadPrecision(d.precioUnitario),
  ];
  if (opciones.subsidio !== false) {
    celdas.push('0.00', formatMonto(d.precioTotalSinImpuesto, 2));
  }
  celdas.push(formatMonto(d.descuento, 2), formatMonto(d.precioTotalSinImpuesto, 2));
  return celdas;
}

function especificacionDetalle(opciones: OpcionesTablaDetalles): Array<[string, number, 'left' | 'center' | 'right']> {
  const columnasExtra = opciones.detallesAdicionales ?? MAX_DETALLES_ADICIONALES;
  const etiquetas = { ...ETIQUETAS_DETALLE_FACTURA, ...opciones.etiquetas };
  const specs: Array<[string, number, 'left' | 'center' | 'right']> = [
    [etiquetas.codigoPrincipal, 8.5, 'left'],
    [etiquetas.codigoAuxiliar, 7.5, 'left'],
    [etiquetas.cantidad, 6.5, 'right'],
    ['Descripción', 18.5, 'left'],
  ];
  for (let i = 0; i < columnasExtra; i++) {
    specs.push(['Detalle Adicional', 7, 'left']);
  }
  specs.push(['Precio Unitario', 8, 'right']);
  if (opciones.subsidio !== false) {
    specs.push(['Subsidio', 6.5, 'right'], ['Precio Sin Subsidio', 7.5, 'right']);
  }
  specs.push(['Descuento', 7, 'right'], ['Precio Total', 9, 'right']);
  return specs;
}

export function construirColumnas(
  anchoTotal: number,
  specs: Array<[string, number, 'left' | 'center' | 'right']>,
): ColumnaTabla[] {
  const total = specs.reduce((s, [, peso]) => s + peso, 0);
  const widths = specs.map(([, peso]) => Math.floor((anchoTotal * peso) / total));
  const usado = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += anchoTotal - usado;
  return specs.map(([header, , align], i) => ({ header, width: widths[i], align }));
}

function fuenteFilaTabla(doc: PDFKit.PDFDocument, esEncabezado: boolean, tamano: number): void {
  doc.font(esEncabezado ? FUENTE_NEGRITA : FUENTE_NORMAL).fontSize(tamano).fillColor(COLOR_TEXTO);
}

function tamanosCelda(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  celdas: string[],
  esEncabezado: boolean,
  base: number,
): number[] {
  fuenteFilaTabla(doc, esEncabezado, base);
  return columnas.map((col, i) => tamanoQueCabe(doc, celdas[i], col.width - PADDING_CELDA * 2, base));
}

function alturaFilaTabla(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  celdas: string[],
  esEncabezado: boolean,
  base: number,
): number {
  const tamanos = tamanosCelda(doc, columnas, celdas, esEncabezado, base);
  const alturas = columnas.map((col, i) => {
    doc.fontSize(tamanos[i]);
    return doc.heightOfString(celdas[i], { width: col.width - PADDING_CELDA * 2 });
  });
  return Math.max(...alturas) + PADDING_CELDA * 2;
}

function dibujarFilaTabla(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  celdas: string[],
  x: number,
  y: number,
  esEncabezado: boolean,
  opciones: OpcionesTabla = {},
): number {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const alto = alturaFilaTabla(doc, columnas, celdas, esEncabezado, base);
  const anchoTotal = columnas.reduce((s, c) => s + c.width, 0);

  if (esEncabezado) {
    doc.rect(x, y, anchoTotal, alto).fillAndStroke(COLOR_ENCABEZADO_TABLA, COLOR_TEXTO);
    doc.fillColor(COLOR_TEXTO);
  }

  const tamanos = tamanosCelda(doc, columnas, celdas, esEncabezado, base);
  let cx = x;
  for (let i = 0; i < columnas.length; i++) {
    fuenteFilaTabla(doc, esEncabezado, tamanos[i]);
    escribirTexto(doc, celdas[i], cx + PADDING_CELDA, y + PADDING_CELDA, {
      width: columnas[i].width - PADDING_CELDA * 2,
      align: esEncabezado ? 'center' : columnas[i].align,
    });
    cx += columnas[i].width;
  }

  doc.lineWidth(0.5).strokeColor(COLOR_TEXTO);
  if (!esEncabezado) {
    doc.rect(x, y, anchoTotal, alto).stroke();
  }
  if (opciones.divisores !== false) {
    cx = x;
    for (const col of columnas.slice(0, -1)) {
      cx += col.width;
      doc.moveTo(cx, y).lineTo(cx, y + alto).stroke();
    }
  }

  return y + alto;
}

function dibujarFilaEnVariasPaginas(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  encabezados: string[],
  celdas: string[],
  x: number,
  y: number,
  altoEncabezado: number,
  opciones: OpcionesTabla,
): number {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;

  const abrirPagina = (): number => {
    doc.addPage();
    const yTop = doc.page.margins.top;
    return conEncabezado ? dibujarFilaTabla(doc, columnas, encabezados, x, yTop, true, opciones) : yTop;
  };

  let yFila = y;
  if (yFila > doc.page.margins.top + altoEncabezado) {
    yFila = abrirPagina();
  }

  const presupuesto = alturaUtilPagina(doc) - altoEncabezado - PADDING_CELDA * 2;
  fuenteFilaTabla(doc, false, base);
  const trozos = columnas.map((col, i) =>
    partirTextoPorAltura(doc, celdas[i], col.width - PADDING_CELDA * 2, presupuesto),
  );
  const subFilas = Math.max(...trozos.map((t) => t.length));

  for (let s = 0; s < subFilas; s++) {
    if (s > 0) {
      yFila = abrirPagina();
    }
    yFila = dibujarFilaTabla(
      doc,
      columnas,
      trozos.map((t) => t[s] ?? ''),
      x,
      yFila,
      false,
      opciones,
    );
  }
  return yFila;
}

export function drawTablaGenerica(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  filas: string[][],
  area: AreaRide,
  opciones: OpcionesTabla = {},
): number {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;
  const encabezados = columnas.map((c) => c.header);
  const altoEncabezado = conEncabezado ? alturaFilaTabla(doc, columnas, encabezados, true, base) : 0;

  const altoPrimeraFila = filas.length > 0 ? alturaFilaTabla(doc, columnas, filas[0], false, base) : 0;
  let y = asegurarEspacio(doc, area.y, Math.min(altoEncabezado + altoPrimeraFila, alturaUtilPagina(doc)));
  if (conEncabezado) {
    y = dibujarFilaTabla(doc, columnas, encabezados, area.x, y, true, opciones);
  }

  for (const fila of filas) {
    const alto = alturaFilaTabla(doc, columnas, fila, false, base);

    if (y + alto <= limiteInferior(doc)) {
      y = dibujarFilaTabla(doc, columnas, fila, area.x, y, false, opciones);
      continue;
    }

    if (altoEncabezado + alto <= alturaUtilPagina(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
      if (conEncabezado) {
        y = dibujarFilaTabla(doc, columnas, encabezados, area.x, y, true, opciones);
      }
      y = dibujarFilaTabla(doc, columnas, fila, area.x, y, false, opciones);
      continue;
    }

    y = dibujarFilaEnVariasPaginas(doc, columnas, encabezados, fila, area.x, y, altoEncabezado, opciones);
  }

  return y;
}

export function medirTablaGenerica(
  doc: PDFKit.PDFDocument,
  columnas: ColumnaTabla[],
  filas: string[][],
  opciones: OpcionesTabla = {},
): number {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;
  let alto = conEncabezado ? alturaFilaTabla(doc, columnas, columnas.map((c) => c.header), true, base) : 0;
  for (const fila of filas) {
    alto += alturaFilaTabla(doc, columnas, fila, false, base);
  }
  return alto;
}

export function drawTablaDetalles(
  doc: PDFKit.PDFDocument,
  detalles: Detalle[],
  area: AreaRide,
  opciones: OpcionesTablaDetalles = {},
): number {
  const columnas = construirColumnas(area.width, especificacionDetalle(opciones));
  const filas = detalles.map((d) => celdasDetalle(d, opciones));
  return drawTablaGenerica(doc, columnas, filas, area, { tamano: TAMANO_DETALLE });
}
