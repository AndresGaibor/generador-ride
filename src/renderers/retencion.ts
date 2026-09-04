import type { DocSustento, RetencionDocument } from '../types.js';
import type { RideOptions } from '../types.js';
import { formatMonto, fromCents, toCents } from '../money.js';
import { asegurarEspacio } from '../layout/pagination.js';
import { drawCabecera, medirCabecera } from '../layout/header.js';
import { drawComprador, medirComprador } from '../layout/subject.js';
import { drawPie, medirPie, drawBloqueTexto, medirBloqueTexto } from '../layout/footer.js';
import { drawTablaGenerica, construirColumnas } from '../layout/details.js';
import { formaPagoLabel, formatNumeroComprobante, nombreDocumento, nombreDocumentoPorCodigo } from '../layout/labels.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, CompradorRide, EmisorRide } from '../types.js';

const ESPACIADO_BLOQUE = 10;

const RETENCION_COLUMN_SPECS: Array<[string, number, 'left' | 'center' | 'right']> = [
  ['Comprobante', 0.115, 'left'],
  ['Número', 0.15, 'left'],
  ['Fecha Emisión', 0.115, 'center'],
  ['Ejercicio Fiscal', 0.11, 'center'],
  ['Base Imponible para la Retención', 0.16, 'right'],
  ['IMPUESTO', 0.12, 'center'],
  ['Porcentaje Retención', 0.11, 'right'],
  ['Valor Retenido', 0.12, 'right'],
];

const LABEL_IMPUESTO_RETENCION: Record<string, string> = {
  '1': 'RENTA',
  '2': 'IVA',
  '6': 'ISD',
};

function filasRetenciones(docsSustento: DocSustento[], periodoFiscal: string): string[][] {
  const filas: string[][] = [];
  for (const docSustento of docsSustento) {
    const identificacion = [
      nombreDocumentoPorCodigo(docSustento.codDocSustento).toUpperCase(),
      docSustento.numDocSustento,
      docSustento.fechaEmisionDocSustento,
      periodoFiscal,
    ];

    if (docSustento.retenciones.length === 0) {
      filas.push([...identificacion, '', '', '', '']);
      continue;
    }
    for (const retencion of docSustento.retenciones) {
      const impuesto = LABEL_IMPUESTO_RETENCION[retencion.codigo] ?? retencion.codigo;
      filas.push([
        ...identificacion,
        formatMonto(retencion.baseImponible, 2),
        `${impuesto} (${retencion.codigoRetencion})`,
        `${retencion.porcentajeRetener}%`,
        formatMonto(retencion.valorRetenido, 2),
      ]);
    }
  }
  return filas;
}

function totalRetenido(docsSustento: DocSustento[]): string {
  let cents = 0;
  for (const docSustento of docsSustento) {
    for (const retencion of docSustento.retenciones) {
      cents += toCents(retencion.valorRetenido);
    }
  }
  return fromCents(cents);
}

const TITULO_DOC_SUSTENTO_DETALLE = 'DETALLE DE DOCUMENTOS SUSTENTO';

function lineasDocumentosSustentoDetalle(documento: RetencionDocument): string[] {
  const lineas = [
    `Total Retenido: ${totalRetenido(documento.docsSustento)}`,
  ];
  if (documento.tipoSujetoRetenido) {
    lineas.push(`Tipo de Sujeto Retenido: ${documento.tipoSujetoRetenido}`);
  }
  if (documento.parteRel) {
    lineas.push(`Parte Relacionada: ${documento.parteRel}`);
  }

  for (const docSustento of documento.docsSustento) {
    lineas.push(
      `Documento Sustento: ${docSustento.codDocSustento} - ${docSustento.numDocSustento}` +
        ` (Código de Sustento: ${docSustento.codSustento})`,
    );
    lineas.push(`Total sin Impuestos: ${docSustento.totalSinImpuestos}`);
    lineas.push(`Importe Total: ${docSustento.importeTotal}`);

    for (const imp of docSustento.impuestosDocSustento) {
      let linea =
        `Impuesto: código ${imp.codImpuestoDocSustento}, % ${imp.codigoPorcentaje}, ` +
        `base imponible ${imp.baseImponible}, tarifa ${imp.tarifa}%, valor ${imp.valorImpuesto}`;
      if (imp.factorProporcionalidad) {
        linea += `, factor de proporcionalidad ${imp.factorProporcionalidad}`;
      }
      if (imp.baseImponibleModificada) {
        linea += `, base imponible modificada ${imp.baseImponibleModificada}`;
      }
      lineas.push(linea);
    }

    for (const pago of docSustento.pagos) {
      lineas.push(`Pago: ${formaPagoLabel(pago.formaPago)} - ${pago.total}`);
    }
  }
  return lineas;
}

export async function generarRideRetencion(opciones: RideOptions<RetencionDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;

  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;

  const emisor: EmisorRide = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe,
  };
  const comprobante: ComprobanteRide = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? '1',
    claveAcceso,
    autorizacion,
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const sujetoRetenido: CompradorRide = {
    razonSocial: documento.razonSocialSujetoRetenido,
    identificacion: documento.identificacionSujetoRetenido,
    tipoIdentificacion: documento.tipoIdentificacionSujetoRetenido,
    fechaEmision: documento.fechaEmision,
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, sujetoRetenido, anchoUtil));
  y = drawComprador(doc, sujetoRetenido, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const columnas = construirColumnas(anchoUtil, RETENCION_COLUMN_SPECS);
  const filas = filasRetenciones(documento.docsSustento, documento.periodoFiscal);
  y = drawTablaGenerica(doc, columnas, filas, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const lineasDetalleSustento = lineasDocumentosSustentoDetalle(documento);
  y = asegurarEspacio(doc, y, medirBloqueTexto(doc, TITULO_DOC_SUSTENTO_DETALLE, lineasDetalleSustento, anchoUtil));
  y =
    drawBloqueTexto(doc, TITULO_DOC_SUSTENTO_DETALLE, lineasDetalleSustento, { x: margenX, y, width: anchoUtil }) +
    ESPACIADO_BLOQUE;

  const pie = { infoAdicional: documento.infoAdicional };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });

  return finalizar();
}
