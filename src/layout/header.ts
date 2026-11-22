import { RideError } from '../errors.js';
import { dibujarCode128 } from '../barcode/code128.js';
import { dibujarQr } from '../qr/qr-vector.js';
import type { QrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, EmisorRide } from '../types.js';
import {
  FUENTE_NEGRITA,
  TAMANO_TITULO,
  TAMANO_TABLA,
  COLOR_NO_AUTORIZADO,
  PADDING_CAJA,
  ESPACIO_LINEA,
  QR_LADO,
  ALTURA_CODIGO_BARRAS,
  SEPARACION_COLUMNAS,
  ALTURA_IMAGEN_LOGO,
  ALTURA_LOGO,
  FRACCION_ETIQUETA_DIRECCION,
  FRACCION_ETIQUETA_ANCHA,
} from './constants.js';
import { asegurarEspacio } from './pagination.js';
import {
  etiquetaCatalogo,
  LABEL_AMBIENTE,
  LABEL_TIPO_EMISION,
} from './labels.js';
import type { AreaRide, LineaCaja } from './primitives.js';
import {
  dibujarCaja,
  medirCaja,
  noVacio,
} from './primitives.js';

export interface CabeceraRide {
  emisor: EmisorRide;
  comprobante: ComprobanteRide;
  qr?: QrMatrix;
  codigoBarras?: boolean;
}

export function drawCabecera(doc: PDFKit.PDFDocument, cabecera: CabeceraRide, area: AreaRide): number {
  const { anchoIzquierda, anchoDerecha } = anchosCabecera(area.width);
  const codigoBarras = cabecera.codigoBarras ?? true;

  const altoIzquierda = medirEmisor(doc, cabecera.emisor, anchoIzquierda);
  const altoDerecha = medirComprobante(doc, cabecera.comprobante, anchoDerecha, cabecera.qr !== undefined, codigoBarras);
  const alto = Math.max(altoIzquierda, altoDerecha);

  const y = asegurarEspacio(doc, area.y, alto);

  const altoMinimoEmisor = cabecera.emisor.logo ? alto : undefined;
  const abajoIzquierda = drawEmisor(doc, cabecera.emisor, { x: area.x, y, width: anchoIzquierda }, altoMinimoEmisor);
  const abajoDerecha = drawComprobante(
    doc,
    cabecera.comprobante,
    { x: area.x + anchoIzquierda + SEPARACION_COLUMNAS, y, width: anchoDerecha },
    cabecera.qr,
    codigoBarras,
    alto,
  );
  return Math.max(abajoIzquierda, abajoDerecha);
}

export function medirCabecera(doc: PDFKit.PDFDocument, cabecera: CabeceraRide, ancho: number): number {
  const { anchoIzquierda, anchoDerecha } = anchosCabecera(ancho);
  return Math.max(
    medirEmisor(doc, cabecera.emisor, anchoIzquierda),
    medirComprobante(doc, cabecera.comprobante, anchoDerecha, cabecera.qr !== undefined, cabecera.codigoBarras ?? true),
  );
}

function anchosCabecera(ancho: number): { anchoIzquierda: number; anchoDerecha: number } {
  const anchoIzquierda = Math.floor((ancho - SEPARACION_COLUMNAS) / 2);
  return { anchoIzquierda, anchoDerecha: ancho - anchoIzquierda - SEPARACION_COLUMNAS };
}

export function drawEmisor(
  doc: PDFKit.PDFDocument,
  emisor: EmisorRide,
  area: AreaRide,
  altoMinimo?: number,
): number {
  let y = area.y;
  if (emisor.logo) {
    dibujarLogo(doc, emisor.logo, area.x, y, area.width);
    y += ALTURA_LOGO;
  }
  return dibujarCaja(doc, { ...area, y }, lineasEmisor(emisor, area.width), {
    altoMinimo: altoMinimo !== undefined ? altoMinimo - (y - area.y) : undefined,
  });
}

function dibujarLogo(doc: PDFKit.PDFDocument, logo: Uint8Array, x: number, y: number, ancho: number): void {
  try {
    const logoData = logo.slice().buffer;
    doc.image(logoData, x, y, { fit: [ancho, ALTURA_IMAGEN_LOGO], align: 'center', valign: 'center' });
  } catch {
    throw new RideError(
      'El logo del emisor no se pudo procesar: formato no soportado o archivo corrupto. Usa PNG o JPG.',
      'RIDE_INVALID_LOGO',
    );
  }
}

function filaEtiquetaValor(
  anchoCaja: number,
  etiqueta: string,
  valor: string,
  fraccionEtiqueta: number,
  opciones: { alinearValorDerecha?: boolean; tamano?: number } = {},
): LineaCaja {
  const anchoEtiqueta = Math.floor(anchoCaja * fraccionEtiqueta);
  return {
    texto: etiqueta,
    columnas: [
      { texto: etiqueta, ancho: anchoEtiqueta, negrita: true, tamano: opciones.tamano },
      {
        texto: valor,
        ancho: anchoCaja - anchoEtiqueta,
        tamano: opciones.tamano,
        alineacion: opciones.alinearValorDerecha ? 'right' : 'left',
        ajustar: true,
      },
    ],
  };
}

function lineasEmisor(emisor: EmisorRide, anchoArea: number): LineaCaja[] {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const lineas: LineaCaja[] = [{ texto: emisor.razonSocial, negrita: true, tamano: TAMANO_TITULO }];
  if (emisor.nombreComercial) {
    lineas.push({ texto: emisor.nombreComercial, tamano: TAMANO_TABLA });
  }
  lineas.push({ texto: '', espaciador: ESPACIO_LINEA * 2 });

  lineas.push(filaEtiquetaValor(anchoCaja, 'Dirección Matriz:', emisor.dirMatriz, FRACCION_ETIQUETA_DIRECCION));
  lineas.push(
    filaEtiquetaValor(anchoCaja, 'Dirección Sucursal:', emisor.dirEstablecimiento ?? '', FRACCION_ETIQUETA_DIRECCION),
  );
  if (noVacio(emisor.contribuyenteEspecial)) {
    lineas.push(
      filaEtiquetaValor(anchoCaja, 'Contribuyente Especial Nro', emisor.contribuyenteEspecial, FRACCION_ETIQUETA_ANCHA, {
        alinearValorDerecha: true,
      }),
    );
  }
  if (emisor.obligadoContabilidad) {
    lineas.push(
      filaEtiquetaValor(anchoCaja, 'OBLIGADO A LLEVAR CONTABILIDAD', emisor.obligadoContabilidad, FRACCION_ETIQUETA_ANCHA, {
        alinearValorDerecha: true,
      }),
    );
  }
  if (noVacio(emisor.agenteRetencion)) {
    lineas.push(
      filaEtiquetaValor(
        anchoCaja,
        'Agente de Retención Resolución No.',
        emisor.agenteRetencion,
        FRACCION_ETIQUETA_ANCHA,
        { alinearValorDerecha: true },
      ),
    );
  }
  for (const [etiqueta, valor] of [
    ['Contribuyente Régimen RIMPE:', emisor.contribuyenteRimpe],
    ['RISE:', emisor.rise],
  ] as const) {
    if (noVacio(valor)) {
      lineas.push(filaEtiquetaValor(anchoCaja, etiqueta, valor, 0.45));
    }
  }
  return lineas;
}

export function medirEmisor(doc: PDFKit.PDFDocument, emisor: EmisorRide, ancho: number): number {
  return medirCaja(doc, lineasEmisor(emisor, ancho), ancho) + (emisor.logo ? ALTURA_LOGO : 0);
}

export function drawComprobante(
  doc: PDFKit.PDFDocument,
  comprobante: ComprobanteRide,
  area: AreaRide,
  qr?: QrMatrix,
  codigoBarras = true,
  altoMinimo?: number,
): number {
  return dibujarCaja(doc, area, lineasComprobante(doc, comprobante, area.width, qr, codigoBarras), { altoMinimo });
}

function ajustarNombreDocumento(
  doc: PDFKit.PDFDocument,
  nombre: string,
  anchoCaja: number,
): { tamano: number; espaciado: number } {
  const TAMANO_MAX = TAMANO_TITULO + 3;
  const ESPACIADO_MAX = 2.5;

  const lineas = (espaciado: number): number => {
    const alto = doc.heightOfString(nombre, { width: anchoCaja, characterSpacing: espaciado });
    return Math.max(1, Math.round(alto / doc.heightOfString('X', { width: anchoCaja })));
  };

  doc.font(FUENTE_NEGRITA);
  for (const maxLineas of [1, 2]) {
    let tamano = TAMANO_MAX;
    let espaciado = ESPACIADO_MAX;
    while (tamano > TAMANO_TABLA) {
      doc.fontSize(tamano);
      if (lineas(espaciado) <= maxLineas) {
        return { tamano, espaciado };
      }
      tamano -= 0.5;
      espaciado = Math.max(0, espaciado - 0.35);
    }
  }

  doc.fontSize(TAMANO_TABLA);
  return { tamano: TAMANO_TABLA, espaciado: 0 };
}

function lineasComprobante(
  doc: PDFKit.PDFDocument,
  comprobante: ComprobanteRide,
  anchoArea: number,
  qr: QrMatrix | undefined,
  codigoBarras: boolean,
): LineaCaja[] {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;

  const { tamano: tamanoNombreDoc, espaciado: espaciadoNombreDoc } = ajustarNombreDocumento(
    doc,
    comprobante.nombreDocumento,
    anchoCaja,
  );

  const lineas: LineaCaja[] = [
    filaEtiquetaValor(anchoCaja, 'R.U.C.:', comprobante.ruc, 0.3, { tamano: TAMANO_TITULO }),
    {
      texto: comprobante.nombreDocumento,
      negrita: true,
      tamano: tamanoNombreDoc,
      espaciadoCaracteres: espaciadoNombreDoc,
    },
    filaEtiquetaValor(anchoCaja, 'No.', comprobante.numero, 0.15, { tamano: TAMANO_TITULO }),
    { texto: 'NÚMERO DE AUTORIZACIÓN', tamano: TAMANO_TABLA },
  ];

  if (comprobante.autorizacion) {
    lineas.push({ texto: comprobante.autorizacion.numero, negrita: true, tamano: TAMANO_TABLA, ajustar: true });
    lineas.push(
      filaEtiquetaValor(anchoCaja, 'FECHA Y HORA DE AUTORIZACIÓN:', comprobante.autorizacion.fecha, 0.5, {
        tamano: TAMANO_TABLA,
      }),
    );
  } else {
    lineas.push({ texto: 'COMPROBANTE NO AUTORIZADO', negrita: true, color: COLOR_NO_AUTORIZADO });
  }

  lineas.push(filaEtiquetaValor(anchoCaja, 'AMBIENTE:', etiquetaCatalogo(LABEL_AMBIENTE, comprobante.ambiente), 0.35));
  lineas.push(
    filaEtiquetaValor(anchoCaja, 'EMISIÓN:', etiquetaCatalogo(LABEL_TIPO_EMISION, comprobante.tipoEmision), 0.35),
  );
  lineas.push({ texto: 'CLAVE DE ACCESO', tamano: TAMANO_TITULO });

  if (codigoBarras) {
    lineas.push({
      texto: '',
      espaciador: ALTURA_CODIGO_BARRAS + ESPACIO_LINEA,
      dibujar: (x, y, ancho) =>
        dibujarCode128(doc, comprobante.claveAcceso, { x, y, ancho, alto: ALTURA_CODIGO_BARRAS }),
    });
  }

  lineas.push({ texto: comprobante.claveAcceso, tamano: TAMANO_TABLA, alineacion: 'center', ajustar: true });

  if (qr) {
    lineas.push({
      texto: '',
      espaciador: QR_LADO + ESPACIO_LINEA,
      dibujar: (x, y, ancho) =>
        dibujarQr(doc, qr, { x: x + (ancho - QR_LADO) / 2, y, size: QR_LADO }),
    });
  }

  return lineas;
}

export function medirComprobante(
  doc: PDFKit.PDFDocument,
  comprobante: ComprobanteRide,
  ancho: number,
  hayQr: boolean,
  codigoBarras = true,
): number {
  return medirCaja(doc, lineasComprobante(doc, comprobante, ancho, hayQr ? FALSO_QR : undefined, codigoBarras), ancho);
}

const FALSO_QR: QrMatrix = {
  size: QR_LADO,
  version: 1,
  maskPattern: 0,
  get: () => false,
};
