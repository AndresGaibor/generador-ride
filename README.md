# generador-ride

Genera PDFs RIDE para comprobantes electrónicos del SRI Ecuador.

## Cloudflare Worker

```ts
import { generarRide } from 'generador-ride';

const documento = {
  tipo: '01' as const,
  infoTributaria: {
    ambiente: '1' as const,
    razonSocial: 'EMPRESA EJEMPLO CIA. LTDA.',
    ruc: '1234567890001',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    dirMatriz: 'Quito',
  },
  fechaEmision: '01/01/2024',
  tipoIdentificacionComprador: '04',
  razonSocialComprador: 'CLIENTE EJEMPLO',
  identificacionComprador: '1234567890001',
  totalSinImpuestos: '100.00',
  totalDescuento: '0.00',
  importeTotal: '112.00',
  totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: '100.00', valor: '12.00' }],
  detalles: [{
    descripcion: 'Producto ejemplo',
    cantidad: '1.000000',
    precioUnitario: '100.00',
    descuento: '0.00',
    precioTotalSinImpuesto: '100.00',
    impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }],
  }],
  pagos: [{ formaPago: '01', total: '112.00' }],
};

export default {
  async fetch() {
    const pdf = await generarRide({
      documento,
      claveAcceso: '12345678901234567890123456789012345678901234567',
    });
    return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
  },
};
```

## Instalación

Para instalar y desarrollar con Bun se requiere `>=1.4.0`; los consumidores Node requieren `>=20.0.0`:

```sh
bun add generador-ride
```

El paquete es ESM y devuelve `Promise<Uint8Array>`. No requiere configuración de fuentes ni acceso al filesystem para renderizar.

## Node.js

```ts
import { writeFile } from 'node:fs/promises';
import { generarRide } from 'generador-ride';

// Usa un documento con la forma del ejemplo de Cloudflare Worker.
const documento = /* tu FacturaDocument */ {} as Parameters<typeof generarRide>[0]['documento'];
const pdf = await generarRide({ documento, claveAcceso: '12345678901234567890123456789012345678901234567' });
await writeFile('factura.pdf', pdf);
```

## Documentos y opciones

Los seis tipos soportados son `01` factura, `03` liquidación de compra, `04` nota de crédito, `05` nota de débito, `06` guía de remisión y `07` retención. Se seleccionan mediante `documento.tipo` y sus interfaces están exportadas desde el paquete.

`tamano` acepta `A4` o `LETTER`; el valor predeterminado es `A4`. `codigoBarras` está activado por defecto y utiliza Code 128. `incluirQr` está desactivado por defecto y se activa con `opciones: { incluirQr: true }`.

Para facturas, `opciones: { plantilla: 'sri' }` reproduce la maqueta del reporte oficial del SRI (Anexo 2): una sola columna de detalle adicional, filas fijas de ICE e IRBPNR, etiquetas `SUBTOTAL 0%` / `TOTAL DESCUENTO` y aviso `NO TIENE LOGO` cuando no se entrega logo. El valor predeterminado sigue siendo `estandar`.

El logo se entrega como bytes (`Uint8Array`) en `logo`, por ejemplo `logo: new Uint8Array(bytesDelPng)`. La autorización es opcional: si se omite no se dibuja el bloque de autorización; si se incluye, se renderizan `numero` y `fecha` mediante `autorizacion: { numero, fecha }`. La clave de acceso siempre se entrega en `claveAcceso`.

## Errores

Los fallos de renderización se exponen como `RideError`, con `code` estable: `RIDE_UNSUPPORTED_DOCUMENT`, `RIDE_INVALID_INPUT`, `RIDE_INVALID_LOGO` o `RIDE_RENDER_FAILED`. `cause` se conserva cuando existe una causa subyacente.

## Alcance

Este paquete hace rendering únicamente. No valida decisiones de negocio, no genera ni firma XML y no contacta al SRI. La validación, autorización, firma y envío del comprobante pertenecen a la aplicación consumidora.

## Referencias externas

Implementaciones ecuatorianas que se usan solo para contrastar el RIDE y la emisión, con commits revisados y checklist periódica: [`docs/referencias-externas.md`](docs/referencias-externas.md).

## Verificación

```sh
bun run verify
```

El comando ejecuta typecheck, pruebas unitarias, runtime Worker, paridad visual, build, smoke del paquete limpio y verificación del bundle, en ese orden.
