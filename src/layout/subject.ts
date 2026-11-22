import type { CompradorRide } from '../types.js';
import { FRACCIONES_BANDA, PADDING_CAJA, TAMANO_TITULO } from './constants.js';
import type { AreaRide, LineaCaja, ColumnaLinea } from './primitives.js';
import {
  dibujarCaja,
  medirCaja,
  noVacio,
} from './primitives.js';

export interface ParBanda {
  etiqueta: string;
  valor: string;
}

export interface FilaBanda {
  izquierda: ParBanda;
  derecha?: ParBanda;
  /** Tercer par de la fila (p.ej. Guía Remisión junto a Placa / Matrícula). */
  extra?: ParBanda;
  fracciones?: readonly number[];
}

// Fecha Emisión | Placa / Matrícula | Guía Remisión, en una sola fila.
const FRACCIONES_FECHA_PLACA_GUIA = [0.18, 0.15, 0.19, 0.14, 0.19, 0.15] as const;

export function drawBandaSujeto(
  doc: PDFKit.PDFDocument,
  filas: FilaBanda[],
  area: AreaRide,
  titulo?: string,
): number {
  return dibujarCaja(doc, area, lineasBanda(filas, area.width, titulo), { titulo });
}

export function medirBandaSujeto(
  doc: PDFKit.PDFDocument,
  filas: FilaBanda[],
  ancho: number,
  titulo?: string,
): number {
  return medirCaja(doc, lineasBanda(filas, ancho, titulo), ancho);
}

function lineasBanda(filas: FilaBanda[], anchoArea: number, titulo?: string): LineaCaja[] {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;

  const anchosDe = (fracciones: readonly number[]): number[] => {
    const total = fracciones.reduce((s, f) => s + f, 0);
    const anchos = fracciones.map((f) => Math.floor((anchoCaja * f) / total));
    anchos[anchos.length - 1] = anchoCaja - anchos.slice(0, -1).reduce((s, a) => s + a, 0);
    return anchos;
  };

  const lineas: LineaCaja[] = titulo ? [{ texto: titulo, negrita: true, tamano: TAMANO_TITULO }] : [];
  for (const fila of filas) {
    const pares = [fila.izquierda, fila.derecha, fila.extra].filter((par): par is ParBanda => par !== undefined);
    const anchos = anchosDe(fila.fracciones ?? FRACCIONES_BANDA);
    const columnas: ColumnaLinea[] =
      pares.length === 1
        ? [
            { texto: pares[0].etiqueta, ancho: anchos[0], negrita: true },
            { texto: pares[0].valor, ancho: anchoCaja - anchos[0], ajustar: true },
          ]
        : pares.flatMap((par, i) => [
            { texto: par.etiqueta, ancho: anchos[i * 2] ?? 0, negrita: true },
            { texto: par.valor, ancho: anchos[i * 2 + 1] ?? 0, ajustar: true },
          ]);
    lineas.push({ texto: fila.izquierda.etiqueta, columnas });
  }
  return lineas;
}

export type VarianteComprador = 'factura' | 'documento' | 'identificacion-propia';

export function drawComprador(
  doc: PDFKit.PDFDocument,
  comprador: CompradorRide,
  area: AreaRide,
  variante: VarianteComprador = 'documento',
  filasExtra: FilaBanda[] = [],
): number {
  return drawBandaSujeto(
    doc,
    filasComprador(comprador, variante, filasExtra),
    area,
    comprador.etiquetaSujeto?.toUpperCase(),
  );
}

/**
 * Filas del sujeto según el modelo del Anexo 2. La factura (figura-01) lleva
 * identificación en fila propia, placa y guía junto a la fecha de emisión, y
 * dirección; la nota de débito (figura-03) identificación en fila propia sin
 * placa ni dirección; nota de crédito (figura-02) y retención (figura-04)
 * razón social con la identificación al lado y fecha de emisión. Las notas
 * añaden en la misma caja el comprobante que modifican (`filasExtra`).
 */
function filasComprador(
  comprador: CompradorRide,
  variante: VarianteComprador,
  filasExtra: FilaBanda[],
): FilaBanda[] {
  const identificacion = noVacio(comprador.identificacion) ? comprador.identificacion : '';
  const razonSocial = { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: comprador.razonSocial };
  const parIdentificacion = { etiqueta: 'Identificación:', valor: identificacion };
  const parFecha = { etiqueta: 'Fecha Emisión:', valor: comprador.fechaEmision };

  if (variante === 'factura') {
    return [
      { izquierda: razonSocial },
      { izquierda: parIdentificacion },
      {
        izquierda: parFecha,
        derecha: { etiqueta: 'Placa / Matrícula:', valor: comprador.placa ?? '' },
        extra: { etiqueta: 'Guía Remisión:', valor: comprador.guiaRemision ?? '' },
        fracciones: FRACCIONES_FECHA_PLACA_GUIA,
      },
      { izquierda: { etiqueta: 'Dirección:', valor: comprador.direccion ?? '' } },
      ...filasExtra,
    ];
  }

  if (variante === 'identificacion-propia') {
    return [{ izquierda: razonSocial }, { izquierda: parIdentificacion }, { izquierda: parFecha }, ...filasExtra];
  }

  return [{ izquierda: razonSocial, derecha: parIdentificacion }, { izquierda: parFecha }, ...filasExtra];
}

export function medirComprador(
  doc: PDFKit.PDFDocument,
  comprador: CompradorRide,
  ancho: number,
  variante: VarianteComprador = 'documento',
  filasExtra: FilaBanda[] = [],
): number {
  return medirBandaSujeto(
    doc,
    filasComprador(comprador, variante, filasExtra),
    ancho,
    comprador.etiquetaSujeto?.toUpperCase(),
  );
}
