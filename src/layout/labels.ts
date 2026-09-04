import type { Ambiente, TipoComprobante, TipoEmision } from '../types.js';
import {
  CODIGO_IMPUESTO_IRBPNR,
} from './constants.js';

export const FormaPago = {
  EFECTIVO: '01',
  COMPENSACION_DEUDAS: '15',
  TARJETA_DEBITO: '16',
  DINERO_ELECTRONICO: '17',
  TARJETA_PREPAGO: '18',
  TARJETA_CREDITO: '19',
  OTROS_SISTEMA_FINANCIERO: '20',
  ENDOSO_TITULOS: '21',
} as const;
export type FormaPago = (typeof FormaPago)[keyof typeof FormaPago];

const LABEL_IMPUESTO: Record<string, string> = {
  [CODIGO_IMPUESTO_IRBPNR]: 'IRBPNR',
};

const LABEL_CODIGO_PORCENTAJE: Record<string, string> = {
  '0': '0%',
  '2': '12%',
  '3': '14%',
  '4': '15%',
  '5': '5%',
  '6': 'No objeto de IVA',
  '7': 'Exento de IVA',
  '8': 'IVA diferenciado',
  '10': '13%',
};

const LABEL_FORMA_PAGO: Record<string, string> = {
  [FormaPago.EFECTIVO]: 'Sin utilización del sistema financiero',
  [FormaPago.COMPENSACION_DEUDAS]: 'Compensación de deudas',
  [FormaPago.TARJETA_DEBITO]: 'Tarjeta de débito',
  [FormaPago.DINERO_ELECTRONICO]: 'Dinero electrónico',
  [FormaPago.TARJETA_PREPAGO]: 'Tarjeta prepago',
  [FormaPago.TARJETA_CREDITO]: 'Tarjeta de crédito',
  [FormaPago.OTROS_SISTEMA_FINANCIERO]: 'Otros con utilización del sistema financiero',
  [FormaPago.ENDOSO_TITULOS]: 'Endoso de títulos',
};

export const LABEL_AMBIENTE: Record<Ambiente, string> = {
  ['1']: 'PRUEBAS',
  ['2']: 'PRODUCCIÓN',
};

export const LABEL_TIPO_EMISION: Record<TipoEmision, string> = {
  ['1']: 'NORMAL',
};

export const LABEL_TIPO_IDENTIFICACION: Record<string, string> = {
  '04': 'RUC',
  '05': 'Cédula de Identidad',
  '06': 'Pasaporte',
  '07': 'Consumidor Final',
  '08': 'Identificación del Exterior',
};

const NOMBRE_POR_COD_DOC: Record<string, string> = {
  ['01']: 'Factura',
  ['03']: 'Liquidación de Compra',
  ['04']: 'Nota de Crédito',
  ['05']: 'Nota de Débito',
  ['06']: 'Guía de Remisión',
  ['07']: 'Comprobante de Retención',
};

export function etiquetaCatalogo<T extends string>(mapa: Record<T, string>, codigo: T | undefined): string {
  if (codigo === undefined) return '';
  return mapa[codigo] ?? String(codigo);
}

export function nombreDocumento(tipo: TipoComprobante): string {
  switch (tipo) {
    case '01':
      return 'FACTURA';
    case '03':
      return 'LIQUIDACIÓN DE COMPRA DE BIENES Y PRESTACIÓN DE SERVICIOS';
    case '04':
      return 'NOTA DE CRÉDITO';
    case '05':
      return 'NOTA DE DÉBITO';
    case '06':
      return 'GUÍA DE REMISIÓN';
    case '07':
      return 'COMPROBANTE DE RETENCIÓN';
  }
}

export function nombreDocumentoPorCodigo(codDoc: string): string {
  return NOMBRE_POR_COD_DOC[codDoc] ?? codDoc;
}

export function tipoIdentificacionLabel(codigo: string): string {
  return LABEL_TIPO_IDENTIFICACION[codigo] ?? codigo;
}

export function identificacionConTipo(identificacion: string, tipo?: string): string {
  return tipo ? `${identificacion} (${tipoIdentificacionLabel(tipo)})` : identificacion;
}

export function formaPagoLabel(codigo: string): string {
  return LABEL_FORMA_PAGO[codigo] ?? codigo;
}

export function formatNumeroComprobante(info: { estab: string; ptoEmi: string; secuencial: string }): string {
  return `${info.estab}-${info.ptoEmi}-${info.secuencial}`;
}

export { LABEL_IMPUESTO, LABEL_CODIGO_PORCENTAJE };
