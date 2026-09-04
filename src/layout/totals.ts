import type { TotalImpuesto } from '../types.js';
import type { TotalesRide, EtiquetasTotales } from '../types.js';
import { fromCents, formatMonto, toCents } from '../money.js';
import {
  CODIGO_IMPUESTO_IVA,
  CODIGO_IMPUESTO_ICE,
  CODIGO_PORCENTAJE_CERO,
  CODIGO_PORCENTAJE_NO_OBJETO,
  CODIGO_PORCENTAJE_EXENTO,
  SEPARACION_SUBSIDIO,
  TAMANO_TABLA,
  TAMANO_TEXTO,
} from './constants.js';
import { construirColumnas, drawTablaGenerica, medirTablaGenerica, ColumnaTabla, OpcionesTabla } from './details.js';
import { LABEL_IMPUESTO, LABEL_CODIGO_PORCENTAJE } from './labels.js';
import type { AreaRide } from './primitives.js';

export { EtiquetasTotales };

const ETIQUETAS_TOTALES_FACTURA: EtiquetasTotales = {
  subtotalCero: 'SUBTOTAL IVA 0%',
  subtotalNoObjeto: 'SUBTOTAL NO OBJETO IVA',
  subtotalExento: 'SUBTOTAL EXENTO IVA',
  subtotalSinImpuestos: 'SUBTOTAL SIN IMPUESTOS',
  descuento: 'DESCUENTO',
  valorTotal: 'VALOR TOTAL',
};

const OPCIONES_TABLA_TOTALES: OpcionesTabla = { conEncabezado: false, tamano: TAMANO_TABLA };
const OPCIONES_TABLA_SUBSIDIO: OpcionesTabla = { conEncabezado: false, tamano: TAMANO_TEXTO, divisores: false };

function columnasTotales(ancho: number): ColumnaTabla[] {
  return construirColumnas(ancho, [
    ['', 0.72, 'left'],
    ['', 0.28, 'right'],
  ]);
}

function basesPorCodigoPorcentaje(impuestos: TotalImpuesto[]): Map<string, number> {
  const grupos = new Map<string, number>();
  for (const imp of impuestos) {
    if (imp.codigo !== CODIGO_IMPUESTO_IVA) continue;
    grupos.set(imp.codigoPorcentaje, (grupos.get(imp.codigoPorcentaje) ?? 0) + toCents(imp.baseImponible));
  }
  return grupos;
}

function agruparValorPorCodigo(impuestos: TotalImpuesto[]): Map<string, number> {
  const grupos = new Map<string, number>();
  for (const imp of impuestos) {
    grupos.set(imp.codigo, (grupos.get(imp.codigo) ?? 0) + toCents(imp.valor));
  }
  return grupos;
}

function filasTotales(totales: TotalesRide): string[][] {
  const etiquetas = { ...ETIQUETAS_TOTALES_FACTURA, ...totales.etiquetas };
  const bases = basesPorCodigoPorcentaje(totales.impuestos);
  const filas: string[][] = [];

  const filaSubtotal = (etiqueta: string, codigoPorcentaje: string): void => {
    const cents = bases.get(codigoPorcentaje);
    bases.delete(codigoPorcentaje);
    filas.push([etiqueta, fromCents(cents ?? 0)]);
  };

  for (const [codigoPorcentaje, cents] of [...bases]) {
    if (
      codigoPorcentaje === CODIGO_PORCENTAJE_CERO ||
      codigoPorcentaje === CODIGO_PORCENTAJE_NO_OBJETO ||
      codigoPorcentaje === CODIGO_PORCENTAJE_EXENTO
    ) {
      continue;
    }
    bases.delete(codigoPorcentaje);
    filas.push([`SUBTOTAL ${LABEL_CODIGO_PORCENTAJE[codigoPorcentaje] ?? codigoPorcentaje}`, fromCents(cents)]);
  }

  filaSubtotal(etiquetas.subtotalCero, CODIGO_PORCENTAJE_CERO);
  filaSubtotal(etiquetas.subtotalNoObjeto, CODIGO_PORCENTAJE_NO_OBJETO);
  filaSubtotal(etiquetas.subtotalExento, CODIGO_PORCENTAJE_EXENTO);

  filas.push([etiquetas.subtotalSinImpuestos, formatMonto(totales.totalSinImpuestos, 2)]);

  if (totales.totalDescuento !== undefined) {
    filas.push([etiquetas.descuento, formatMonto(totales.totalDescuento, 2)]);
  }

  const grupos = agruparValorPorCodigo(totales.impuestos);

  const ice = grupos.get(CODIGO_IMPUESTO_ICE);
  if (ice !== undefined) {
    filas.push(['ICE', fromCents(ice)]);
  }

  filas.push([`IVA${sufijoTarifaIva(totales.impuestos)}`, fromCents(grupos.get(CODIGO_IMPUESTO_IVA) ?? 0)]);

  for (const [codigo, cents] of grupos) {
    if (codigo === CODIGO_IMPUESTO_ICE || codigo === CODIGO_IMPUESTO_IVA) continue;
    filas.push([LABEL_IMPUESTO[codigo] ?? `OTRO IMPUESTO (CÓDIGO ${codigo})`, fromCents(cents)]);
  }

  if (totales.conPropina) {
    filas.push(['PROPINA', formatMonto(totales.propina ?? '0.00', 2)]);
  } else if (totales.propina) {
    filas.push(['PROPINA', formatMonto(totales.propina, 2)]);
  }

  if (totales.moneda) {
    filas.push(['MONEDA', totales.moneda]);
  }

  filas.push([etiquetas.valorTotal, formatMonto(totales.importeTotal, 2)]);
  return filas;
}

function filasSubsidio(totales: TotalesRide): string[][] {
  if (!totales.conSubsidio) return [];
  return [
    ['VALOR TOTAL SIN SUBSIDIO', formatMonto(totales.importeTotal, 2)],
    ['AHORRO POR SUBSIDIO (incluye IVA cuando corresponda)', '0.00'],
  ];
}

function sufijoTarifaIva(impuestos: TotalImpuesto[]): string {
  const tarifas = new Set(
    impuestos
      .filter(
        (imp) =>
          imp.codigo === CODIGO_IMPUESTO_IVA &&
          imp.codigoPorcentaje !== CODIGO_PORCENTAJE_CERO &&
          imp.codigoPorcentaje !== CODIGO_PORCENTAJE_NO_OBJETO &&
          imp.codigoPorcentaje !== CODIGO_PORCENTAJE_EXENTO,
      )
      .map((imp) => LABEL_CODIGO_PORCENTAJE[imp.codigoPorcentaje] ?? imp.codigoPorcentaje),
  );
  return tarifas.size === 1 ? ` ${[...tarifas][0]}` : '';
}

export function drawTotales(doc: PDFKit.PDFDocument, totales: TotalesRide, area: AreaRide): number {
  const columnas = columnasTotales(area.width);
  let y = drawTablaGenerica(doc, columnas, filasTotales(totales), area, OPCIONES_TABLA_TOTALES);

  const subsidio = filasSubsidio(totales);
  if (subsidio.length > 0) {
    y += SEPARACION_SUBSIDIO;
    y = drawTablaGenerica(doc, columnasTotales(area.width), subsidio, { ...area, y }, OPCIONES_TABLA_SUBSIDIO);
  }
  return y;
}

export function medirTotales(doc: PDFKit.PDFDocument, totales: TotalesRide, ancho: number): number {
  const columnas = columnasTotales(ancho);
  let alto = medirTablaGenerica(doc, columnas, filasTotales(totales), OPCIONES_TABLA_TOTALES);
  const subsidio = filasSubsidio(totales);
  if (subsidio.length > 0) {
    alto += SEPARACION_SUBSIDIO + medirTablaGenerica(doc, columnas, subsidio, OPCIONES_TABLA_SUBSIDIO);
  }
  return alto;
}
