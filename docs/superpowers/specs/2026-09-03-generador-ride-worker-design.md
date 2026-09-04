# Generador RIDE Worker-First — Design

**Date:** 2026-09-03
**Target:** `/home/agaibor/code/javascript/generador-ride`
**Reference implementation:** `../teran-sri-ec-node` tag `v0.3.0` (`f6d878d`)

## Goal

Build a standalone TypeScript library that generates the same SRI RIDE layout as `sri-ec/ride` v0.3.0 for all six electronic document types, while being a first-class dependency of a Cloudflare Worker.

The library must be deterministic, side-effect free, filesystem-free at runtime, small enough for Worker deployment, and pleasant to consume from TypeScript.

## Non-goals

- No XML generation, signing, SOAP, SRI submission, retries, queues, persistence, or business decisions.
- No dependency on the `sri-ec` package at runtime.
- No HTML-to-PDF, Chromium, Puppeteer, Playwright, or external rendering service.
- No redesign or branding layer in v1; visual parity with the current RIDE is the contract.
- No runtime schema framework such as Zod unless a concrete need appears.

## Source of truth and compatibility

The visual source of truth is the current `teran-sri-ec-node` RIDE implementation plus its Anexo 2 tests, not a new interpretation of the SRI layout.

Compatibility target:
- `generarRide(options): Promise<Uint8Array>` remains the primary API.
- Keep per-document helpers: `generarRideFactura`, `generarRideLiquidacionCompra`, `generarRideNotaCredito`, `generarRideNotaDebito`, `generarRideGuiaRemision`, `generarRideRetencion`.
- Keep `A4 | LETTER`, `codigoBarras` default `true`, `incluirQr` default `false`, optional logo, and optional authorization.
- Keep the same six document discriminators and structurally compatible document shapes.
- Existing objects created by `sri-ec` should be assignable without an adapter because TypeScript is structurally typed.

Visual equivalence means the same content, labels, block ordering, page breaks, dimensions, typography family/style, Code 128 payload, and layout within a tolerance of 0.5 PDF points. PDF bytes are not required to be identical.

## Recommended architecture

Use one Worker-first ESM package with a thin public API and internal focused modules. Do not create separate Node and Worker packages.

The renderer stays PDFKit-based to preserve behavior. PDFKit is isolated behind a single internal document module so it can be replaced later without changing the public API.

Proposed source layout:

```text
src/
  index.ts
  types.ts
  errors.ts
  money.ts
  pdf/document.ts
  barcode/code128.ts
  qr/qr-vector.ts
  layout/constants.ts
  layout/pagination.ts
  layout/header.ts
  layout/subject.ts
  layout/details.ts
  layout/footer.ts
  layout/totals.ts
  renderers/factura.ts
  renderers/liquidacion-compra.ts
  renderers/nota-credito.ts
  renderers/nota-debito.ts
  renderers/guia-remision.ts
  renderers/retencion.ts
```

The initial extraction should first copy behavior nearly verbatim, then split the current ~96 KB `blocks.ts` mechanically under regression tests. Refactoring and portability changes must never happen in the same step as an unverified visual change.

## Runtime and dependency strategy

- ESM-only package; no CJS build in v1.
- TypeScript declarations are shipped with the package.
- Use PDFKit `0.19.1` initially because it is the version expected by the reference project; upgrade only after parity tests pass.
- Register only `Helvetica` and `Helvetica-Bold` standard-font data explicitly rather than relying on filesystem AFM lookup.
- Do not use PDFKit's experimental `toBytes` helper in v1; collect stream chunks with the stable stream API.
- Remove `bufferPages: true` after proving parity because the current renderer never switches back to buffered pages.
- Return the final `Buffer` directly as `Uint8Array` to avoid an unnecessary second copy.
- Keep `qrcode` only for its `create()` matrix encoder. Never call its Worker-problematic `toBuffer()` server API.
- Draw QR modules directly as PDF rectangles, preserving the same encoded key while removing PNG generation and raster scaling.
- Keep the existing zero-dependency vector Code 128 implementation.

The package owns its rendering dependencies. Consumers install one package and do not need to know about peer dependencies.

## Public API

```ts
export async function generarRide(options: RideOptions): Promise<Uint8Array>;
export class RideError extends Error {
  readonly code: RideErrorCode;
  constructor(message: string, code: RideErrorCode, options?: ErrorOptions);
}
```

`RideOptions`, document types, authorization types, and format options are exported from the root. Internal PDFKit types are never exposed in generated `.d.ts` files.

## Error and validation policy

The renderer validates only invariants needed to render safely: supported document discriminator, required render fields, image decode failures, and known rendering failures. It must not decide whether a sale, tax, customer, sequence, authorization state, or SRI workflow is valid.

Errors use stable codes such as `RIDE_UNSUPPORTED_DOCUMENT`, `RIDE_INVALID_INPUT`, `RIDE_INVALID_LOGO`, and `RIDE_RENDER_FAILED`, with `cause` preserved when available.

## Fidelity and regression strategy

Before extraction, generate reference PDFs from `teran-sri-ec-node@v0.3.0` for all six document types. Keep fixtures and visual baselines in tests, not runtime distribution files.

Test layers:
1. Unit tests for money formatting, Code 128, QR matrix, pagination helpers, and document dispatch.
2. PDF semantic tests with `pdfjs-dist`: text, page count, coordinates, rectangles, labels, and no content loss.
3. Existing stress sweeps: 20–45 details, oversized descriptions, many payments, unknown tax codes, logo/no-logo, authorization/no-authorization.
4. Deterministic visual regression in a pinned CI container by rasterizing both reference and new PDFs and comparing pixels.
5. Real Workers-runtime integration tests with Vitest 4.1+ and `@cloudflare/vitest-plugin`.
6. `wrangler deploy --dry-run` and `wrangler check startup` as release gates.

The QR region may be compared by matrix/position rather than identical antialiasing if it changes from PNG to vector; all other default-layout regions should remain visually equivalent.

## Performance and bundle budgets

The implementation must measure rather than guess. Track compressed Worker bundle size, startup profile, generated PDF size, wall/CPU time for representative fixtures, and peak memory where practical.

Release targets:
- Fit within Cloudflare's 3 MB compressed Worker limit if feasible; if PDFKit prevents it, document the measured minimum before changing renderer technology.
- Stay comfortably under the 128 MB Worker memory ceiling for stress fixtures.
- No performance regression greater than 20% versus the first Worker-compatible baseline without an explicit justification.
- No duplicate full-PDF byte copy in the normal generation path.

## Developer experience

The README begins with a copy-paste Cloudflare Worker example and a plain Node example. One install must be enough. No environment flags, filesystem setup, font copying, or optional dependency instructions should be required from consumers.

Package scripts provide `test`, `test:worker`, `test:visual`, `typecheck`, `build`, `check:bundle`, and `verify`. `verify` is the release gate and runs everything that can catch a broken published package.

## Release policy

Start at `0.1.0` while parity is being proven. Publish `1.0.0` only when all six document types pass semantic, visual, Worker-runtime, package-consumer, and bundle gates. Keep the public API minimal so `1.x` can remain stable.
