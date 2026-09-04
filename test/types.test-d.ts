import type {
  AutorizacionRide,
  ComprobanteRide,
  CompradorRide,
  EmisorRide,
  EtiquetasTotales,
  OpcionesFormatoRide,
  RideError,
  RideOptions,
  TamanoPaginaRide,
  TotalesRide,
  TotalImpuesto,
  Ambiente,
  TipoEmision,
  TipoComprobante,
  FacturaDocument,
  LiquidacionCompraDocument,
  NotaCreditoDocument,
  NotaDebitoDocument,
  GuiaRemisionDocument,
  RetencionDocument,
} from '../src/index.ts';

declare const _rideError: RideError;
declare const _autorizacion: AutorizacionRide;
declare const _comprobante: ComprobanteRide;
declare const _comprador: CompradorRide;
declare const _emisor: EmisorRide;
declare const _etiquetas: EtiquetasTotales;
declare const _opciones: OpcionesFormatoRide;
declare const _rideOptions: RideOptions;
declare const _totales: TotalesRide;
declare const _totalImpuesto: TotalImpuesto;

declare const _tamano: TamanoPaginaRide;
declare const _ambiente: Ambiente;
declare const _tipoEmision: TipoEmision;
declare const _tipoComprobante: TipoComprobante;

_tamano satisfies 'A4' | 'LETTER';
_ambiente satisfies '1' | '2';
_tipoEmision satisfies '1';
_tipoComprobante satisfies '01' | '03' | '04' | '05' | '06' | '07';

_autorizacion satisfies { numero: string; fecha: string };
_comprobante satisfies {
  ruc: string;
  nombreDocumento: string;
  numero: string;
  ambiente: Ambiente;
  tipoEmision: TipoEmision;
  claveAcceso: string;
  autorizacion?: AutorizacionRide;
};
_comprador satisfies {
  etiquetaSujeto?: string;
  razonSocial: string;
  identificacion: string;
  tipoIdentificacion?: string;
  fechaEmision: string;
  direccion?: string;
  guiaRemision?: string;
};
_emisor satisfies {
  logo?: Uint8Array;
  razonSocial: string;
  nombreComercial?: string;
  dirMatriz: string;
  dirEstablecimiento?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  contribuyenteEspecial?: string;
  agenteRetencion?: string;
  contribuyenteRimpe?: string;
  rise?: string;
};
_etiquetas satisfies {
  subtotalCero: string;
  subtotalNoObjeto: string;
  subtotalExento: string;
  subtotalSinImpuestos: string;
  descuento: string;
  valorTotal: string;
};
_opciones satisfies {
  tamano?: TamanoPaginaRide;
  codigoBarras?: boolean;
  incluirQr?: boolean;
};
_totales satisfies {
  impuestos: TotalImpuesto[];
  totalSinImpuestos: string;
  totalDescuento?: string;
  propina?: string;
  importeTotal: string;
  etiquetas?: Partial<EtiquetasTotales>;
  conPropina?: boolean;
  conSubsidio?: boolean;
  moneda?: string;
};

declare const _factura: FacturaDocument;
declare const _liquidacion: LiquidacionCompraDocument;
declare const _notaCredito: NotaCreditoDocument;
declare const _notaDebito: NotaDebitoDocument;
declare const _guiaRemision: GuiaRemisionDocument;
declare const _retencion: RetencionDocument;

const _optsFactura: RideOptions<FacturaDocument> = { documento: _factura, claveAcceso: '12345678901234567890123456789012345678901234567' };
const _optsLiquidacion: RideOptions<LiquidacionCompraDocument> = { documento: _liquidacion, claveAcceso: '12345678901234567890123456789012345678901234567' };
const _optsNotaCredito: RideOptions<NotaCreditoDocument> = { documento: _notaCredito, claveAcceso: '12345678901234567890123456789012345678901234567' };
const _optsNotaDebito: RideOptions<NotaDebitoDocument> = { documento: _notaDebito, claveAcceso: '12345678901234567890123456789012345678901234567' };
const _optsGuiaRemision: RideOptions<GuiaRemisionDocument> = { documento: _guiaRemision, claveAcceso: '12345678901234567890123456789012345678901234567' };
const _optsRetencion: RideOptions<RetencionDocument> = { documento: _retencion, claveAcceso: '12345678901234567890123456789012345678901234567' };

_optsFactura satisfies { documento: FacturaDocument; claveAcceso: string };
_optsLiquidacion satisfies { documento: LiquidacionCompraDocument; claveAcceso: string };
_optsNotaCredito satisfies { documento: NotaCreditoDocument; claveAcceso: string };
_optsNotaDebito satisfies { documento: NotaDebitoDocument; claveAcceso: string };
_optsGuiaRemision satisfies { documento: GuiaRemisionDocument; claveAcceso: string };
_optsRetencion satisfies { documento: RetencionDocument; claveAcceso: string };
