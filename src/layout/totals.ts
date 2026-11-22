import type { TotalImpuesto } from '../types.js';
import type { TotalesRide, EtiquetasTotales } from '../types.js';
import { fromCents, formatMonto, toCents } from '../money.js';
import {
  CODIGO_IMPUESTO_IVA,
  CODIGO_IMPUESTO_ICE,
  CODIGO_IMPUESTO_IRBPNR,
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
  subtotalCero: 'SUBTOTAL 0%',
  subtotalNoObjeto: 'SUBTOTAL NO OBJETO DE IVA',
  subtotalExento: 'SUBTOTAL EXENTO DE IVA',
  subtotalSinImpuestos: 'SUBTOTAL SIN IMPUESTOS',
  descuento: 'TOTAL DESCUENTO',
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

// Tarifas con fila propia en el Anexo 2; el resto se agrupa como tarifa especial.
const CODIGOS_TARIFA_CON_SUBTOTAL = new Set([
  '2',
  '3',
  '4',
  '5',
  '10',
  CODIGO_PORCENTAJE_CERO,
  CODIGO_PORCENTAJE_NO_OBJETO,
  CODIGO_PORCENTAJE_EXENTO,
]);

const CODIGOS_SIN_IVA = new Set([CODIGO_PORCENTAJE_CERO, CODIGO_PORCENTAJE_NO_OBJETO, CODIGO_PORCENTAJE_EXENTO]);

function tarifaNumerica(codigoPorcentaje: string): number {
  const etiqueta = LABEL_CODIGO_PORCENTAJE[codigoPorcentaje];
  const valor = etiqueta?.endsWith('%') ? Number(etiqueta.slice(0, -1)) : Number(codigoPorcentaje);
  return Number.isFinite(valor) ? valor : Number.MAX_SAFE_INTEGER;
}

/** Tarifas de menor a mayor (5 % antes que 12 %, 14 %, 15 %...), como en el Anexo 2. */
function ordenarTarifas(grupos: Map<string, number>): Array<[string, number]> {
  return [...grupos].sort(([a], [b]) => tarifaNumerica(a) - tarifaNumerica(b));
}

function filasTotales(totales: TotalesRide): string[][] {
  const etiquetas = { ...ETIQUETAS_TOTALES_FACTURA, ...totales.etiquetas };
  const bases = basesPorCodigoPorcentaje(totales.impuestos);
  const filas: string[][] = [];

  const basesEspeciales = [...bases].filter(([codigo]) => !CODIGOS_TARIFA_CON_SUBTOTAL.has(codigo));
  for (const [codigo] of basesEspeciales) bases.delete(codigo);
  const baseEspecial = basesEspeciales.reduce((total, [, cents]) => total + cents, 0);
  if (baseEspecial > 0) {
    filas.push(['SUBTOTAL TARIFA ESPECIAL', fromCents(baseEspecial)]);
  }

  for (const [codigo, cents] of ordenarTarifas(bases)) {
    if (CODIGOS_SIN_IVA.has(codigo)) continue;
    filas.push([`SUBTOTAL ${LABEL_CODIGO_PORCENTAJE[codigo] ?? codigo}`, fromCents(cents)]);
  }

  for (const [etiqueta, codigo] of [
    [etiquetas.subtotalCero, CODIGO_PORCENTAJE_CERO],
    [etiquetas.subtotalNoObjeto, CODIGO_PORCENTAJE_NO_OBJETO],
    [etiquetas.subtotalExento, CODIGO_PORCENTAJE_EXENTO],
  ] as const) {
    filas.push([etiqueta, fromCents(bases.get(codigo) ?? 0)]);
  }

  filas.push([etiquetas.subtotalSinImpuestos, formatMonto(totales.totalSinImpuestos, 2)]);

  if (totales.totalDescuento !== undefined) {
    filas.push([etiquetas.descuento, formatMonto(totales.totalDescuento, 2)]);
  }

  const valoresPorCodigo = agruparValorPorCodigo(totales.impuestos);
  filas.push(['ICE', fromCents(valoresPorCodigo.get(CODIGO_IMPUESTO_ICE) ?? 0)]);

  const iva = valorIvaPorTarifa(totales.impuestos);
  const ivaEspecial = [...iva].filter(([codigo]) => !CODIGOS_TARIFA_CON_SUBTOTAL.has(codigo));
  for (const [codigo] of ivaEspecial) iva.delete(codigo);
  const totalIvaEspecial = ivaEspecial.reduce((total, [, cents]) => total + cents, 0);
  if (totalIvaEspecial > 0) {
    filas.push(['IVA TARIFA ESPECIAL', fromCents(totalIvaEspecial)]);
  }
  for (const [codigo, cents] of ordenarTarifas(iva)) {
    if (CODIGOS_SIN_IVA.has(codigo)) continue;
    filas.push([`IVA ${LABEL_CODIGO_PORCENTAJE[codigo] ?? codigo}`, fromCents(cents)]);
  }

  filas.push(['TOTAL DEVOLUCION IVA', formatMonto(totales.devolucionIva ?? '0.00', 2)]);

  filas.push(['IRBPNR', fromCents(valoresPorCodigo.get(CODIGO_IMPUESTO_IRBPNR) ?? 0)]);

  for (const [codigo, cents] of valoresPorCodigo) {
    if (codigo === CODIGO_IMPUESTO_ICE || codigo === CODIGO_IMPUESTO_IVA || codigo === CODIGO_IMPUESTO_IRBPNR) {
      continue;
    }
    filas.push([LABEL_IMPUESTO[codigo] ?? `OTRO IMPUESTO (CÓDIGO ${codigo})`, fromCents(cents)]);
  }

  // El Anexo 2 no fija PROPINA: solo se imprime cuando el comprobante la trae.
  if (totales.propina !== undefined && toCents(totales.propina) > 0) {
    filas.push(['PROPINA', formatMonto(totales.propina, 2)]);
  }

  filas.push([etiquetas.valorTotal, formatMonto(totales.importeTotal, 2)]);
  return filas;
}

function valorIvaPorTarifa(impuestos: TotalImpuesto[]): Map<string, number> {
  const grupos = new Map<string, number>();
  for (const imp of impuestos) {
    if (imp.codigo !== CODIGO_IMPUESTO_IVA) continue;
    grupos.set(imp.codigoPorcentaje, (grupos.get(imp.codigoPorcentaje) ?? 0) + toCents(imp.valor));
  }
  return grupos;
}

function filasSubsidio(totales: TotalesRide): string[][] {
  if (!totales.conSubsidio) return [];
  return [
    ['VALOR TOTAL SIN SUBSIDIO', formatMonto(totales.importeTotal, 2)],
    ['AHORRO POR SUBSIDIO (Incluye IVA cuando corresponda)', '0.00'],
  ];
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
