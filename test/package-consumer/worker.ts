import { generarRide } from 'generador-ride';

const documento = {
  tipo: '01' as const,
  infoTributaria: {
    ambiente: '1' as const, razonSocial: 'EMPRESA WORKER CIA. LTDA.', ruc: '1234567890001',
    estab: '001', ptoEmi: '001', secuencial: '000000001', dirMatriz: 'Quito',
  },
  fechaEmision: '01/01/2024', tipoIdentificacionComprador: '04',
  razonSocialComprador: 'CLIENTE WORKER S.A.', identificacionComprador: '1234567890001',
  totalSinImpuestos: '100.00', totalDescuento: '0.00', importeTotal: '112.00',
  totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: '100.00', valor: '12.00' }],
  detalles: [{ descripcion: 'Producto Worker', cantidad: '1.000000', precioUnitario: '100.00',
    descuento: '0.00', precioTotalSinImpuesto: '100.00', impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }] }],
  pagos: [{ formaPago: '01', total: '112.00' }],
};

export default {
  async fetch() {
    const bytes = await generarRide({ documento, claveAcceso: '12345678901234567890123456789012345678901234567' });
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
  },
};
