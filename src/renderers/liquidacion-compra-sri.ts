import type { LiquidacionCompraDocument, RideOptions } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
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

export async function generarRideLiquidacionCompraSri(
  opciones: RideOptions<LiquidacionCompraDocument>,
): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;

  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: 'LIQUIDACIÓN DE COMPRA',
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
        izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialProveedor },
        derecha: {
          etiqueta: 'Identificación:',
          valor: identificacionConTipoSRI(documento.identificacionProveedor, documento.tipoIdentificacionProveedor),
        },
      },
      {
        izquierda: { etiqueta: 'Dirección:', valor: documento.direccionProveedor ?? '' },
        derecha: { etiqueta: 'Fecha Emisión:', valor: documento.fechaEmision },
      },
    ],
    { titulo: 'PROVEEDOR' },
  ) + ESPACIADO_BLOQUE;

  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    columnasDetalle(true),
    documento.detalles.map((detalle) => celdasDetalle(detalle, true)),
    { limite: doc.page.height - SRI_MARGEN - 250 },
  ) + ESPACIADO_BLOQUE;

  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    pagos: documento.pagos,
    total: documento.importeTotal,
    filasTotales: calcularFilasTotalesSRI({
      impuestos: documento.totalConImpuestos,
      totalSinImpuestos: documento.totalSinImpuestos,
      totalDescuento: documento.totalDescuento,
      importeTotal: documento.importeTotal,
    }),
    qr,
  });

  return finalizar();
}
