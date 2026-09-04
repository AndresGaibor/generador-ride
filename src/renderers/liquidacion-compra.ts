import type { LiquidacionCompraDocument } from '../types.js';
import type { RideOptions } from '../types.js';
import { asegurarEspacio } from '../layout/pagination.js';
import { drawCabecera, medirCabecera } from '../layout/header.js';
import { drawBandaSujeto, medirBandaSujeto } from '../layout/subject.js';
import type { FilaBanda } from '../layout/subject.js';
import { drawPie, medirPie } from '../layout/footer.js';
import { drawTablaDetalles, ETIQUETAS_DETALLE_COMPLETAS } from '../layout/details.js';
import { formatNumeroComprobante, identificacionConTipo, nombreDocumento } from '../layout/labels.js';
import type { EtiquetasTotales } from '../layout/totals.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, EmisorRide, TotalesRide } from '../types.js';

const ESPACIADO_BLOQUE = 10;

const OPCIONES_DETALLE = { detallesAdicionales: 1, etiquetas: ETIQUETAS_DETALLE_COMPLETAS };

const ETIQUETAS_TOTALES: Partial<EtiquetasTotales> = {
  subtotalCero: 'SUBTOTAL 0%',
  subtotalNoObjeto: 'SUBTOTAL NO OBJETO DE IVA',
  subtotalExento: 'SUBTOTAL EXENTO DE IVA',
  descuento: 'TOTAL DESCUENTO',
};

export async function generarRideLiquidacionCompra(opciones: RideOptions<LiquidacionCompraDocument>): Promise<Uint8Array> {
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

  const filasProveedor: FilaBanda[] = [
    { izquierda: { etiqueta: 'Nombres y Apellidos:', valor: documento.razonSocialProveedor } },
    {
      izquierda: {
        etiqueta: 'Identificación:',
        valor: identificacionConTipo(documento.identificacionProveedor, documento.tipoIdentificacionProveedor),
      },
    },
    { izquierda: { etiqueta: 'Fecha Emision:', valor: documento.fechaEmision } },
  ];
  if (documento.direccionProveedor !== undefined && documento.direccionProveedor.trim() !== '') {
    filasProveedor.push({ izquierda: { etiqueta: 'Dirección:', valor: documento.direccionProveedor } });
  }
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasProveedor, anchoUtil));
  y = drawBandaSujeto(doc, filasProveedor, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  y = drawTablaDetalles(doc, documento.detalles, { x: margenX, y, width: anchoUtil }, OPCIONES_DETALLE) +
    ESPACIADO_BLOQUE;

  const totales: TotalesRide = {
    impuestos: documento.totalConImpuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    totalDescuento: documento.totalDescuento,
    importeTotal: documento.importeTotal,
    moneda: documento.moneda,
    etiquetas: ETIQUETAS_TOTALES,
  };

  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });

  return finalizar();
}
