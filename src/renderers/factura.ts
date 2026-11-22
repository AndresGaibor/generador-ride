import type { FacturaDocument } from '../types.js';
import type { RideOptions } from '../types.js';
import { asegurarEspacio } from '../layout/pagination.js';
import { drawCabecera, medirCabecera } from '../layout/header.js';
import { drawComprador, medirComprador } from '../layout/subject.js';
import { drawPie, medirPie } from '../layout/footer.js';
import { drawTablaDetalles } from '../layout/details.js';
import { formatNumeroComprobante, nombreDocumento } from '../layout/labels.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, CompradorRide, EmisorRide, TotalesRide } from '../types.js';

const ESPACIADO_BLOQUE = 10;

export async function generarRideFactura(opciones: RideOptions<FacturaDocument>): Promise<Uint8Array> {
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

  const comprador: CompradorRide = {
    razonSocial: documento.razonSocialComprador,
    identificacion: documento.identificacionComprador,
    tipoIdentificacion: documento.tipoIdentificacionComprador,
    fechaEmision: documento.fechaEmision,
    direccion: documento.direccionComprador,
    guiaRemision: documento.guiaRemision,
    placa: documento.placa,
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, comprador, anchoUtil, 'factura'));
  y = drawComprador(doc, comprador, { x: margenX, y, width: anchoUtil }, 'factura') + ESPACIADO_BLOQUE;

  y = drawTablaDetalles(doc, documento.detalles, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const totales: TotalesRide = {
    impuestos: documento.totalConImpuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    totalDescuento: documento.totalDescuento,
    propina: documento.propina,
    importeTotal: documento.importeTotal,
    moneda: documento.moneda,
    incluirDevolucionIva: true,
  };

  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });

  return finalizar();
}
