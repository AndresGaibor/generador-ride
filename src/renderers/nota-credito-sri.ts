import type { NotaCreditoDocument, RideOptions } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import { nombreDocumentoPorCodigo } from '../layout/labels.js';
import {
  SRI_MARGEN,
  calcularFilasTotalesSRI,
  celdasDetalle,
  columnasDetalle,
  dibujarBandaSRI,
  dibujarCabeceraDocumentoSRI,
  dibujarPieSRI,
  dibujarTablaSRI,
  identificacionConTipoSRI,
} from '../layout/sri.js';

const ESPACIADO_BLOQUE = 10;

export async function generarRideNotaCreditoSri(opciones: RideOptions<NotaCreditoDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;

  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: 'NOTA DE CRÉDITO',
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
    lineasExtra: documento.rise ? [['RISE:', documento.rise]] : undefined,
  }) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialComprador },
        derecha: {
          etiqueta: 'Identificación:',
          valor: identificacionConTipoSRI(documento.identificacionComprador, documento.tipoIdentificacionComprador),
        },
      },
      { izquierda: { etiqueta: 'Fecha Emisión:', valor: documento.fechaEmision } },
    ],
    { titulo: 'COMPRADOR' },
  ) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: {
          etiqueta: 'Comprobante que se modifica:',
          valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase(),
        },
        derecha: { etiqueta: 'Número:', valor: documento.numDocModificado },
      },
      { izquierda: { etiqueta: 'Fecha Emisión:', valor: documento.fechaEmisionDocSustento } },
    ],
    { titulo: 'DOCUMENTO MODIFICADO' },
  ) + ESPACIADO_BLOQUE;

  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    columnasDetalle(false),
    documento.detalles.map((detalle) => celdasDetalle(detalle, false)),
    { limite: doc.page.height - SRI_MARGEN - 250 },
  ) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [{ izquierda: { etiqueta: 'Razón de Modificación:', valor: documento.motivo } }],
    { titulo: 'MOTIVO' },
  ) + ESPACIADO_BLOQUE;

  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    filasTotales: calcularFilasTotalesSRI({
      impuestos: documento.totalConImpuestos,
      totalSinImpuestos: documento.totalSinImpuestos,
      importeTotal: documento.valorModificacion,
      opciones: { conDescuento: false, conPropina: false },
    }),
    qr,
  });

  return finalizar();
}
