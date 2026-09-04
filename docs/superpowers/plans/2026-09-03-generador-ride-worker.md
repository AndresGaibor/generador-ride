# Generador RIDE Worker-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone TypeScript RIDE library in `~/code/javascript/generador-ride` that preserves the `teran-sri-ec-node` v0.3.0 visual/functional RIDE behavior and can be consumed directly by Cloudflare Workers.

**Architecture:** Extract the proven PDFKit renderer, remove all runtime coupling to `sri-ec`, make the PDF/QR path Worker-safe, then refactor the monolithic layout only behind strict semantic and visual regression gates. The public API stays tiny and structurally compatible with existing `sri-ec` documents.

**Tech Stack:** TypeScript 5.9+, ESM, PDFKit 0.19.1 initially, qrcode 1.5.4 `create()` only, Vitest 4.1+, pdfjs-dist, tsup, Wrangler, `@cloudflare/vitest-plugin`.

**Spec:** `docs/superpowers/specs/2026-09-03-generador-ride-worker-design.md`

## Global Constraints

- Runtime target: Cloudflare Workers with compatibility date `2026-09-03` or newer.
- No runtime dependency on `sri-ec`.
- No filesystem reads, browser APIs, DOM, native binaries, or network calls in the library runtime path.
- Preserve all six RIDE types and current defaults: A4, Code 128 on, QR off.
- Visual/layout tolerance: 0.5 PDF points outside the optional QR raster-to-vector region.
- No business/SRI workflow decisions; this package renders only.
- ESM-only v1; do not add CommonJS unless a real consumer requires it.
- TDD for every behavior change; frequent focused commits.

---
### Task 1: Freeze the v0.3.0 reference before extraction

**Files:**
- Create: `test/reference/README.md`
- Create: `scripts/generate-reference.mjs`
- Create: `test/fixtures/reference/*.json`
- Create: `test/reference/v0.3.0/*.pdf`

**Interfaces:**
- Consumes: sibling repo `../teran-sri-ec-node` at commit `f6d878d`.
- Produces: immutable reference PDFs and JSON fixtures used by later parity tests.

- [ ] **Step 1:** In `../teran-sri-ec-node`, use Bun to install dependencies and run the workspace tests; do not continue until the existing RIDE suite is green.
- [ ] **Step 2:** Copy the six existing document fixtures into JSON files owned by this project; preserve strings exactly and add variants for authorized/unauthorized, logo/no-logo, QR on/off, A4/LETTER.
- [ ] **Step 3:** Write `scripts/generate-reference.mjs` to import the built sibling `sri-ec/ride`, generate PDFs from those fixtures, and refuse to run if `git -C ../teran-sri-ec-node rev-parse HEAD` is not `f6d878d`.
- [ ] **Step 4:** Run the script and verify every output starts with `%PDF-` and all six base files are non-empty.
- [ ] **Step 5:** Record SHA-256 hashes and reference commit in `test/reference/README.md`; the hash is provenance, not the future parity criterion.
- [ ] **Step 6:** Commit: `test: freeze sri-ec v0.3.0 RIDE references`.

Expected base files: `factura.pdf`, `liquidacion-compra.pdf`, `nota-credito.pdf`, `nota-debito.pdf`, `guia-remision.pdf`, `retencion.pdf`.
### Task 2: Scaffold the standalone ESM package and public contracts

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `src/index.ts`, `src/types.ts`, `src/errors.ts`, `src/money.ts`
- Test: `test/public-api.test.ts`, `test/money.test.ts`, `test/types.test-d.ts`

**Interfaces:**
- Produces: `generarRide(options: RideOptions): Promise<Uint8Array>`, `RideError`, all public document/option types, and internal money helpers.

- [ ] **Step 1:** Initialize package metadata as `generador-ride@0.1.0`, `type: module`, `sideEffects: false`, ESM `exports`, bundled `.d.ts`, and `files: ["dist", "README.md", "LICENSE"]`.
- [ ] **Step 2:** Add runtime dependencies `pdfkit@0.19.1` and `qrcode@1.5.4`; add dev dependencies TypeScript, tsup, Vitest 4.1+, `@types/pdfkit`, `@types/qrcode`, and `pdfjs-dist`.
- [ ] **Step 3:** Port only the document shapes/catalog string unions required by the renderer into `src/types.ts`; use literal string unions so no runtime enum package is needed.
- [ ] **Step 4:** Define `RideErrorCode = 'RIDE_UNSUPPORTED_DOCUMENT' | 'RIDE_INVALID_INPUT' | 'RIDE_INVALID_LOGO' | 'RIDE_RENDER_FAILED'` and `new RideError(message, code, options?)`, preserving `options.cause`.
- [ ] **Step 5:** Copy `formatMonto`, `toCents`, and `fromCents` behavior into `src/money.ts`; write tests from the current `sri-ec` behavior before implementation.
- [ ] **Step 6:** Export only public contracts from `src/index.ts`; do not expose PDFKit types or internal draw helpers.
- [ ] **Step 7:** Run `bun run typecheck`, `bun test`, and `bun run build`; inspect `dist/index.d.ts` to prove it does not reference `PDFKit` ambient types.
- [ ] **Step 8:** Commit: `feat: scaffold standalone RIDE package contracts`.
### Task 3: Make the PDF document primitive Worker-safe

**Files:**
- Create: `src/pdf/document.ts`
- Test: `test/pdf-document.test.ts`

**Interfaces:**
- Produces: `crearDocumentoRide(tamano: TamanoPaginaRide): Promise<{ doc: PDFKit.PDFDocument; finalizar(): Promise<Uint8Array> }>` for internal renderers.

- [ ] **Step 1:** Write a failing test that creates an A4 document, writes one Helvetica line, finalizes it, and asserts `%PDF-`, A4 page dimensions, and extractable text.
- [ ] **Step 2:** Import PDFKit using its ESM API and explicitly register `pdfkit/standard-fonts/Helvetica` and `pdfkit/standard-fonts/HelveticaBold` before constructing the document.
- [ ] **Step 3:** Construct with `{ size: tamano, margin: 36, autoFirstPage: true }`; intentionally omit `bufferPages: true`.
- [ ] **Step 4:** Collect `Buffer` chunks using the stable stream events and resolve `Buffer.concat(chunks)` directly as `Uint8Array`; reject on `error`.
- [ ] **Step 5:** Add a stress test that generates multiple pages and verifies no page content disappears without `bufferPages`.
- [ ] **Step 6:** Run `bun test test/pdf-document.test.ts` and `bun run typecheck`.
- [ ] **Step 7:** Commit: `feat: add worker-safe pdfkit document primitive`.

Do not use PDFKit's experimental `pdfkit/output` helpers in this task. The stable stream API is the compatibility baseline.
### Task 4: Preserve Code 128 and replace QR PNG rendering with vectors

**Files:**
- Create: `src/barcode/code128.ts`
- Create: `src/qr/qr-vector.ts`
- Test: `test/code128.test.ts`, `test/qr-vector.test.ts`

**Interfaces:**
- Produces: `patronCode128(clave: string): number[]`, `dibujarCode128(doc, clave, area)`, and `crearQrMatrix(texto): { size: number; get(row: number, col: number): boolean }` plus vector draw helper.

- [ ] **Step 1:** Port the current `code128.ts` unchanged and copy its six unit tests; verify they pass before refactoring names or comments.
- [ ] **Step 2:** Write a failing QR test using one known 49-digit access key and snapshot `version`, `maskPattern`, matrix size, and a SHA-256 of `modules.data` from `QRCode.create()`.
- [ ] **Step 3:** Implement QR encoding only through `QRCode.create(text, { errorCorrectionLevel: 'M' })`; never import or call `toBuffer`, `toFile`, PNG renderers, canvas, or filesystem APIs.
- [ ] **Step 4:** Draw a white quiet zone and black modules with `doc.rect(...).fill()` using `modules.get(row, col)`; use the same physical box currently reserved by the RIDE so layout does not move.
- [ ] **Step 5:** Generate a QR-enabled reference and new PDF; assert identical encoded matrix and equivalent box coordinates even though raster antialiasing is intentionally gone.
- [ ] **Step 6:** Run Code 128 + QR tests and ensure `grep -R "toBuffer\|pngjs" src` returns no runtime usage.
- [ ] **Step 7:** Commit: `feat: add worker-safe vector barcode and qr rendering`.

This keeps the current QR encoder behavior while avoiding the `toBuffer()` path known to disappear under Cloudflare's browser-oriented qrcode resolution.
### Task 5: Extract the proven shared layout without redesigning it

**Files:**
- Create: `src/layout/blocks.ts`
- Create: `src/layout/constants.ts`
- Create: `src/layout/pagination.ts`
- Test: `test/layout-unit.test.ts`

**Interfaces:**
- Consumes: standalone types, money helpers, Code 128, QR vector helper, PDF document primitive.
- Produces: the existing `medir*`, `draw*`, `asegurarEspacio`, label, formatting, and table helpers needed by all six renderers.

- [ ] **Step 1:** Copy current `packages/sri-ec/src/ride/blocks.ts` into `src/layout/blocks.ts` with no geometry or copy changes.
- [ ] **Step 2:** Replace imports from `../catalogs`, `../documents`, and `sri-ec` with the new standalone `types.ts`, `money.ts`, `errors.ts`, and barcode helper.
- [ ] **Step 3:** Replace QR parameters typed as `Buffer` with an internal QR matrix/vector descriptor so the header draws the QR directly in the same reserved area.
- [ ] **Step 4:** Port the current layout helper tests that exercise wrapped total labels, row splitting, page boundaries, and unknown tax codes.
- [ ] **Step 5:** Run only those tests and diff every changed numeric constant against the reference source; numeric layout constants must remain identical in this task.
- [ ] **Step 6:** Move only constants and page-space logic that can be mechanically extracted without behavior changes into `constants.ts` and `pagination.ts`; rerun tests after each move.
- [ ] **Step 7:** Commit: `feat: extract reference RIDE layout engine`.

Reviewer rule: reject this task if it mixes cleanup/style redesign with extraction. Behavioral preservation is more important than elegance here.
### Task 6: Port the six renderers and dispatcher with structural compatibility

**Files:**
- Create: `src/renderers/factura.ts`, `src/renderers/liquidacion-compra.ts`
- Create: `src/renderers/nota-credito.ts`, `src/renderers/nota-debito.ts`
- Create: `src/renderers/guia-remision.ts`, `src/renderers/retencion.ts`
- Modify: `src/index.ts`
- Test: `test/renderers/*.test.ts`, `test/dispatcher.test.ts`

**Interfaces:**
- Produces all seven public generation functions with the same names and option semantics as `sri-ec/ride`.

- [ ] **Step 1:** Port `factura.ride.ts` first, changing only imports and QR representation; verify its extracted text contains every reference label and value.
- [ ] **Step 2:** Compare factura page count and all text coordinates/rectangles against `test/reference/v0.3.0/factura.pdf` within 0.5 pt.
- [ ] **Step 3:** Repeat the same red-green cycle independently for liquidación, nota de crédito, nota de débito, guía, and retención.
- [ ] **Step 4:** Implement `generarRide()` as an exhaustive switch on literal document `tipo`; unsupported runtime values throw `new RideError('Tipo de comprobante no soportado por el RIDE.', 'RIDE_UNSUPPORTED_DOCUMENT')`.
- [ ] **Step 5:** Add type tests proving objects typed by the reference `sri-ec` document interfaces are structurally assignable to the new `RideOptions` without an adapter.
- [ ] **Step 6:** Run `bun test test/renderers test/dispatcher.test.ts` and `bun run typecheck`.
- [ ] **Step 7:** Commit: `feat: port all six RIDE renderers`.
### Task 7: Recreate the semantic and pagination regression shield

**Files:**
- Create: `test/pdf-analysis.ts`
- Create: `test/layout-parity.test.ts`
- Create: `test/stress-layout.test.ts`

**Interfaces:**
- Produces reusable PDF analysis helpers returning page text items and rectangle geometry.

- [ ] **Step 1:** Port the current `pdfjs-dist` analyzer: page text with x/y coordinates plus PDF rectangle operators.
- [ ] **Step 2:** Port the 20–45 detail-row sweeps for factura and nota de crédito and require healthy positive rectangles on every page.
- [ ] **Step 3:** Port the oversized-description case and require repeated table headers, preserved amounts, borders, and all description lines.
- [ ] **Step 4:** Port the many-payment-rows case and verify footer columns begin together and every payment row remains present.
- [ ] **Step 5:** Port logo/no-logo, authorization/no-authorization, unknown tax-code, wrapped-total-label, and all six document-specific label assertions.
- [ ] **Step 6:** Add a reference-comparison helper that checks page count plus matching text coordinates and bounding rectangles within 0.5 pt.
- [ ] **Step 7:** Run `bun test`; no renderer refactor is allowed until this suite is green.
- [ ] **Step 8:** Commit: `test: preserve RIDE semantic and pagination parity`.
### Task 8: Add deterministic visual regression tests

**Files:**
- Create: `test/visual/Dockerfile`
- Create: `test/visual/compare.mjs`
- Create: `test/visual/visual-parity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `bun run test:visual`, comparing reference and generated pages in a pinned rendering environment.

- [ ] **Step 1:** Add dev-only `pixelmatch` and `pngjs`; keep them out of runtime dependencies.
- [ ] **Step 2:** Build a pinned Linux test image with `poppler-utils` and rasterize every PDF page at 144 DPI using `pdftoppm -png`.
- [ ] **Step 3:** Compare each default RIDE page against v0.3.0 with `pixelmatch`; fail above 0.1% mismatched pixels and always emit a diff image on failure.
- [ ] **Step 4:** For QR-enabled cases, mask only the QR drawing box from pixel parity and separately require equal QR matrix, box position, and dimensions.
- [ ] **Step 5:** Add `bun run test:visual` and run it twice to prove deterministic results.
- [ ] **Step 6:** Commit: `test: add deterministic RIDE visual parity gate`.
### Task 9: Split the monolithic layout into focused internal modules

**Files:**
- Create: `src/layout/header.ts`, `src/layout/subject.ts`, `src/layout/details.ts`
- Create: `src/layout/footer.ts`, `src/layout/totals.ts`, `src/layout/labels.ts`
- Modify/Delete: `src/layout/blocks.ts`

**Interfaces:**
- Public API: unchanged.
- Internal renderers continue consuming named `draw*`/`medir*` helpers with identical signatures.

- [ ] **Step 1:** Move header measurement/drawing and issuer/comprobante helpers into `header.ts`; run semantic + visual tests.
- [ ] **Step 2:** Move subject/band helpers into `subject.ts`; run semantic + visual tests.
- [ ] **Step 3:** Move details table measurement, row splitting, repeated headings, and pagination into `details.ts`; run stress + visual tests.
- [ ] **Step 4:** Move totals into `totals.ts` and footer/payment/additional-info logic into `footer.ts`; run all parity tests.
- [ ] **Step 5:** Move static catalog/label mapping into `labels.ts`; preserve fallback behavior for unknown codes.
- [ ] **Step 6:** Delete `blocks.ts` only after no imports remain; run `bun run verify`.
- [ ] **Step 7:** Commit each mechanical move separately so any visual regression can be bisected immediately.

Do not introduce a generic layout DSL, plugin system, themes, templates, dependency injection, or backend abstraction in v1. Focused files are enough.
### Task 10: Prove the library inside the actual Workers runtime

**Files:**
- Create: `test/worker/worker.ts`
- Create: `test/worker/wrangler.jsonc`
- Create: `vitest.worker.config.ts`
- Create: `test/worker/worker.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: a local Worker entrypoint that imports the built package and returns generated PDF bytes in a Fetch `Response`.

- [ ] **Step 1:** Install Vitest 4.1+ and `@cloudflare/vitest-plugin`; configure `cloudflareTest()` against `test/worker/wrangler.jsonc`.
- [ ] **Step 2:** Set `compatibility_date` to `2026-09-03`; do not add redundant `nodejs_compat` flags.
- [ ] **Step 3:** Implement a test Worker that imports `generarRide` from the package root, generates a factura from a fixture, and returns `Content-Type: application/pdf`.
- [ ] **Step 4:** Write Worker-runtime tests for default factura, all six dispatch types, logo, QR on, and authorization absent/present; assert `%PDF-` and parseability.
- [ ] **Step 5:** Run `bun run build && bun run test:worker`; tests must execute in the Workers runtime, not plain Node.
- [ ] **Step 6:** Run `npx wrangler deploy --config test/worker/wrangler.jsonc --dry-run --outdir .tmp/worker-bundle` and inspect for unresolved Node/AFM/font files.
- [ ] **Step 7:** Commit: `test: verify RIDE package in Cloudflare Workers runtime`.
### Task 11: Measure and optimize Worker bundle, CPU, and memory without changing layout

**Files:**
- Create: `scripts/benchmark.mjs`
- Create: `scripts/check-worker-bundle.mjs`
- Create: `docs/performance.md`
- Modify: `package.json`

**Interfaces:**
- Produces: repeatable performance measurements and release budgets.

- [ ] **Step 1:** Record baseline generation time and PDF size for a one-line factura, 40-line factura, 100-line factura, retención, and guía; use warm and cold runs separately.
- [ ] **Step 2:** Record `wrangler deploy --dry-run` total/gzip size and `wrangler check startup` output for the test Worker.
- [ ] **Step 3:** Confirm removing `bufferPages` lowers or does not worsen peak memory while every semantic/visual test remains green.
- [ ] **Step 4:** Inspect the Worker bundle for unused QR PNG/server renderer code and duplicate PDFKit/font data; remove only imports proven unnecessary by bundle analysis.
- [ ] **Step 5:** Add `bun run check:bundle` that fails if compressed size exceeds the accepted baseline by more than 10%; target staying below Cloudflare Free's 3 MB compressed limit where technically feasible.
- [ ] **Step 6:** Add benchmark comparison guardrails: no >20% regression in representative generation time without documented rationale.
- [ ] **Step 7:** Write exact measured numbers and environment into `docs/performance.md`; never claim Free-plan CPU compatibility unless measured under its CPU budget.
- [ ] **Step 8:** Commit: `perf: establish Cloudflare RIDE bundle and runtime budgets`.
### Task 12: Test the published-package experience, not only source imports

**Files:**
- Create: `test/package-consumer/smoke.mjs`
- Create: `test/package-consumer/worker.ts`
- Create: `scripts/test-package.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `bun run test:package`, which tests the exact tarball a consumer would install.

- [ ] **Step 1:** Run Bun's package pack command and create a temporary clean consumer directory outside the repository.
- [ ] **Step 2:** Install only the generated `.tgz`; do not install `pdfkit`, `qrcode`, fonts, or types separately.
- [ ] **Step 3:** From plain Node ESM, import `generarRide` from `generador-ride`, generate a PDF, and assert valid bytes.
- [ ] **Step 4:** From a clean Worker fixture, import the installed tarball, run Wrangler dry-run, and execute one Worker-runtime generation test.
- [ ] **Step 5:** Inspect tarball contents and reject reference PDFs, source fixtures, visual diffs, Worker test fixtures, or accidental local-path dependencies.
- [ ] **Step 6:** Add `bun run test:package` to `verify`.
- [ ] **Step 7:** Commit: `test: verify clean package consumer experience`.
### Task 13: Finish developer experience, CI, and release gates

**Files:**
- Create: `README.md`, `LICENSE`, `.github/workflows/ci.yml`
- Create: `examples/cloudflare-worker.ts`, `examples/node.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: documented install/use flow and a single `bun run verify` release command.

- [ ] **Step 1:** Put a copy-paste Cloudflare Worker example first in README: import package, call `generarRide`, return `new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } })`.
- [ ] **Step 2:** Document all six document types, authorization behavior, logo input, A4/LETTER, Code 128 default, QR opt-in, and stable `RideError` codes.
- [ ] **Step 3:** Document that the package performs rendering only and does not validate business decisions, sign XML, or contact SRI.
- [ ] **Step 4:** Configure CI jobs for typecheck/unit, Worker runtime, visual parity, clean-package smoke, and bundle check; cache dependencies but never baseline outputs generated from an unverified reference commit.
- [ ] **Step 5:** Define `verify` to run `typecheck`, `test`, `test:worker`, `test:visual`, `build`, `test:package`, and `check:bundle` in that order through Bun.
- [ ] **Step 6:** Run `bun run verify` from a clean checkout and Bun's package dry-run; fix every warning that affects consumers.
- [ ] **Step 7:** Tag `0.1.0` only after all gates pass. Promote to `1.0.0` after the package has been exercised by the real consuming Worker and all six RIDE types remain visually equivalent.
- [ ] **Step 8:** Commit: `docs: finish generador-ride release experience`.

---

## Completion Criteria

The project is complete when a clean Cloudflare Worker installs one package, imports `generarRide`, and generates all six RIDE types with no extra font/dependency/runtime configuration; semantic and visual parity against `teran-sri-ec-node@v0.3.0` is green; QR works without `toBuffer()`; clean-package tests pass; and measured Worker bundle/startup/runtime budgets are documented and enforced.
