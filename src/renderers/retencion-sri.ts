import type { DocSustento, RetencionDocument, RideOptions } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import { formatMonto, fromCents, toCents } from '../money.js';
import { nombreDocumentoPorCodigo } from '../layout/labels.js';
import {
  SRI_MARGEN,
  dibujarBandaSRI,
  dibujarCabeceraDocumentoSRI,
  dibujarPieSRI,
  dibujarTablaSRI,
  identificacionConTipoSRI,
} from '../layout/sri.js';

const ESPACIADO_BLOQUE = 10;

const LABEL_IMPUESTO_RETENCION: Record<string, string> = {
  '1': 'RENTA',
  '2': 'IVA',
  '6': 'ISD',
};

function totalRetenido(docsSustento: DocSustento[]): string {
  let cents = 0;
  for (const docSustento of docsSustento) {
    for (const retencion of docSustento.retenciones) {
      cents += toCents(retencion.valorRetenido);
    }
  }
  return fromCents(cents);
}

export async function generarRideRetencionSri(opciones: RideOptions<RetencionDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;

  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: 'COMPROBANTE DE RETENCIÓN',
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
    lineasExtra: documento.infoTributaria.agenteRetencion
      ? [['Agente de Retención:', documento.infoTributaria.agenteRetencion]]
      : undefined,
  }) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialSujetoRetenido },
        derecha: {
          etiqueta: 'Identificación:',
          valor: identificacionConTipoSRI(
            documento.identificacionSujetoRetenido,
            documento.tipoIdentificacionSujetoRetenido,
          ),
        },
      },
    ],
    { titulo: 'SUJETO RETENIDO' },
  ) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [{ izquierda: { etiqueta: 'Período Fiscal:', valor: documento.periodoFiscal } }],
    { titulo: 'PERÍODO FISCAL' },
  ) + ESPACIADO_BLOQUE;

  for (const docSustento of documento.docsSustento) {
    y = dibujarBandaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        {
          izquierda: {
            etiqueta: 'Comprobante:',
            valor: nombreDocumentoPorCodigo(docSustento.codDocSustento).toUpperCase(),
          },
          derecha: { etiqueta: 'Número:', valor: docSustento.numDocSustento },
        },
        {
          izquierda: { etiqueta: 'Fecha Emisión:', valor: docSustento.fechaEmisionDocSustento },
          derecha: { etiqueta: 'Número de Autorización:', valor: docSustento.numAutDocSustento ?? '' },
        },
      ],
      { titulo: 'DOCUMENTO SUSTENTO' },
    ) + ESPACIADO_BLOQUE;

    y = dibujarTablaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        { titulo: 'IMPUESTO', peso: 0.2, align: 'left' },
        { titulo: 'CÓDIGO', peso: 0.15, align: 'left' },
        { titulo: 'BASE IMPONIBLE', peso: 0.25, align: 'right' },
        { titulo: '%', peso: 0.12, align: 'right' },
        { titulo: 'VALOR RETENIDO', peso: 0.28, align: 'right' },
      ],
      docSustento.retenciones.map((retencion) => [
        LABEL_IMPUESTO_RETENCION[retencion.codigo] ?? retencion.codigo,
        retencion.codigoRetencion,
        formatMonto(retencion.baseImponible, 2),
        `${retencion.porcentajeRetener}%`,
        formatMonto(retencion.valorRetenido, 2),
      ]),
      { titulo: 'RETENCIONES', altoFila: 16 },
    ) + ESPACIADO_BLOQUE;
  }

  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    filasTotales: [['TOTAL RETENIDO', formatMonto(totalRetenido(documento.docsSustento), 2)]],
    qr,
  });

  return finalizar();
}
