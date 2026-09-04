# Rendimiento

Este documento registra mediciones reproducibles del Worker y de la generación PDF. Los números concretos se actualizan en `task-11-report.md` después de ejecutar los gates.

## Reproducción

```sh
bun run benchmark
bun run check:bundle
```

`benchmark.mjs` genera cada caso en tres subprocesses fríos y tres generaciones dentro de un subprocess caliente. Registra duración de generación, tamaño PDF y versiones de Bun/Node en `.tmp/benchmark.json`. El tiempo es wall-clock del proceso de generación, no CPU de Cloudflare.

Casos: factura de 1, 40 y 100 líneas, retención y guía. En Bun 1.4.0 / Node v26.3.0, las medianas observadas fueron:

| Caso | Frío mediana | Caliente mediana | PDF |
| --- | ---: | ---: | ---: |
| Factura, 1 línea | 72.36 ms | 29.81 ms | 4,031 B |
| Factura, 40 líneas | 188.53 ms | 123.67 ms | 9,175 B |
| Factura, 100 líneas | 301.18 ms | 118.85 ms | 16,144 B |
| Retención | 79.60 ms | 30.01 ms | 3,615 B |
| Guía | 97.78 ms | 32.16 ms | 3,376 B |

## Bundle

`check-worker-bundle.mjs` ejecuta `bunx wrangler deploy --config test/worker/wrangler.jsonc --dry-run` con `--outfile` para conservar el bundle, suma los JavaScript emitidos y calcula gzip. El baseline versionado es **515.65 KiB gzip**, la medición de Task 10 indicada por el plan; el gate permite hasta 10% adicional. La medición actual es **514.13 KiB gzip**. También ejecuta `bunx wrangler check startup --config test/worker/wrangler.jsonc --worker .tmp/worker-bundle/worker.js`.

La compatibilidad con el límite de CPU del plan Free no se afirma: estas mediciones no ejecutan el código dentro del presupuesto CPU de Cloudflare. El límite documentado aquí es únicamente el tamaño comprimido de bundle y el perfil local.

La inspección del bundle se limita a evidencia: confirma AFM/font data y `fontkit`, y busca módulos renderer PNG/Canvas/SVG de QR y server renderers. La importación de QR está limitada a `qrcode/lib/core/qrcode.js`; las pruebas semánticas y visuales permanecen verdes. No se eliminan imports basándose solo en texto del bundle; cualquier reducción requiere prueba semántica y visual.
