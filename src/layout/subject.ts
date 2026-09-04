import type { CompradorRide } from '../types.js';
import { FRACCIONES_BANDA, PADDING_CAJA, TAMANO_TITULO } from './constants.js';
import { LABEL_TIPO_IDENTIFICACION } from './labels.js';
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
  fracciones?: readonly [number, number, number, number];
}

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
    anchos[3] = anchoCaja - anchos[0] - anchos[1] - anchos[2];
    return anchos;
  };

  const lineas: LineaCaja[] = titulo ? [{ texto: titulo, negrita: true, tamano: TAMANO_TITULO }] : [];
  for (const fila of filas) {
    const anchos = anchosDe(fila.fracciones ?? FRACCIONES_BANDA);
    const columnas: ColumnaLinea[] =
      fila.derecha === undefined
        ? [
            { texto: fila.izquierda.etiqueta, ancho: anchos[0], negrita: true },
            { texto: fila.izquierda.valor, ancho: anchoCaja - anchos[0], ajustar: true },
          ]
        : [
            { texto: fila.izquierda.etiqueta, ancho: anchos[0], negrita: true },
            { texto: fila.izquierda.valor, ancho: anchos[1], ajustar: true },
            { texto: fila.derecha.etiqueta, ancho: anchos[2], negrita: true },
            { texto: fila.derecha.valor, ancho: anchos[3], ajustar: true },
          ];
    lineas.push({ texto: fila.izquierda.etiqueta, columnas });
  }
  return lineas;
}

export function drawComprador(doc: PDFKit.PDFDocument, comprador: CompradorRide, area: AreaRide): number {
  return drawBandaSujeto(doc, filasComprador(comprador), area, tituloComprador(comprador));
}

function tituloComprador(comprador: CompradorRide): string | undefined {
  return comprador.etiquetaSujeto?.toUpperCase();
}

function filasComprador(comprador: CompradorRide): FilaBanda[] {
  const tipo = comprador.tipoIdentificacion
    ? ` (${LABEL_TIPO_IDENTIFICACION[comprador.tipoIdentificacion] ?? comprador.tipoIdentificacion})`
    : '';

  const pares: Array<[string, string | undefined]> = [
    ['Razón Social / Nombres y Apellidos:', noVacio(comprador.razonSocial) ? comprador.razonSocial : undefined],
    ['Identificación:', noVacio(comprador.identificacion) ? `${comprador.identificacion}${tipo}` : undefined],
    ['Fecha Emisión:', noVacio(comprador.fechaEmision) ? comprador.fechaEmision : undefined],
    ['Guía Remisión:', noVacio(comprador.guiaRemision) ? comprador.guiaRemision : undefined],
    ['Dirección:', noVacio(comprador.direccion) ? comprador.direccion : undefined],
  ];

  return emparejarFilas(pares);
}

function emparejarFilas(pares: Array<[string, string | undefined]>): FilaBanda[] {
  const presentes = pares
    .filter((par): par is [string, string] => par[1] !== undefined)
    .map(([etiqueta, valor]) => ({ etiqueta, valor }));

  const filas: FilaBanda[] = [];
  for (let i = 0; i < presentes.length; i += 2) {
    filas.push({ izquierda: presentes[i], derecha: presentes[i + 1] });
  }
  return filas;
}

export function medirComprador(doc: PDFKit.PDFDocument, comprador: CompradorRide, ancho: number): number {
  return medirBandaSujeto(doc, filasComprador(comprador), ancho, tituloComprador(comprador));
}
