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
import { generarRideLiquidacionCompraSri } from './renderers/liquidacion-compra-sri.js';
import { generarRideNotaCredito } from './renderers/nota-credito.js';
import { generarRideNotaCreditoSri } from './renderers/nota-credito-sri.js';
import { generarRideNotaDebito } from './renderers/nota-debito.js';
import { generarRideNotaDebitoSri } from './renderers/nota-debito-sri.js';
import { generarRideGuiaRemision } from './renderers/guia-remision.js';
import { generarRideGuiaRemisionSri } from './renderers/guia-remision-sri.js';
import { generarRideRetencion } from './renderers/retencion.js';
import { generarRideRetencionSri } from './renderers/retencion-sri.js';

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
export { generarRideLiquidacionCompraSri };
export { generarRideNotaCredito };
export { generarRideNotaCreditoSri };
export { generarRideNotaDebito };
export { generarRideNotaDebitoSri };
export { generarRideGuiaRemision };
export { generarRideGuiaRemisionSri };
export { generarRideRetencion };
export { generarRideRetencionSri };

export async function generarRide<T extends RideDocument>(opciones: RideOptions<T>): Promise<Uint8Array> {
  try {
    const plantillaSri = opciones.opciones?.plantilla === 'sri';
    switch (opciones.documento.tipo) {
      case '01':
        return plantillaSri
          ? await generarRideFacturaSri(opciones as RideOptions<FacturaDocument>)
          : await generarRideFactura(opciones as RideOptions<FacturaDocument>);
      case '03':
        return plantillaSri
          ? await generarRideLiquidacionCompraSri(opciones as RideOptions<LiquidacionCompraDocument>)
          : await generarRideLiquidacionCompra(opciones as RideOptions<LiquidacionCompraDocument>);
      case '04':
        return plantillaSri
          ? await generarRideNotaCreditoSri(opciones as RideOptions<NotaCreditoDocument>)
          : await generarRideNotaCredito(opciones as RideOptions<NotaCreditoDocument>);
      case '05':
        return plantillaSri
          ? await generarRideNotaDebitoSri(opciones as RideOptions<NotaDebitoDocument>)
          : await generarRideNotaDebito(opciones as RideOptions<NotaDebitoDocument>);
      case '06':
        return plantillaSri
          ? await generarRideGuiaRemisionSri(opciones as RideOptions<GuiaRemisionDocument>)
          : await generarRideGuiaRemision(opciones as RideOptions<GuiaRemisionDocument>);
      case '07':
        return plantillaSri
          ? await generarRideRetencionSri(opciones as RideOptions<RetencionDocument>)
          : await generarRideRetencion(opciones as RideOptions<RetencionDocument>);
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
