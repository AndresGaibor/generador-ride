import type { DestinatarioDetalle, GuiaRemisionDocument, RideOptions } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import {
  SRI_MARGEN,
  dibujarBandaSRI,
  dibujarCabeceraDocumentoSRI,
  dibujarPieSRI,
  dibujarTablaSRI,
  identificacionConTipoSRI,
} from '../layout/sri.js';

const ESPACIADO_BLOQUE = 10;

function celdasDestinatarioDetalle(detalle: DestinatarioDetalle): string[] {
  const extras = detalle.detallesAdicionales
    ? `\n${Object.entries(detalle.detallesAdicionales)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}`
    : '';
  return [detalle.cantidad, `${detalle.descripcion}${extras}`, detalle.codigoInterno ?? '', detalle.codigoAdicional ?? ''];
}

export async function generarRideGuiaRemisionSri(opciones: RideOptions<GuiaRemisionDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;

  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: 'GUÍA DE REMISIÓN',
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
  }) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialTransportista },
        derecha: {
          etiqueta: 'R.U.C.:',
          valor: identificacionConTipoSRI(documento.rucTransportista, documento.tipoIdentificacionTransportista),
        },
      },
      {
        izquierda: { etiqueta: 'Placa:', valor: documento.placa },
        derecha: { etiqueta: 'Punto de Partida:', valor: documento.dirPartida },
      },
      {
        izquierda: { etiqueta: 'Fecha inicio Transporte:', valor: documento.fechaIniTransporte },
        derecha: { etiqueta: 'Fecha fin Transporte:', valor: documento.fechaFinTransporte },
      },
    ],
    { titulo: 'TRANSPORTISTA' },
  ) + ESPACIADO_BLOQUE;

  for (const destinatario of documento.destinatarios) {
    y = dibujarBandaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        {
          izquierda: { etiqueta: 'Identificación:', valor: destinatario.identificacionDestinatario },
          derecha: { etiqueta: 'Motivo Traslado:', valor: destinatario.motivoTraslado },
        },
        { izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: destinatario.razonSocialDestinatario } },
        { izquierda: { etiqueta: 'Dirección:', valor: destinatario.dirDestinatario } },
      ],
      { titulo: 'DESTINATARIO' },
    ) + ESPACIADO_BLOQUE;

    y = dibujarTablaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        { titulo: 'Cantidad', peso: 0.12, align: 'right' },
        { titulo: 'Descripción', peso: 0.48, align: 'left' },
        { titulo: 'Código Principal', peso: 0.2, align: 'left' },
        { titulo: 'Código Auxiliar', peso: 0.2, align: 'left' },
      ],
      destinatario.detalles.map(celdasDestinatarioDetalle),
      { altoFila: 16 },
    ) + ESPACIADO_BLOQUE;
  }

  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    qr,
  });

  return finalizar();
}
