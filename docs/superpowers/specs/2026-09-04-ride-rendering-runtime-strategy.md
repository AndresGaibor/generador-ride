# RIDE Rendering Runtime Strategy

> **Cross-repo copy:** Canonical orchestration spec also lives at `~/code/javascript/facturador/docs/superpowers/specs/2026-09-04-ride-rendering-runtime-strategy.md`.

## Objetivo

Definir la arquitectura de producción para generar el RIDE fiscal que `facturador` persiste en R2 y adjunta por correo junto con el XML autorizado, manteniendo la salida visual de `~/code/javascript/generador-ride` indistinguible de la referencia `teran-sri-ec-node` v0.3.0.

La prioridad es, en este orden:

1. Paridad visual y semántica del RIDE.
2. No comprometer la operación en Cloudflare Workers Free.
3. Aislar la CPU de generación del resto del flujo fiscal.
4. Mantener `facturador` simple, resiliente e idempotente.
5. Optimizar CPU y tamaño solo cuando no cambie el PDF.

## Evidencia medida el 2026-09-04

`generador-ride` commit `dc366ad`:

- 187/187 tests funcionales PASS.
- 21/21 tests en runtime Workers PASS.
- 12/12 comparaciones visuales PASS.
- Paridad geométrica: tolerancia máxima 0.5 pt.
- Paridad raster: 144 DPI, diferencia máxima aceptada 0.1%.
- Bundle Worker: 2.66 MiB raw / 514.13 KiB gzip.
- Factura simple estabilizada en runtime Worker local: ~18-23 ms wall-clock.
- Factura con QR: ~53 ms wall-clock.
- Primer request observado: ~120 ms wall-clock.
- Factura 100 líneas en Bun caliente: ~101-161 ms wall-clock.
`facturador` actual:

- Bundle Worker sin `generador-ride`: 2.02 MiB raw / 419.81 KiB gzip.
- Bundle experimental con `generador-ride`: 4.68 MiB raw / 933.14 KiB gzip.
- Sigue por debajo del límite Free de 3 MiB gzip, por lo que tamaño no bloquea la integración.

Spikes de backend PDF:

- `pdfkit.standalone.js`: ~567 KiB gzip por sí solo; funciona en Workers y conserva paridad.
- `pdfkit.es.js`: ~49 KiB gzip, pero falló 21/21 tests Worker por `Helvetica.afm` ausente en VFS. No es sustituto directo.
- `pdf-lib` mínimo: ~216.24 KiB gzip; microbenchmark 1/40/100 líneas ~2.1/3.8/14.1 ms. Aún no demuestra paridad visual completa.
- Writer PDF manual de `facturador`: ~0.24/1.08/2.46 ms para 1/40/100 líneas, pero no reproduce el layout visual nuevo.

## Hallazgo decisivo sobre CPU de Cloudflare Free

El límite general documentado para solicitudes HTTP normales del plan Free es 10 ms de CPU.

La documentación específica de Cloudflare Queues indica para consumer Workers, y declara que sus límites aplican a Free y Paid salvo la retención:

- 30 s de CPU por invocación por defecto.
- CPU configurable hasta 300,000 ms (5 min).
- 15 min de wall-clock por invocación.
- La espera de `fetch`, R2, DB u otra I/O no consume CPU.

Sin embargo, la página general de pricing de Workers mantiene una fila Free de 10 ms por invocación que no desambigua con la misma claridad el caso Queue. Por ello esta arquitectura no se aprueba solo por documentación: el primer gate obligatorio es un probe en la cuenta Free real que ejecute 25/100/500 ms de CPU dentro de un Queue Consumer y registre `cpuTime`/`exceededCpu`.

Solo si ese probe demuestra margen real se considera embedded el camino principal. Si el Queue Consumer real queda limitado cerca de 10 ms o la evidencia es ambigua, el plan pasa a backend ultraligero y, si este tampoco cumple con paridad visual, a servidor privado por Tunnel con Cloud Run como fallback.
## Fallos de integración encontrados

### 1. El camino de autorización no inyecta el renderer

`consultar-autorizacion.ts` llama `generarRideAutorizado()` sin `renderer`.

Aunque `crearDependenciasWorkers()` construye `rideRenderer: new RidePdfRenderer()`, `DependenciasConsultarAutorizacion` no contiene ese puerto. Por ello el camino feliz usa el fallback `generarRidePdf()` manual y no el renderer que se pretende integrar.

### 2. El reintento `GENERAR_RIDE` puede descartarse

`consumirMensajeCola()` comprueba primero estados terminales e incluye `AUTHORIZED`. Un mensaje con `operacion: "GENERAR_RIDE"` para un comprobante autorizado puede ser `ack()` antes de llegar a la lógica de generación.

La solución no será parchear más condiciones en la misma cola. Se creará una cola RIDE dedicada.

## Arquitectura elegida para Workers Free

```text
facturas-queue
    |
    | consulta SRI / persiste AUTORIZADO
    v
AUTHORIZED
    |
    | publica MensajeGenerarRide
    v
rides-queue  (batch pequeño, CPU aislada)
    |
    v
generador-ride
    |
    v
ride.pdf -> R2
    |
    v
EMAIL_DELIVERY -> notificaciones-queue -> Gmail
```
## Política de render

El modo inicial de producción será `embedded` dentro del consumer de `rides-queue`.

No se habilitará infraestructura remota mientras el renderer embebido cumpla simultáneamente:

- 0 errores 1102 por CPU/memoria.
- CPU p95 por mensaje RIDE < 1,000 ms.
- CPU p99 por invocación de batch < 5,000 ms.
- Memoria observada sin aproximarse al límite de 128 MB.
- 100% de paridad visual y semántica.
- Bundle total `facturador` < 3 MiB gzip.

Estos presupuestos dejan margen amplio frente al límite de Queue Consumer y evitan optimizaciones prematuras.

## Optimización del backend PDF

La implementación debe conservar `PDFKit` como backend de referencia hasta que otro backend demuestre igualdad.

Se evaluarán, en este orden:

1. `pdf-lib`, porque ya mostró menor CPU y menor bundle en un spike.
2. `MiniPdfDocument`, un backend propio limitado a las primitivas reales del layout.
3. PDFKit actual si ninguna alternativa supera todos los gates.

No se acepta una alternativa por ser más rápida. Debe pasar el mismo corpus golden de los 6 comprobantes, A4/Letter, QR, logo, autorizado/no autorizado y casos extremos.

La salida elegida puede tener bytes distintos, pero debe conservar:

- mismo número de páginas;
- mismo texto y orden;
- posiciones dentro de 0.5 pt;
- pixel diff <= 0.1% a 144 DPI;
- mismo Code128 y misma matriz QR;
- ningún overflow o truncamiento nuevo.
## Arquitectura remota de escape

Si telemetría real demuestra que `embedded` no es suficientemente seguro, `RideRenderer` cambiará de implementación sin tocar casos de uso.

Orden remoto requerido:

```text
facturador Worker
    |
    | POST /v1/render
    v
Servidor privado + Docker + Cloudflare Tunnel
    |
    | si timeout/red/502/503/504
    v
Cloud Run southamerica-west1
    |
    v
PDF
```

Los dos orígenes deben ejecutar exactamente la misma imagen OCI por digest.

El servicio es stateless: recibe JSON, genera bytes PDF y responde `application/pdf`. No escribe R2, no envía correo, no consulta SRI y no guarda estado.

### Failover

Primario privado:

- timeout total: 1,500 ms;
- fallback ante error de red, timeout, 429, 502, 503 o 504;
- un 4xx de validación es permanente y no dispara fallback;
- un 500 de renderer se registra como fallo de aplicación y no se oculta con reintentos infinitos.

Cloud Run:

- timeout cliente: 15 s;
- `min-instances=0` mientras se priorice costo;
- 1 vCPU;
- 256 MiB iniciales, subir solo con evidencia;
- región inicial `southamerica-west1` (Santiago), validada con benchmark desde Cloudflare.
## Seguridad del renderer remoto

Ambos orígenes aceptan solo requests firmados por `facturador`.

Headers:

- `x-ride-timestamp`: epoch milliseconds.
- `x-ride-body-sha256`: SHA-256 hexadecimal del body exacto.
- `x-ride-signature`: HMAC-SHA256 de `timestamp + "\n" + bodySha256`.
- `x-correlation-id`: correlación técnica, sin PII.

El secreto vive únicamente en Worker Secrets y en el entorno de los renderers.

El servidor valida ventana máxima de 60 s, body máximo 1 MiB y `content-type: application/json`. Nunca loguea XML completo, documento completo, RUC del receptor, email ni datos de detalle.

Cloudflare Tunnel publica el servicio privado mediante conexión outbound-only; no se abre ningún puerto WAN en el servidor.

## Imagen única

La imagen se construye desde `generador-ride` y se publica en Artifact Registry con tag de commit y digest inmutable.

Cloud Run se despliega por digest. El servidor privado hace pull del mismo digest. Así el failover no puede producir un RIDE visualmente distinto por ejecutar versiones distintas.

## Evolución a Workers Paid

Cuando el sistema escale y se migre a Workers Paid, se evaluará un Worker `ride-renderer` separado invocado por Service Binding.

La migración futura cambia solamente el adaptador `RideRenderer`; R2, correo, colas, idempotencia y contrato del servicio permanecen iguales.

## Decisión

1. Implementar cola RIDE dedicada.
2. Integrar `generador-ride` embebido y medir CPU real del Queue Consumer.
3. Optimizar backend solo bajo gates de paridad.
4. Mantener embedded mientras cumpla budgets.
5. Implementar renderer remoto y failover como capacidad preparada, pero activarlo solo si telemetría lo justifica o mediante feature flag operativa.
6. Si se activa remoto: servidor privado por Tunnel primero, Cloud Run segundo.
7. Al pasar a Workers Paid: Service Binding pasa a ser la opción preferida de aislamiento.
## Referencias operativas verificadas

Estado documental verificado el 2026-09-04:

- Cloudflare Workers Limits, actualizado 2026-09-03: HTTP Free = 10 ms CPU; memoria 128 MB; bundle 3 MB gzip.
- Cloudflare Queues Limits, actualizado 2026-04-21: su tabla específica declara Free/Paid y consumer CPU de 30 s por defecto, configurable hasta 5 min; wall-clock 15 min.
- Cloudflare Workers Pricing mantiene una fila general Free de 10 ms por invocación; por esta ambigüedad documental, el probe real de `rides-queue` es un gate obligatorio antes de aprobar embedded.
- Cloudflare Queues Free: 10,000 operaciones/día incluidas; retención Free 24 h.
- Cloudflare Tunnel: disponible en todos los planes; conexiones outbound-only; cuatro conexiones persistentes por tunnel y soporte de réplicas.
- Cloud Run: free tier mensual vigente y `southamerica-west1` disponible; Artifact Registry recomendado para imágenes inmutables.

La implementación debe volver a consultar estos límites antes de un despliegue productivo futuro si han pasado más de 30 días desde esta especificación.
