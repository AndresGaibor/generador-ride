import { fromCents, toCents } from './money.js';
import type { Detalle } from './types.js';

const CODIGO_IMPUESTO_IVA = '2';

export interface SubsidioRide {
  /** `VALOR TOTAL SIN SUBSIDIO` del Anexo 7: total de la factura más el ahorro. */
  valorTotalSinSubsidio: string;
  /** `AHORRO POR SUBSIDIO`: subsidio de cada línea más su IVA. */
  ahorroSubsidio: string;
}

/**
 * Cálculo del Anexo 7 (factura con subsidio). El subsidio de una línea es
 * `precioSinSubsidio - precioUnitario` por la cantidad; el ahorro le suma el
 * IVA de esa misma línea. Devuelve `undefined` cuando ninguna línea trae
 * `precioSinSubsidio`, porque entonces la factura no es con subsidio.
 */
export function calcularSubsidio(detalles: Detalle[], importeTotal: string): SubsidioRide | undefined {
  let ahorroCents = 0;
  let haySubsidio = false;

  for (const detalle of detalles) {
    if (detalle.precioSinSubsidio === undefined) continue;
    haySubsidio = true;

    const subsidioUnidad = toCents(detalle.precioSinSubsidio) - toCents(detalle.precioUnitario);
    if (subsidioUnidad <= 0) continue;

    const cantidad = Number(detalle.cantidad);
    const impuestoIva = detalle.impuestos.find((impuesto) => impuesto.codigo === CODIGO_IMPUESTO_IVA);
    // El tipo no guarda la tarifa: se deriva del propio impuesto de la línea.
    const base = impuestoIva ? toCents(impuestoIva.baseImponible) : 0;
    const tasa = impuestoIva && base > 0 ? toCents(impuestoIva.valor) / base : 0;
    const factor = (Number.isFinite(cantidad) ? cantidad : 1) * (1 + tasa);

    ahorroCents += Math.round(subsidioUnidad * factor);
  }

  if (!haySubsidio) return undefined;

  return {
    ahorroSubsidio: fromCents(ahorroCents),
    valorTotalSinSubsidio: fromCents(toCents(importeTotal) + ahorroCents),
  };
}
