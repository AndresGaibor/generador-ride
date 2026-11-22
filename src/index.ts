import { RideError } from './errors.js';
import type {
  RideOptions,
  RideDocument,
  FacturaDocument,
  LiquidacionCompraDocument,
  NotaCreditoDocument,
  NotaDebitoDocument,
  GuiaRemisionDocument,
  RetencionDocument,
} from './types.js';
import { generarRideFactura } from './renderers/factura.js';
import { generarRideFacturaSri } from './renderers/factura-sri.js';
import { generarRideLiquidacionCompra } from './renderers/liquidacion-compra.js';
import { generarRideNotaCredito } from './renderers/nota-credito.js';
import { generarRideNotaDebito } from './renderers/nota-debito.js';
import { generarRideGuiaRemision } from './renderers/guia-remision.js';
import { generarRideRetencion } from './renderers/retencion.js';

export { RideError };
export type { RideErrorCode } from './errors.js';

export type {
  RideOptions,
  TamanoPaginaRide,
  AutorizacionRide,
  OpcionesFormatoRide,
  PlantillaRide,
  EmisorRide,
  ComprobanteRide,
  CompradorRide,
  AreaRide,
  EtiquetasTotales,
  TotalImpuesto,
  TotalesRide,
  Ambiente,
  TipoEmision,
  TipoComprobante,
  FacturaDocument,
  LiquidacionCompraDocument,
  NotaCreditoDocument,
  NotaDebitoDocument,
  GuiaRemisionDocument,
  RetencionDocument,
  Detalle,
  Pago,
  InfoTributaria,
  Motivo,
  DestinatarioDetalle,
  Destinatario,
  RetencionRow,
  PagoSustentoRow,
  ImpuestoDocSustentoRow,
  DocSustento,
} from './types.js';

export { generarRideFactura };
export { generarRideFacturaSri };
export { generarRideLiquidacionCompra };
export { generarRideNotaCredito };
export { generarRideNotaDebito };
export { generarRideGuiaRemision };
export { generarRideRetencion };

export async function generarRide<T extends RideDocument>(opciones: RideOptions<T>): Promise<Uint8Array> {
  try {
    switch (opciones.documento.tipo) {
      case '01':
        return opciones.opciones?.plantilla === 'sri'
          ? await generarRideFacturaSri(opciones as RideOptions<FacturaDocument>)
          : await generarRideFactura(opciones as RideOptions<FacturaDocument>);
      case '03':
        return await generarRideLiquidacionCompra(opciones as RideOptions<LiquidacionCompraDocument>);
      case '04':
        return await generarRideNotaCredito(opciones as RideOptions<NotaCreditoDocument>);
      case '05':
        return await generarRideNotaDebito(opciones as RideOptions<NotaDebitoDocument>);
      case '06':
        return await generarRideGuiaRemision(opciones as RideOptions<GuiaRemisionDocument>);
      case '07':
        return await generarRideRetencion(opciones as RideOptions<RetencionDocument>);
      default:
        throw new RideError('Tipo de comprobante no soportado por el RIDE.', 'RIDE_UNSUPPORTED_DOCUMENT');
    }
  } catch (error) {
    if (error instanceof RideError) {
      throw error;
    }
    throw new RideError('No se pudo renderizar el RIDE.', 'RIDE_RENDER_FAILED', { cause: error });
  }
}
