import type { FacturaDocument, RideOptions } from '../types.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import { formatMonto } from '../money.js';
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
import type { FilaBandaSRI } from '../layout/sri.js';

const ESPACIADO_BLOQUE = 10;

function filasComprador(documento: FacturaDocument): FilaBandaSRI[] {
  const identificacion = documento.tipoIdentificacionComprador
    ? identificacionConTipoSRI(documento.identificacionComprador, documento.tipoIdentificacionComprador)
    : documento.identificacionComprador;
  return [
    {
      izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialComprador },
      derecha: { etiqueta: 'Identificación:', valor: identificacion },
    },
    { izquierda: { etiqueta: 'Fecha', valor: documento.fechaEmision } },
    {
      izquierda: { etiqueta: 'Direccion:', valor: documento.direccionComprador ?? '' },
      derecha: { etiqueta: 'Placa / Matrícula:', valor: documento.placa ?? '' },
    },
    { derecha: { etiqueta: 'Guía', valor: documento.guiaRemision ?? '' } },
  ];
}

export async function generarRideFacturaSri(opciones: RideOptions<FacturaDocument>): Promise<Uint8Array> {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? 'A4';

  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : undefined;

  const anchoUtil = doc.page.width - SRI_MARGEN * 2;

  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: 'FACTURA',
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
  }) + ESPACIADO_BLOQUE;

  y = dibujarBandaSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, filasComprador(documento)) + 8;

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
    filasTotales: [
      ...calcularFilasTotalesSRI({
        impuestos: documento.totalConImpuestos,
        totalSinImpuestos: documento.totalSinImpuestos,
        totalDescuento: documento.totalDescuento,
        propina: documento.propina,
        importeTotal: documento.importeTotal,
      }),
      ['VALOR TOTAL SIN SUBSIDIO', formatMonto(documento.importeTotal, 2), 13, 6.5],
      ['AHORRO POR SUBSIDIO\n(Incluye IVA cuando corresponda)', '0.00', 22, 6.5],
    ],
    qr,
  });

  return finalizar();
}
