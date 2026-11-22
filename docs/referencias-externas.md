# Repositorios externos de referencia

No son dependencias. Se revisan para contrastar el RIDE y la emisión con otras implementaciones ecuatorianas; no se copia código sin verificar su licencia y adaptarlo al contrato de este paquete.

| Repositorio | Qué aporta | Ruta clave | Commit revisado | Licencia |
| --- | --- | --- | --- | --- |
| [JonathanTeran/teran-sri-ec-node](https://github.com/JonathanTeran/teran-sri-ec-node) | RIDE del Anexo 2 para los 6 comprobantes; es el oráculo de `test/reference/v0.3.0` | `packages/sri-ec/src/ride/blocks.ts`, `*.ride.ts` | `f6d878df` | MIT |
| [Larevalot/cacao-facturador-ec](https://github.com/Larevalot/cacao-facturador-ec) | Tres plantillas RIDE en Rust (clásica, moderna, compacta), UI de escritorio | `src/sri/pdf_builder.rs` | `bdcb0046` | revisar `Cargo.toml` |
| [israelgo93/FacturIA](https://github.com/israelgo93/FacturIA) | Plantillas React-PDF para los 6 comprobantes y flujo completo SRI | `src/components/pdf/RIDE*.jsx` | `555db79a` | revisar repositorio |
| [AngeloBarzolaVillamar/open-api-facturacion-sri](https://github.com/AngeloBarzolaVillamar/open-api-facturacion-sri) | API NestJS con RIDE vía Carbone y plantillas Word/Excel | `README.md`, `src/modules/pdf`, `templates/` | `b41a7c79` | MIT |
| [bryancalisto/ec-sri-invoice-signer](https://github.com/bryancalisto/ec-sri-invoice-signer) | Firma XAdES-BES de XML; no genera RIDE | `src/`, `test/canonicalization/` | `339bfb83` | revisar repositorio |

## Cuándo revisarlos

- Al cambiar la ficha técnica del SRI o una resolución que afecte la representación impresa.
- Antes de tocar etiquetas, columnas o bloques del RIDE.
- Una vez por trimestre, aunque no haya cambios regulatorios.

## Cómo revisar

Clona en un directorio temporal y compara solo las rutas relevantes:

```sh
git clone --depth 1 https://github.com/JonathanTeran/teran-sri-ec-node /tmp/refs/teran
git -C /tmp/refs/teran log --oneline -20 -- packages/sri-ec/src/ride
git -C /tmp/refs/teran diff f6d878df..origin/main -- packages/sri-ec/src/ride
```

Repite con las rutas de la tabla. Para teran, recuerda que su commit está fijado en `scripts/generate-reference.mjs`: cambiarlo obliga a regenerar `test/reference/v0.3.0` y a justificar la diferencia visual.

## Qué mirar

- Etiquetas y orden de bloques del Anexo 2 (cabecera, sujeto, detalle, totales, pie).
- Columnas del detalle por tipo de comprobante y manejo de subsidio.
- Totales: IVA por tarifa, ICE, IRBPNR, propina, descuento, ahorro por subsidio.
- Paginación de tablas largas y repetición de encabezados.
- Campos opcionales que el XML puede traer y el RIDE no debe perder.
- Catálogos y códigos usados en las etiquetas (formas de pago, identificación, impuestos).

El modelo obligatorio no es estas implementaciones: es el Anexo 2 de la ficha técnica del SRI (figuras en `facturador/docs/sri/markdown/ficha-tecnica-comprobantes-electronicos-offline-v2-33/imagenes/`) y la regla está escrita en `facturador/docs/ride/ANEXO-2.md`. El QR no es requisito; el código de barras es opcional (numeral 9.20).

## Registro de revisiones

| Fecha | Repos revisados | Resultado |
| --- | --- | --- |
| 2026-11-22 | teran, cacao, FacturIA, open-api, ec-sri-invoice-signer | Se incorporó la variante `plantilla: 'sri'` para los 6 comprobantes. Sin cambios pendientes en los commits listados. |
| 2026-11-22 | ficha técnica SRI v2.33 (numerales 9.19-9.21 y notas del Anexo 2) | La variante `plantilla: 'sri'` se retira: queda una sola plantilla alineada al Anexo 2, sin QR por defecto y con las etiquetas/columnas literales del modelo. |


