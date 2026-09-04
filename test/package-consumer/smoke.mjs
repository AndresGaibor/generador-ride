import { strict as assert } from 'node:assert';
import { generarRide } from 'generador-ride';

const documento = {
  tipo: '01',
  infoTributaria: {
    ambiente: '1', razonSocial: 'EMPRESA CONSUMIDORA CIA. LTDA.', ruc: '1234567890001',
    estab: '001', ptoEmi: '001', secuencial: '000000001', dirMatriz: 'Quito',
  },
  fechaEmision: '01/01/2024', tipoIdentificacionComprador: '04',
  razonSocialComprador: 'CLIENTE TEST S.A.', identificacionComprador: '1234567890001',
  totalSinImpuestos: '100.00', totalDescuento: '0.00', importeTotal: '112.00',
  totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: '100.00', valor: '12.00' }],
  detalles: [{ descripcion: 'Producto publicado', cantidad: '1.000000', precioUnitario: '100.00',
    descuento: '0.00', precioTotalSinImpuesto: '100.00', impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }] }],
  pagos: [{ formaPago: '01', total: '112.00' }],
};

const bytes = await generarRide({
  documento,
  claveAcceso: '12345678901234567890123456789012345678901234567',
});
const text = new TextDecoder('latin1').decode(bytes);
assert(bytes.length > 0, 'el PDF publicado no debe estar vacío');
assert(text.startsWith('%PDF-'), 'el PDF publicado debe empezar con %PDF-');
assert(text.includes('%%EOF'), 'el PDF publicado debe contener %%EOF');
console.log(`Node ESM smoke OK (${bytes.length} bytes)`);
