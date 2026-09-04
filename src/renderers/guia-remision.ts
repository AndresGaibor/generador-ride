import type { Destinatario, DestinatarioDetalle, GuiaRemisionDocument } from '../types.js';
import type { RideOptions } from '../types.js';
import { asegurarEspacio } from '../layout/pagination.js';
import { drawCabecera, medirCabecera } from '../layout/header.js';
import { drawBandaSujeto, medirBandaSujeto } from '../layout/subject.js';
import type { FilaBanda } from '../layout/subject.js';
import { drawPie, medirPie } from '../layout/footer.js';
import { drawTablaGenerica, construirColumnas, formatCantidadPrecision } from '../layout/details.js';
import { formatNumeroComprobante, identificacionConTipo, nombreDocumento, nombreDocumentoPorCodigo } from '../layout/labels.js';
import { crearDocumentoRide } from '../pdf/document.js';
import { crearQrMatrix } from '../qr/qr-vector.js';
import type { ComprobanteRide, EmisorRide } from '../types.js';

const ESPACIADO_BLOQUE = 10;

const FRACCIONES_DOS_PARES = [0.26, 0.32, 0.19, 0.23] as const;

const DESTINATARIO_DETALLE_COLUMN_SPECS: Array<[string, number, 'left' | 'center' | 'right']> = [
  ['Cantidad', 0.12, 'right'],
  ['Descripcion', 0.48, 'left'],
  ['Código Principal', 0.2, 'left'],
  ['Código Auxiliar', 0.2, 'left'],
];

function celdasDestinatarioDetalle(d: DestinatarioDetalle): string[] {
  const extras = d.detallesAdicionales
    ? `\n${Object.entries(d.detallesAdicionales)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}`
    : '';
  return [
    formatCantidadPrecision(d.cantidad),
    `${d.descripcion}${extras}`,
    d.codigoInterno ?? '',
    d.codigoAdicional ?? '',
  ];
}

function filasDestinatario(destinatario: Destinatario): FilaBanda[] {
  const filas: FilaBanda[] = [];

  if (destinatario.codDocSustento || destinatario.numDocSustento) {
    const tipo = destinatario.codDocSustento
      ? nombreDocumentoPorCodigo(destinatario.codDocSustento).toUpperCase()
      : '';
    const comprobante = [tipo, destinatario.numDocSustento ?? ''].filter((parte) => parte !== '').join('   ');
    filas.push(
      destinatario.fechaEmisionDocSustento
        ? {
            izquierda: { etiqueta: 'Comprobante de Venta:', valor: comprobante },
            derecha: { etiqueta: 'Fecha de Emisión:', valor: destinatario.fechaEmisionDocSustento },
            fracciones: FRACCIONES_DOS_PARES,
          }
        : { izquierda: { etiqueta: 'Comprobante de Venta:', valor: comprobante } },
    );
  }

  const pares: Array<[string, string | undefined]> = [
    ['Número de Autorización:', destinatario.numAutDocSustento],
    ['Motivo Traslado:', destinatario.motivoTraslado],
    ['Destino(Punto de llegada)', destinatario.dirDestinatario],
    ['Identificación (Destinatario)', destinatario.identificacionDestinatario],
    ['Razón Social/Nombres Apellidos', destinatario.razonSocialDestinatario],
    ['Documento Aduanero', destinatario.docAduaneroUnico],
    ['Código Establecimiento Destino', destinatario.codEstabDestino],
    ['Ruta:', destinatario.ruta],
  ];
  for (const [etiqueta, valor] of pares) {
    if (valor !== undefined && valor.trim() !== '') {
      filas.push({ izquierda: { etiqueta, valor } });
    }
  }
  return filas;
}

export async function generarRideGuiaRemision(opciones: RideOptions<GuiaRemisionDocument>): Promise<Uint8Array> {
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

  const filasTransportista: FilaBanda[] = [
    {
      izquierda: {
        etiqueta: 'Identificación (Transportista)',
        valor: identificacionConTipo(documento.rucTransportista, documento.tipoIdentificacionTransportista),
      },
    },
    { izquierda: { etiqueta: 'Razón Social / Nombres y Apellidos:', valor: documento.razonSocialTransportista } },
    { izquierda: { etiqueta: 'Placa:', valor: documento.placa } },
    { izquierda: { etiqueta: 'Punto de Partida:', valor: documento.dirPartida } },
    {
      izquierda: { etiqueta: 'Fecha inicio Transporte', valor: documento.fechaIniTransporte },
      derecha: { etiqueta: 'Fecha fin Transporte', valor: documento.fechaFinTransporte },
      fracciones: FRACCIONES_DOS_PARES,
    },
  ];
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasTransportista, anchoUtil));
  y = drawBandaSujeto(doc, filasTransportista, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

  const columnasDetalle = construirColumnas(anchoUtil, DESTINATARIO_DETALLE_COLUMN_SPECS);

  for (const destinatario of documento.destinatarios) {
    const filas = filasDestinatario(destinatario);
    y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filas, anchoUtil));
    y = drawBandaSujeto(doc, filas, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;

    const filasDetalle = destinatario.detalles.map(celdasDestinatarioDetalle);
    y = drawTablaGenerica(doc, columnasDetalle, filasDetalle, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;
  }

  const pie = { infoAdicional: documento.infoAdicional };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });

  return finalizar();
}
