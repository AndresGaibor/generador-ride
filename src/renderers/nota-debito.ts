import type { NotaDebitoDocument } from '../types.js';
import type { RideOptions } from '../types.js';
import { formatMonto } from '../money.js';
import { asegurarEspacio } from '../layout/pagination.js';
import { drawCabecera, medirCabecera } from '../layout/header.js';
import { drawComprador, medirComprador, drawBandaSujeto, medirBandaSujeto } from '../layout/subject.js';
import type { FilaBanda } from '../layout/subject.js';
import { drawPie, medirPie } from '../layout/footer.js';
import { drawTablaGenerica, construirColumnas } from '../layout/details.js';
import { formatNumeroComprobante, nombreDocumento, nombreDocumentoPorCodigo } from '../layout/labels.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, CompradorRide, EmisorRide, TotalesRide } from '../types.js';

const ESPACIADO_BLOQUE = 10;

const MOTIVO_COLUMN_SPECS: Array<[string, number, 'left' | 'right']> = [
  ['RAZÓN DE LA MODIFICACIÓN', 0.55, 'left'],
  ['VALOR DE LA MODIFICACIÓN', 0.45, 'right'],
];

export async function generarRideNotaDebito(opciones: RideOptions<NotaDebitoDocument>): Promise<Uint8Array> {
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
    rise: documento.rise,
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
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, comprador, anchoUtil, 'identificacion-propia'));
  y = drawComprador(doc, comprador, { x: margenX, y, width: anchoUtil }, 'identificacion-propia') + ESPACIADO_BLOQUE;

  const filasModifica: FilaBanda[] = [
    {
      izquierda: {
        etiqueta: 'Comprobante que se modifica',
        valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase(),
      },
      derecha: { etiqueta: '', valor: documento.numDocModificado },
    },
    {
      izquierda: {
        etiqueta: 'Fecha Emisión (Comprobante a modificar)',
        valor: documento.fechaEmisionDocSustento,
      },
    },
  ];
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasModifica, anchoUtil));
  y = drawBandaSujeto(doc, filasModifica, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const columnasMotivos = construirColumnas(anchoUtil, MOTIVO_COLUMN_SPECS);
  const filasMotivos = documento.motivos.map((motivo) => [motivo.razon, formatMonto(motivo.valor, 2)]);
  y = drawTablaGenerica(doc, columnasMotivos, filasMotivos, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const totales: TotalesRide = {
    impuestos: documento.impuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    importeTotal: documento.valorTotal,
  };

  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });

  return finalizar();
}
