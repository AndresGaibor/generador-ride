type RideErrorCode = 'RIDE_UNSUPPORTED_DOCUMENT' | 'RIDE_INVALID_INPUT' | 'RIDE_INVALID_LOGO' | 'RIDE_RENDER_FAILED';
declare class RideError extends Error {
    readonly code: RideErrorCode;
    readonly cause?: unknown;
    constructor(message: string, code: RideErrorCode, options?: {
        cause?: unknown;
    });
}

type TamanoPaginaRide = 'A4' | 'LETTER';
type Ambiente = '1' | '2';
type TipoEmision = '1';
type TipoComprobante = '01' | '03' | '04' | '05' | '06' | '07';
interface AutorizacionRide {
    numero: string;
    fecha: string;
}
interface OpcionesFormatoRide {
    tamano?: TamanoPaginaRide;
    codigoBarras?: boolean;
    incluirQr?: boolean;
}
interface RideOptions<T extends object = object> {
    documento: T;
    claveAcceso: string;
    autorizacion?: AutorizacionRide;
    logo?: Uint8Array;
    opciones?: OpcionesFormatoRide;
}
interface EmisorRide {
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
interface ComprobanteRide {
    ruc: string;
    nombreDocumento: string;
    numero: string;
    ambiente: Ambiente;
    tipoEmision: TipoEmision;
    claveAcceso: string;
    autorizacion?: AutorizacionRide;
}
interface CompradorRide {
    etiquetaSujeto?: string;
    razonSocial: string;
    identificacion: string;
    tipoIdentificacion?: string;
    fechaEmision: string;
    direccion?: string;
    guiaRemision?: string;
    placa?: string;
}
interface AreaRide {
    x: number;
    y: number;
    width: number;
}
interface EtiquetasTotales {
    subtotalCero: string;
    subtotalNoObjeto: string;
    subtotalExento: string;
    subtotalSinImpuestos: string;
    descuento: string;
    valorTotal: string;
}
interface TotalImpuesto {
    codigo: string;
    codigoPorcentaje: string;
    baseImponible: string;
    valor: string;
    descuentoAdicional?: string;
}
interface TotalesRide {
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
interface Pago {
    formaPago: string;
    total: string;
    plazo?: string;
    unidadTiempo?: string;
}
interface Detalle {
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
interface InfoTributaria {
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
interface FacturaDocument {
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
    placa?: string;
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
interface LiquidacionCompraDocument {
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
interface NotaCreditoDocument {
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
interface Motivo {
    razon: string;
    valor: string;
}
interface NotaDebitoDocument {
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
interface DestinatarioDetalle {
    codigoInterno?: string;
    codigoAdicional?: string;
    descripcion: string;
    cantidad: string;
    detallesAdicionales?: Record<string, string>;
}
interface Destinatario {
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
interface GuiaRemisionDocument {
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
interface RetencionRow {
    codigo: string;
    codigoRetencion: string;
    baseImponible: string;
    porcentajeRetener: string;
    valorRetenido: string;
    [extra: string]: string;
}
interface PagoSustentoRow {
    formaPago: string;
    total: string;
    [extra: string]: string;
}
interface ImpuestoDocSustentoRow {
    codImpuestoDocSustento: string;
    codigoPorcentaje: string;
    baseImponible: string;
    tarifa: string;
    factorProporcionalidad?: string;
    baseImponibleModificada?: string;
    valorImpuesto: string;
    [extra: string]: string | undefined;
}
interface DocSustento {
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
interface RetencionDocument {
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
type RideDocument = FacturaDocument | LiquidacionCompraDocument | NotaCreditoDocument | NotaDebitoDocument | GuiaRemisionDocument | RetencionDocument;

declare function generarRideFactura(opciones: RideOptions<FacturaDocument>): Promise<Uint8Array>;

declare function generarRideLiquidacionCompra(opciones: RideOptions<LiquidacionCompraDocument>): Promise<Uint8Array>;

declare function generarRideNotaCredito(opciones: RideOptions<NotaCreditoDocument>): Promise<Uint8Array>;

declare function generarRideNotaDebito(opciones: RideOptions<NotaDebitoDocument>): Promise<Uint8Array>;

declare function generarRideGuiaRemision(opciones: RideOptions<GuiaRemisionDocument>): Promise<Uint8Array>;

declare function generarRideRetencion(opciones: RideOptions<RetencionDocument>): Promise<Uint8Array>;

declare function generarRide<T extends RideDocument>(opciones: RideOptions<T>): Promise<Uint8Array>;

export { type Ambiente, type AreaRide, type AutorizacionRide, type CompradorRide, type ComprobanteRide, type Destinatario, type DestinatarioDetalle, type Detalle, type DocSustento, type EmisorRide, type EtiquetasTotales, type FacturaDocument, type GuiaRemisionDocument, type ImpuestoDocSustentoRow, type InfoTributaria, type LiquidacionCompraDocument, type Motivo, type NotaCreditoDocument, type NotaDebitoDocument, type OpcionesFormatoRide, type Pago, type PagoSustentoRow, type RetencionDocument, type RetencionRow, RideError, type RideErrorCode, type RideOptions, type TamanoPaginaRide, type TipoComprobante, type TipoEmision, type TotalImpuesto, type TotalesRide, generarRide, generarRideFactura, generarRideGuiaRemision, generarRideLiquidacionCompra, generarRideNotaCredito, generarRideNotaDebito, generarRideRetencion };
