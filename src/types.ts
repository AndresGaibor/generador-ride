export type TamanoPaginaRide = 'A4' | 'LETTER';

export type Ambiente = '1' | '2';

export type TipoEmision = '1';

export type TipoComprobante = '01' | '03' | '04' | '05' | '06' | '07';

export interface AutorizacionRide {
  numero: string;
  fecha: string;
}

export interface OpcionesFormatoRide {
  tamano?: TamanoPaginaRide;
  codigoBarras?: boolean;
  incluirQr?: boolean;
}

export interface RideOptions<T extends object = object> {
  documento: T;
  claveAcceso: string;
  autorizacion?: AutorizacionRide;
  logo?: Uint8Array;
  opciones?: OpcionesFormatoRide;
}

export interface EmisorRide {
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
}

export interface ComprobanteRide {
  ruc: string;
  nombreDocumento: string;
  numero: string;
  ambiente: Ambiente;
  tipoEmision: TipoEmision;
  claveAcceso: string;
  autorizacion?: AutorizacionRide;
}

export interface CompradorRide {
  etiquetaSujeto?: string;
  razonSocial: string;
  identificacion: string;
  tipoIdentificacion?: string;
  fechaEmision: string;
  direccion?: string;
  guiaRemision?: string;
}

export interface AreaRide {
  x: number;
  y: number;
  width: number;
}

export interface EtiquetasTotales {
  subtotalCero: string;
  subtotalNoObjeto: string;
  subtotalExento: string;
  subtotalSinImpuestos: string;
  descuento: string;
  valorTotal: string;
}

export interface TotalImpuesto {
  codigo: string;
  codigoPorcentaje: string;
  baseImponible: string;
  valor: string;
  descuentoAdicional?: string;
}

export interface TotalesRide {
  impuestos: TotalImpuesto[];
  totalSinImpuestos: string;
  totalDescuento?: string;
  propina?: string;
  importeTotal: string;
  etiquetas?: Partial<EtiquetasTotales>;
  conPropina?: boolean;
  conSubsidio?: boolean;
  moneda?: string;
}

export interface Pago {
  formaPago: string;
  total: string;
  plazo?: string;
  unidadTiempo?: string;
}

export interface Detalle {
  codigoPrincipal?: string;
  codigoAuxiliar?: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  precioTotalSinImpuesto: string;
  impuestos: TotalImpuesto[];
  detallesAdicionales?: Record<string, string>;
}

export interface InfoTributaria {
  ambiente: Ambiente;
  razonSocial: string;
  ruc: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
  tipoEmision?: TipoEmision;
  nombreComercial?: string;
  contribuyenteRimpe?: string;
  agenteRetencion?: string;
}

export interface Impuesto {
  codigo: string;
  codigoPorcentaje: string;
  tarifa: string;
  baseImponible: string;
  valor: string;
}

export interface FacturaDocument {
  tipo: '01';
  infoTributaria: InfoTributaria;
  fechaEmision: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  guiaRemision?: string;
  totalSinImpuestos: string;
  totalDescuento: string;
  propina?: string;
  importeTotal: string;
  moneda?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  totalConImpuestos: TotalImpuesto[];
  detalles: Detalle[];
  pagos: Pago[];
  infoAdicional?: Record<string, string>;
}

export interface LiquidacionCompraDocument {
  tipo: '03';
  infoTributaria: InfoTributaria;
  fechaEmision: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  tipoIdentificacionProveedor: string;
  razonSocialProveedor: string;
  identificacionProveedor: string;
  direccionProveedor?: string;
  totalSinImpuestos: string;
  totalDescuento: string;
  importeTotal: string;
  moneda?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  totalConImpuestos: TotalImpuesto[];
  detalles: Detalle[];
  pagos: Pago[];
  infoAdicional?: Record<string, string>;
}

export interface NotaCreditoDocument {
  tipo: '04';
  infoTributaria: InfoTributaria;
  fechaEmision: string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: string;
  valorModificacion: string;
  moneda?: string;
  totalConImpuestos: TotalImpuesto[];
  detalles: Detalle[];
  motivo: string;
  infoAdicional?: Record<string, string>;
}

export interface Motivo {
  razon: string;
  valor: string;
}

export interface NotaDebitoDocument {
  tipo: '05';
  infoTributaria: InfoTributaria;
  fechaEmision: string;
  dirEstablecimiento?: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  rise?: string;
  codDocModificado: string;
  numDocModificado: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: string;
  impuestos: TotalImpuesto[];
  valorTotal: string;
  pagos: Pago[];
  motivos: Motivo[];
  infoAdicional?: Record<string, string>;
}

export interface DestinatarioDetalle {
  codigoInterno?: string;
  codigoAdicional?: string;
  descripcion: string;
  cantidad: string;
  detallesAdicionales?: Record<string, string>;
}

export interface Destinatario {
  identificacionDestinatario: string;
  razonSocialDestinatario: string;
  dirDestinatario: string;
  motivoTraslado: string;
  detalles: DestinatarioDetalle[];
  docAduaneroUnico?: string;
  codEstabDestino?: string;
  ruta?: string;
  codDocSustento?: string;
  numDocSustento?: string;
  numAutDocSustento?: string;
  fechaEmisionDocSustento?: string;
}

export interface GuiaRemisionDocument {
  tipo: '06';
  infoTributaria: InfoTributaria;
  dirEstablecimiento: string;
  dirPartida: string;
  razonSocialTransportista: string;
  tipoIdentificacionTransportista: string;
  rucTransportista: string;
  fechaIniTransporte: string;
  fechaFinTransporte: string;
  placa: string;
  destinatarios: Destinatario[];
  rise?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  contribuyenteEspecial?: string;
  infoAdicional?: Record<string, string>;
}

export interface RetencionRow {
  codigo: string;
  codigoRetencion: string;
  baseImponible: string;
  porcentajeRetener: string;
  valorRetenido: string;
  [extra: string]: string;
}

export interface PagoSustentoRow {
  formaPago: string;
  total: string;
  [extra: string]: string;
}

export interface ImpuestoDocSustentoRow {
  codImpuestoDocSustento: string;
  codigoPorcentaje: string;
  baseImponible: string;
  tarifa: string;
  factorProporcionalidad?: string;
  baseImponibleModificada?: string;
  valorImpuesto: string;
  [extra: string]: string | undefined;
}

export interface DocSustento {
  codSustento: string;
  codDocSustento: string;
  numDocSustento: string;
  fechaEmisionDocSustento: string;
  totalSinImpuestos: string;
  importeTotal: string;
  impuestosDocSustento: ImpuestoDocSustentoRow[];
  retenciones: RetencionRow[];
  pagos: PagoSustentoRow[];
  fechaRegistroContable?: string;
  numAutDocSustento?: string;
  pagoLocExt?: string;
  tipoRegi?: string;
  paisEfecPago?: string;
  aplicConvDobTwordsri?: string;
  pagExtSujRetNorLeg?: string;
  pagoRegFis?: string;
  totalComprobantesReembolso?: string;
  totalBaseImponibleReembolso?: string;
  totalImpuestoReembolso?: string;
}

export interface RetencionDocument {
  tipo: '07';
  infoTributaria: InfoTributaria;
  fechaEmision: string;
  dirEstablecimiento: string;
  tipoIdentificacionSujetoRetenido: string;
  razonSocialSujetoRetenido: string;
  identificacionSujetoRetenido: string;
  periodoFiscal: string;
  docsSustento: DocSustento[];
  contribuyenteEspecial?: string;
  obligadoContabilidad?: 'SI' | 'NO';
  tipoSujetoRetenido?: string;
  parteRel?: string;
  infoAdicional?: Record<string, string>;
}

export type RideDocument =
  | FacturaDocument
  | LiquidacionCompraDocument
  | NotaCreditoDocument
  | NotaDebitoDocument
  | GuiaRemisionDocument
  | RetencionDocument;
