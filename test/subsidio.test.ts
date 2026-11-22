import { describe, expect, it } from 'vitest';
import { calcularSubsidio } from '../src/subsidio.js';
import type { Detalle } from '../src/types.js';

function detalle(cambios: Partial<Detalle> = {}): Detalle {
  return {
    descripcion: 'Diesel',
    cantidad: '1.00',
    precioUnitario: '25.00',
    descuento: '0.00',
    precioTotalSinImpuesto: '25.00',
    impuestos: [{ codigo: '2', codigoPorcentaje: '4', baseImponible: '25.00', valor: '3.75' }],
    ...cambios,
  };
}

describe('subsidio del Anexo 7', () => {
  it('sin precioSinSubsidio no hay bloque de subsidio', () => {
    expect(calcularSubsidio([detalle()], '28.75')).toBeUndefined();
  });

  it('suma el subsidio de la línea y su IVA', () => {
    const resultado = calcularSubsidio([detalle({ precioSinSubsidio: '35.00' })], '28.75');
    expect(resultado).toEqual({ ahorroSubsidio: '11.50', valorTotalSinSubsidio: '40.25' });
  });

  it('multiplica por la cantidad y respeta líneas sin IVA', () => {
    const resultado = calcularSubsidio(
      [
        detalle({
          cantidad: '2.00',
          precioUnitario: '10.00',
          precioSinSubsidio: '12.50',
          precioTotalSinImpuesto: '20.00',
          impuestos: [{ codigo: '2', codigoPorcentaje: '0', baseImponible: '20.00', valor: '0.00' }],
        }),
      ],
      '20.00',
    );
    expect(resultado).toEqual({ ahorroSubsidio: '5.00', valorTotalSinSubsidio: '25.00' });
  });
});
