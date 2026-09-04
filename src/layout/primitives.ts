import {
  FUENTE_NORMAL,
  FUENTE_NEGRITA,
  TAMANO_TITULO,
  TAMANO_TEXTO,
  COLOR_TEXTO,
  PADDING_CAJA,
  ESPACIO_LINEA,
  ANCHO_VALOR,
  TAMANO_MINIMO_AJUSTE,
} from './constants.js';
import { limiteInferior, alturaUtilPagina, partirTextoPorAltura } from './pagination.js';

export interface AreaRide {
  x: number;
  y: number;
  width: number;
}

export interface LineaCaja {
  texto: string;
  columnas?: ColumnaLinea[];
  valor?: string;
  anchoValor?: number;
  ancho?: number;
  negrita?: boolean;
  tamano?: number;
  color?: string;
  alineacion?: 'left' | 'center' | 'right';
  espaciadoCaracteres?: number;
  ajustar?: boolean;
  espaciador?: number;
  dibujar?: (x: number, y: number, ancho: number) => void;
}

export interface ColumnaLinea {
  texto: string;
  ancho: number;
  negrita?: boolean;
  tamano?: number;
  color?: string;
  alineacion?: 'left' | 'center' | 'right';
  espaciadoCaracteres?: number;
  ajustar?: boolean;
}

export interface OpcionesCaja {
  titulo?: string;
  alturaExtra?: number;
  dibujarExtra?: (x: number, y: number, anchoCaja: number) => void;
  altoMinimo?: number;
}

export function noVacio(v: string | undefined): v is string {
  return v !== undefined && v.trim() !== '';
}

export function aplicarFuente(doc: PDFKit.PDFDocument, linea: LineaCaja): void {
  doc
    .font(linea.negrita ? FUENTE_NEGRITA : FUENTE_NORMAL)
    .fontSize(linea.tamano ?? TAMANO_TEXTO)
    .fillColor(linea.color ?? COLOR_TEXTO);
}

export function aplicarFuenteColumna(doc: PDFKit.PDFDocument, columna: ColumnaLinea): number {
  doc.font(columna.negrita ? FUENTE_NEGRITA : FUENTE_NORMAL).fillColor(columna.color ?? COLOR_TEXTO);
  const base = columna.tamano ?? TAMANO_TEXTO;
  const tamano = columna.ajustar ? tamanoQueCabe(doc, columna.texto, columna.ancho, base) : base;
  doc.fontSize(tamano);
  return tamano;
}

export function opcionesColumna(columna: ColumnaLinea): PDFKit.Mixins.TextOptions {
  return {
    width: columna.ancho,
    align: columna.alineacion ?? 'left',
    characterSpacing: columna.espaciadoCaracteres,
  };
}

export function opcionesLinea(doc: PDFKit.PDFDocument, linea: LineaCaja, ancho: number): PDFKit.Mixins.TextOptions {
  if (linea.ajustar) {
    doc.fontSize(tamanoQueCabe(doc, linea.texto, ancho, linea.tamano ?? TAMANO_TEXTO));
  }
  return { width: ancho, align: linea.alineacion ?? 'left', characterSpacing: linea.espaciadoCaracteres };
}

export function alturaLinea(doc: PDFKit.PDFDocument, linea: LineaCaja, anchoCaja: number): number {
  if (linea.espaciador !== undefined) {
    return linea.espaciador;
  }
  if (linea.columnas) {
    return Math.max(
      ...linea.columnas.map((columna) => {
        aplicarFuenteColumna(doc, columna);
        return doc.heightOfString(columna.texto, opcionesColumna(columna));
      }),
    );
  }
  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  if (linea.valor === undefined) {
    return doc.heightOfString(linea.texto, opcionesLinea(doc, linea, ancho));
  }
  const anchoValor = linea.anchoValor ?? ANCHO_VALOR;
  return Math.max(
    doc.heightOfString(linea.texto, opcionesLinea(doc, linea, ancho - anchoValor - ESPACIO_LINEA)),
    doc.heightOfString(linea.valor, { width: anchoValor }),
  );
}

export function avanceLinea(doc: PDFKit.PDFDocument, linea: LineaCaja, anchoCaja: number): number {
  return alturaLinea(doc, linea, anchoCaja) + (linea.espaciador !== undefined ? 0 : ESPACIO_LINEA);
}

export function escribirTexto(
  doc: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  opciones: PDFKit.Mixins.TextOptions,
): void {
  doc.text(texto, x, y, { ...opciones, height: Infinity });
}

export function dibujarLinea(doc: PDFKit.PDFDocument, linea: LineaCaja, x: number, y: number, anchoCaja: number): void {
  if (linea.espaciador !== undefined) {
    linea.dibujar?.(x, y, anchoCaja);
    return;
  }
  if (linea.columnas) {
    let cx = x;
    for (const columna of linea.columnas) {
      aplicarFuenteColumna(doc, columna);
      escribirTexto(doc, columna.texto, cx, y, opcionesColumna(columna));
      cx += columna.ancho;
    }
    return;
  }
  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  if (linea.valor === undefined) {
    escribirTexto(doc, linea.texto, x, y, opcionesLinea(doc, linea, ancho));
    return;
  }
  const anchoValor = linea.anchoValor ?? ANCHO_VALOR;
  escribirTexto(doc, linea.texto, x, y, opcionesLinea(doc, linea, ancho - anchoValor - ESPACIO_LINEA));
  aplicarFuente(doc, linea);
  escribirTexto(doc, linea.valor, x + ancho - anchoValor, y, { width: anchoValor, align: 'right' });
}

export function dibujarBordeCaja(doc: PDFKit.PDFDocument, x: number, y: number, ancho: number, alto: number): void {
  doc.lineWidth(0.75).strokeColor(COLOR_TEXTO).rect(x, y, ancho, alto).stroke();
}

export function tamanoQueCabe(doc: PDFKit.PDFDocument, texto: string, ancho: number, base: number): number {
  if (texto === '' || /\s/.test(texto)) return base;
  doc.fontSize(base);
  if (doc.widthOfString(texto) <= ancho) return base;

  let tamano = base;
  while (tamano > TAMANO_MINIMO_AJUSTE) {
    tamano = Math.max(TAMANO_MINIMO_AJUSTE, tamano - 0.25);
    doc.fontSize(tamano);
    if (doc.widthOfString(texto) <= ancho) return tamano;
  }
  return TAMANO_MINIMO_AJUSTE;
}

export function lineaContinuacion(titulo: string): LineaCaja {
  return { texto: `${titulo} (continuación)`, negrita: true, tamano: TAMANO_TITULO };
}

export function partirLinea(doc: PDFKit.PDFDocument, linea: LineaCaja, anchoCaja: number, presupuesto: number): LineaCaja[] {
  if (linea.espaciador !== undefined || alturaLinea(doc, linea, anchoCaja) <= presupuesto) {
    return [linea];
  }

  if (linea.columnas) {
    const plano: LineaCaja = { texto: linea.columnas.map((c) => c.texto).join(' '), negrita: linea.columnas[0]?.negrita };
    return partirLinea(doc, plano, anchoCaja, presupuesto);
  }

  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  const anchoTexto = linea.valor === undefined ? ancho : ancho - (linea.anchoValor ?? ANCHO_VALOR) - ESPACIO_LINEA;
  const trozos = partirTextoPorAltura(doc, linea.texto, anchoTexto, presupuesto);
  return trozos.map((texto, i) => (i === 0 ? { ...linea, texto } : { ...linea, texto, valor: undefined }));
}

export function medirCaja(
  doc: PDFKit.PDFDocument,
  lineas: LineaCaja[],
  anchoArea: number,
  alturaExtra = 0,
): number {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  let alto = PADDING_CAJA * 2 + alturaExtra;
  for (const linea of lineas) {
    alto += avanceLinea(doc, linea, anchoCaja);
  }
  return alto;
}

export function dibujarCaja(
  doc: PDFKit.PDFDocument,
  area: AreaRide,
  lineas: LineaCaja[],
  opciones: OpcionesCaja = {},
): number {
  const anchoCaja = area.width - PADDING_CAJA * 2;
  const x = area.x + PADDING_CAJA;
  const alturaExtra = opciones.alturaExtra ?? 0;

  const altoContinuacion = opciones.titulo
    ? avanceLinea(doc, lineaContinuacion(opciones.titulo), anchoCaja)
    : 0;
  const presupuestoLinea = alturaUtilPagina(doc) - PADDING_CAJA * 2 - ESPACIO_LINEA - altoContinuacion;
  const lineasFinales = lineas.flatMap((linea) => partirLinea(doc, linea, anchoCaja, presupuestoLinea));

  let topCaja = area.y;
  let y = topCaja + PADDING_CAJA;
  if (opciones.dibujarExtra) {
    opciones.dibujarExtra(x, y, anchoCaja);
  }
  y += alturaExtra;

  let hayContenido = alturaExtra > 0;
  for (const linea of lineasFinales) {
    const alto = alturaLinea(doc, linea, anchoCaja);
    if (hayContenido && y + alto + PADDING_CAJA > limiteInferior(doc)) {
      dibujarBordeCaja(doc, area.x, topCaja, area.width, y + PADDING_CAJA - topCaja);
      doc.addPage();
      topCaja = doc.page.margins.top;
      y = topCaja + PADDING_CAJA;
      if (opciones.titulo) {
        const continuacion = lineaContinuacion(opciones.titulo);
        dibujarLinea(doc, continuacion, x, y, anchoCaja);
        y += avanceLinea(doc, continuacion, anchoCaja);
      }
    }
    dibujarLinea(doc, linea, x, y, anchoCaja);
    y += avanceLinea(doc, linea, anchoCaja);
    hayContenido = true;
  }

  const abajo = Math.max(y + PADDING_CAJA, Math.min(topCaja + (opciones.altoMinimo ?? 0), limiteInferior(doc)));
  dibujarBordeCaja(doc, area.x, topCaja, area.width, abajo - topCaja);
  return abajo;
}
