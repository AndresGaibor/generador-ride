# RIDE Queue en Workers Free — Implementation Plan

> **Cross-repo execution note:** This copy exists so an agent starting in `~/code/javascript/generador-ride` can discover the plan. The implementation spans both `~/code/javascript/generador-ride` and `~/code/javascript/facturador`. The canonical orchestration copy is also stored at `~/code/javascript/facturador/docs/superpowers/plans/2026-09-04-rides-queue-workers-free.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `facturador` genere el RIDE visualmente idéntico de `generador-ride` en un `rides-queue` dedicado, con `max_batch_size=1`, aislando CPU del flujo SRI y manteniendo Workers Free mientras la evidencia real lo permita.

**Architecture:** El flujo fiscal deja de renderizar inline. `facturas-queue` persiste `AUTHORIZED` y encola un mensaje mínimo a `rides-queue`; ese consumer genera/persiste `ride.pdf` en R2 y solo después habilita el correo. El renderer empieza embebido; si el Free real o la CPU medida no cumplen los gates, el mismo puerto cambia a servidor privado por Cloudflare Tunnel con Cloud Run como fallback.

**Tech Stack:** Bun 1.4, TypeScript, Cloudflare Workers/Queues/R2, Wrangler 4.x, `generador-ride`, PDFKit, Vitest, PDF.js, Poppler/pixelmatch, Docker, cloudflared, Cloud Run.

**Spec:** `docs/superpowers/specs/2026-09-04-ride-rendering-runtime-strategy.md`

## Global Constraints

- RIDE visual: misma semántica, mismas páginas, geometría <= 0.5 pt y pixel diff <= 0.1% a 144 DPI frente a los golden v0.3.0.
- Nunca aceptar una optimización que cambie texto, cajas, QR, Code128, logo, saltos o páginas.
- `facturador` conserva autorización SRI, R2, idempotencia, correo y estado fiscal; el renderer solo produce bytes PDF.
- `rides-queue` empieza con `max_batch_size=1`; no aumentarlo sin telemetría real.
- No enviar correo hasta que `ride.pdf` válido esté persistido en R2.
- `AUTHORIZED` nunca se revierte por un fallo de RIDE.
- No registrar XML, PDF, RUC, cédula, email, nombres, productos ni clave de acceso completa.
- El modo remoto es fallback de arquitectura, no camino obligatorio mientras embedded pase los gates.
- Hacer commits pequeños, tests antes de implementación y revisión por tarea.

---

## Decision Tree Before Production

Cloudflare tiene documentación específica de Queues que indica consumer CPU de 30 s por defecto y configurable hasta 5 min, incluso en Free, pero la documentación general de Workers/price sigue mostrando 10 ms para Free de forma más amplia. No asumir: probar la cuenta real primero.

```text
Gate 0: Queue Consumer real en Free
        |
        +-- puede ejecutar 100-500 ms CPU sin exceededCpu --> seguir embedded
        |
        +-- queda limitado ~10 ms -------------------------> probar backend ultraligero
                                                              |
                                                              +-- <10 ms real + visual OK --> embedded
                                                              |
                                                              +-- no cumple -------------> remote
                                                                                             |
                                                                                  private Tunnel
                                                                                       |
                                                                                   si falla
                                                                                       v
                                                                                   Cloud Run
```

## Current Baseline to Preserve

- `facturador` Worker dry-run actual: ~2.02 MiB raw / ~419.81 KiB gzip.
- Spike `facturador + generador-ride`: ~4.68 MiB raw / ~933.14 KiB gzip.
- `generador-ride` PDFKit Worker: alrededor de 18–23 ms para factura normal en runtime local de Workers; QR alrededor de 53 ms; documentos grandes alrededor de 100–160 ms wall-clock local.
- `generador-ride` dispone de `bun run verify`, `benchmark` y `check:bundle`.
- El writer PDF manual viejo de `facturador` es muy rápido pero no es el RIDE visual objetivo y no debe mantenerse como salida productiva final.

---

## File Map

### `facturador`
- `wrangler.jsonc`: bindings/consumers `RIDES_QUEUE` y `RIDES_DLQ`, staging incluido.
- `src/aplicacion/puertos/rides.ts`: `MensajeGenerarRide`, `ColaRides`.
- `src/aplicacion/puertos/ride.ts`: puerto `RideRenderer`.
- `src/aplicacion/casos-de-uso/consultar-autorizacion.ts`: persistir AUT + publicar RIDE, sin render inline.
- `src/aplicacion/casos-de-uso/generar-ride-autorizado.ts`: idempotencia, render, R2, hash y habilitación de correo.
- `src/composicion/dependencias.ts`: inyección de `colaRides` y renderer.
- `src/composicion/workers.ts`: bindings Worker y selección embedded/remote.
- `src/infraestructura/workers/env.ts`: tipos de bindings/config.
- `src/infraestructura/workers/worker.ts`: routing de `rides-queue` y DLQ.
- `src/infraestructura/ride/generador-ride-renderer.ts`: adaptador real a la librería.
- `src/infraestructura/ride/adaptador-documento.ts`: XML autorizado -> tipos `generador-ride`.
- `src/infraestructura/ride/observabilidad.ts`: eventos técnicos sin PII.
- `test/ride/*`: integración visual desde XML autorizado.

### `generador-ride`
- `src/pdf/*`: solo si se ejecuta el track de optimización.
- `test/backend-parity.test.ts`: comparación PDFKit/pdf-lib/mini.
- `service/*`: servicio stateless para Docker/Cloud Run si embedded no cumple.

---

### Task 0: Create an Isolated Worktree and Freeze Both Baselines

**Files:** no product changes yet.

- [ ] Use `superpowers:using-git-worktrees` for both repositories before editing.
- [ ] Record `git rev-parse HEAD`, `git status --short`, Bun, Node and Wrangler versions.
- [ ] In `generador-ride`, run `bun run verify`, `bun run benchmark`, `bun run check:bundle`.
- [ ] In `facturador`, run `bun run check` and `bunx wrangler deploy --dry-run --env=""`.
- [ ] Save sanitized evidence in `docs/operacion/RIDE-QUEUE-BASELINE.md` with exact SHAs and measurements.
- [ ] Do not continue if existing visual tests or Worker tests are red; fix baseline first in a separate commit.

**Acceptance:** green baseline and reproducible sizes/timings before architecture changes.

### Task 1: Prove the Actual Queue CPU Limit on This Workers Free Account

**Files:**
- Create: `scripts/probes/queue-cpu-free/worker.ts`
- Create: `scripts/probes/queue-cpu-free/wrangler.jsonc`
- Create: `scripts/probes/queue-cpu-free/README.md`

**Interfaces:** probe message `{ targetCpuMs: 25 | 100 | 500, nonce: string }`.

- [ ] Implement `burnCpu(targetCpuMs)` as a synchronous JS arithmetic loop that checks `performance.now()` only to stop; no `fetch`, timers, R2 or crypto offload inside the measured section.
- [ ] HTTP `/enqueue?ms=25|100|500` only validates input and sends one queue message; it must not perform the CPU work.
- [ ] Queue handler logs `{event:"QUEUE_CPU_PROBE",targetCpuMs,completed:true,checksum}` only after the loop completes.
- [ ] Configure a dedicated `ride-cpu-probe-staging` queue with `max_batch_size:1`, `max_batch_timeout:1`, no production bindings.
- [ ] First attempt deployment with `limits.cpu_ms: 1000`. Record whether the Free account accepts or rejects that configuration; do not reinterpret an error.
- [ ] If deployment rejects `limits.cpu_ms`, remove only that setting and deploy with the platform default; keep the evidence.
- [ ] Enqueue 10 messages at 25 ms, 10 at 100 ms and 5 at 500 ms.
- [ ] Read Workers logs/invocation status and record `cpuTime`, outcome and any `exceededCpu`/1102 equivalent.
- [ ] Destroy the probe queue/Worker after evidence is saved, unless explicitly retained for regression checks.

**Decision:**
- `FREE_QUEUE_LONG_CPU_PROVEN`: all 100 ms messages and at least 4/5 500 ms messages complete without CPU-limit termination -> embedded track allowed.
- `FREE_QUEUE_10MS_OR_UNCERTAIN`: 25/100 ms messages consistently terminate, deploy behavior is ambiguous, or telemetry cannot prove completion -> do not rely on embedded PDFKit; remote track remains mandatory unless the optimized renderer later proves safe under the observed limit.

**Acceptance:** `docs/operacion/RIDE-QUEUE-BASELINE.md` contains direct account evidence, not an inference from local wall-clock.

### Task 2: Introduce a Dedicated RIDE Queue Port

**Files:**
- Create: `src/aplicacion/puertos/rides.ts`
- Modify: `src/composicion/dependencias.ts`
- Modify: `src/infraestructura/memoria/servicios.ts`
- Test: closest composition/memory tests.

- [ ] Write failing tests requiring a queue independent from `ColaComprobantes`.
- [ ] Add exactly:

```ts
export type MensajeGenerarRide = Readonly<{
  version: 1;
  comprobanteId: string;
  tenantId: string;
  correlationId: string;
}>;

export interface ColaRides {
  publicar(mensaje: MensajeGenerarRide): Promise<void>;
}
```

- [ ] Add `colaRides: ColaRides` to `DependenciasBase`/`DependenciasCompletas`.
- [ ] Add `ColaRidesMemoria` with `publicados: MensajeGenerarRide[]` and structured cloning.
- [ ] Do not put XML, PDF, logo or invoice details in the queue message.
- [ ] Run `bun test src/composicion src/infraestructura/memoria && bun run typecheck`.
- [ ] Commit: `refactor: isolate ride queue contract`.

### Task 3: Change AUT Flow to Persist + Enqueue Only

**Files:**
- Modify: `src/aplicacion/casos-de-uso/consultar-autorizacion.ts`
- Modify: `src/aplicacion/casos-de-uso/consultar-autorizacion.test.ts`
- Modify: `src/composicion/dependencias.ts`

- [ ] Replace tests that expect `ride.pdf` immediately after `AUT` with tests expecting exactly one `MensajeGenerarRide`.
- [ ] Remove the inline call to `generarRideAutorizado()` from the AUT branch.
- [ ] After authorized XML and `AUTHORIZED` state/outbox are persisted, publish:

```ts
await dependencias.colaRides.publicar({
  version: 1,
  comprobanteId: autorizado.id,
  tenantId: autorizado.tenantId,
  correlationId: comando.correlationId,
});
```

- [ ] Prove no `EntregaCorreo` exists yet even when `destinatarioEmail` exists.
- [ ] A failure publishing the RIDE job must surface as transient infrastructure failure; never revert the already-authorized fiscal state.
- [ ] Re-running the authorization path must not create conflicting fiscal state; queue duplication is tolerated by downstream idempotency.
- [ ] Run the focused authorization tests and typecheck.
- [ ] Commit: `refactor: enqueue ride after sri authorization`.

### Task 4: Add `rides-queue` + DLQ to Wrangler

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/infraestructura/workers/env.ts`
- Modify: `src/composicion/workers.ts`

- [ ] Add top-level producers `RIDES_QUEUE -> rides-queue` and `RIDES_DLQ -> rides-queue-dlq`.
- [ ] Add staging producers `RIDES_QUEUE -> rides-queue-staging` and `RIDES_DLQ -> rides-queue-dlq-staging`.
- [ ] Add the production consumer exactly with initial isolation settings:

```json
{
  "queue": "rides-queue",
  "max_batch_size": 1,
  "max_batch_timeout": 1,
  "dead_letter_queue": "rides-queue-dlq",
  "max_retries": 5
}
```

- [ ] Add the DLQ consumer with `max_batch_size:1`, `max_batch_timeout:30`, `max_retries:1`.
- [ ] Mirror the same consumer topology for staging names.
- [ ] Do not set `max_concurrency` initially; observe autoscaling first.
- [ ] Do not add a global `limits.cpu_ms` to the production Worker until Task 1 proves the account behavior and the effect on HTTP/Cron/other handlers is understood.
- [ ] Extend `Env` with `RIDES_QUEUE` and `RIDES_DLQ` using the existing queue binding type.
- [ ] Implement `colaRides.publicar()` as `env.RIDES_QUEUE.send(mensaje)`.
- [ ] Run `bun run typecheck` and `bunx wrangler deploy --dry-run --env=""` plus staging dry-run.
- [ ] Commit: `feat: configure dedicated ride queue`.

### Task 5: Route `rides-queue` Before Fiscal Terminal-State Guards

**Files:**
- Modify: `src/infraestructura/workers/worker.ts`
- Modify: `src/infraestructura/workers/worker.test.ts`

- [ ] Write a regression test with comprobante `AUTHORIZED` + RIDE message proving generation is invoked instead of early `ack()`.
- [ ] Implement a dedicated `consumirLoteRides(batch, deps)` branch before `consumirLoteCola()`.
- [ ] For the main queue: call `deps.generarRide(command, deps.depsGenerarRide)`; `ack()` on generated or already-existing RIDE.
- [ ] Retry only transient infrastructure failures; permanent malformed-document/render errors go through the explicit DLQ policy, never fiscal state rollback.
- [ ] For `rides-queue-dlq`: preserve `AUTHORIZED`, persist/emit a technical failure marker, then `ack()` to stop infinite retry.
- [ ] Remove normal production use of `MensajeComprobante.operacion = "GENERAR_RIDE"`.
- [ ] If old deployed messages may still exist, add a temporary compatibility path that forwards them to `RIDES_QUEUE`; never silently acknowledge them.
- [ ] Add tests: success ack, existing PDF ack, temporal retry, permanent handling, DLQ handling, legacy forwarding.
- [ ] Run `bun test src/infraestructura/workers/worker.test.ts && bun run typecheck`.
- [ ] Commit: `feat: consume ride jobs independently`.

**Acceptance:** an `AUTHORIZED` document can always reach RIDE generation independently of the main fiscal state machine.

### Task 6: Fix the Renderer Port and Integrate `generador-ride` by Immutable SHA

**Files:**
- Modify: `src/aplicacion/puertos/ride.ts`
- Modify: `package.json`, `bun.lock`
- Create: `src/infraestructura/ride/generador-ride-renderer.ts`
- Create: `src/infraestructura/ride/adaptador-documento.ts`
- Modify: `src/composicion/workers.ts`

- [ ] Replace the current infrastructure-leaking `RidePdfDatos` port with:

```ts
export type SolicitudRenderRide = Readonly<{
  xmlAutorizado: string;
  tipoDocumento: TipoDocumentoSri;
  claveAccesoEsperada: string;
  logo?: Uint8Array;
}>;

export interface RideRenderer {
  readonly templateVersion: string;
  templateVersionFor?(solicitud: SolicitudRenderRide): string;
  render(solicitud: SolicitudRenderRide): Promise<Uint8Array>;
}
```

- [ ] Pin `generador-ride` using an immutable git SHA, not `main` or a floating range.
- [ ] `GeneradorRideRenderer` must call only the public `generarRide()` API.
- [ ] Keep PDFKit and QR implementation details entirely inside `generador-ride`.
- [ ] Commit: `feat: integrate canonical ride renderer`.

### Task 7: Build a Lossless Authorized-XML Adapter for All Six SRI Documents

**Files:**
- Create: `src/infraestructura/ride/adaptador-documento.test.ts`
- Modify: `src/infraestructura/ride/adaptador-documento.ts`
- Create: `test/ride/fixtures/{01,03,04,05,06,07}/autorizado.xml`

- [ ] Parse the `<autorizacion>` wrapper and the inner comprobante without lossy string formatting.
- [ ] Produce exactly one of `FacturaDocument`, `LiquidacionCompraDocument`, `NotaCreditoDocument`, `NotaDebitoDocument`, `GuiaRemisionDocument`, `RetencionDocument`.
- [ ] Preserve arrays when a node occurs once or many times; add a helper `array(valor)` and test singleton/multiple cases.
- [ ] Extract `numeroAutorizacion` and `fechaAutorizacion` from the wrapper and pass them separately to `generarRide()`.
- [ ] Require inner `infoTributaria.claveAcceso === claveAccesoEsperada`; mismatch is permanent data-integrity error.
- [ ] Preserve all detail rows, taxes, payments, additional fields, guide recipients and retention support documents required by current library types.
- [ ] Do not use the old flattened `RidePdfDatos` as an intermediate representation; it loses semantics needed by the official layout.
- [ ] Add one fixture and exact shape assertion for each of the six document types.
- [ ] Add singleton-vs-array regression cases for details, taxes, payments, recipients and retention rows.
- [ ] Run `bun test src/infraestructura/ride/adaptador-documento.test.ts && bun run typecheck`.
- [ ] Commit: `feat: adapt authorized sri xml to ride documents`.

**Acceptance:** no information needed by `generador-ride` is synthesized from human-readable strings produced by the old renderer.

### Task 8: Make RIDE Persistence and Email Handoff Strictly Idempotent

**Files:**
- Modify: `src/aplicacion/casos-de-uso/generar-ride-autorizado.ts`
- Modify: `src/aplicacion/casos-de-uso/generar-ride-autorizado.test.ts`
- Modify: `src/aplicacion/casos-de-uso/preparar-entrega-correo.ts` only if its current idempotency contract is insufficient.

- [ ] Load the comprobante and require `AUTHORIZED` before a new render.
- [ ] Compute canonical R2 keys exactly as today; do not change archive paths.
- [ ] Check `ride.pdf` before loading/rendering. Existing valid PDF -> skip render and only ensure mail handoff exists.
- [ ] Load `autorizado.xml`; missing/invalid authorized XML is not converted into a fake PDF.
- [ ] Call `renderer.render({xmlAutorizado,tipoDocumento,claveAccesoEsperada})`.
- [ ] Validate `%PDF-`, `%%EOF`, non-empty bytes and optionally parse with PDF.js before persistence.
- [ ] Compute SHA-256 and store `rideTemplateVersion`, renderer version and hash metadata in R2.
- [ ] Only after immutable R2 persistence succeeds call `prepararEntregaCorreoSiConfigurado()`.
- [ ] Add crash-window test: PDF persisted but queue ack not reached -> retried execution performs zero additional render calls and creates only one logical email delivery.
- [ ] Add test: renderer fails -> no `ride.pdf`, no email delivery, fiscal state remains `AUTHORIZED`.
- [ ] Add test: R2 write fails -> no email delivery and message is retryable.
- [ ] Run focused tests and commit: `fix: make ride generation idempotent before email`.

### Task 9: Enforce Visual Parity Through the Full `facturador` Boundary

**Files:**
- Create: `test/ride/integration-visual.test.ts`
- Create: `test/ride/extreme-fixtures.ts`
- Reuse: `~/code/javascript/generador-ride/test/reference/v0.3.0/*`

- [ ] Generate each PDF through `facturador`'s real `RideRenderer` using authorized XML, not by importing the library directly in the assertion path.
- [ ] Cover document types `01,03,04,05,06,07`.
- [ ] Assert semantic text equality and equal page count.
- [ ] Compare text/rect geometry with maximum deviation 0.5 pt.
- [ ] Rasterize at 144 DPI and require pixel mismatch <=0.1% outside the QR matrix region.
- [ ] For QR, compare matrix, physical size and position rather than antialiasing pixels.
- [ ] Include Code128 payload/position assertions and logo/no-logo variants.
- [ ] Add extreme cases: 45 details, 100 details, one description spanning >100 lines, many payments, long additional fields, multi-page guide and retention.
- [ ] Run the visual suite twice consecutively to detect nondeterminism.
- [ ] A backend/integration that changes page count is rejected even if overall pixel percentage happens to pass.
- [ ] Commit: `test: lock ride visual parity through facturador`.

**Acceptance:** the exact PDF that `facturador` will persist/email looks like the approved `generador-ride` output.

### Task 10: Add CPU/Queue Observability Without PII

**Files:**
- Create: `src/infraestructura/ride/observabilidad.ts`
- Modify: `src/infraestructura/workers/worker.ts`
- Create: `src/infraestructura/ride/observabilidad.test.ts`

- [ ] Wrap only the RIDE consumer work with `performance.now()` for wall-duration diagnostics.
- [ ] Emit structured fields: `event`, `renderer`, `tipoDocumento`, `durationMs`, `pdfBytes`, `success`, `retry`, `fallbackUsed`, `correlationId`.
- [ ] Never emit authorized XML, PDF bytes/base64, RUC, access key, recipient email/name, addresses or line-item descriptions.
- [ ] Add a test that serializes events from fixtures containing known PII strings and asserts none appear.
- [ ] Use Cloudflare Workers invocation telemetry/logs in staging to capture actual `cpuTime` and outcome; `durationMs` is not a substitute for CPU.
- [ ] Track queue backlog, oldest-message age, retries and DLQ count.
- [ ] Track daily Queue operations because Free includes 10,000 operations/day and each <=64 KB message normally costs write + read + delete operations.
- [ ] Alert/decision threshold: projected total account Queue operations >=8,000/day -> document upgrade/architecture decision before hitting the Free ceiling.
- [ ] Commit: `feat: add ride cpu and queue observability`.

### Task 11: Staging Load Test the Embedded PDFKit Queue Path

**Files:**
- Create: `scripts/bench/ride-queue-staging.ts`
- Update: `docs/operacion/RIDE-QUEUE-BASELINE.md`

- [ ] Deploy only staging with `rides-queue-staging`, `max_batch_size=1`.
- [ ] Exercise at least 150 jobs: 60 typical invoices, 20 invoices with ~40 lines, 10 with >=100 lines, 10 of each other document type.
- [ ] Include logo and QR variants because QR previously measured materially slower.
- [ ] Record Queue invocation `cpuTime` p50/p95/p99/max, wall duration, retry rate, DLQ, PDF bytes and page count.
- [ ] Verify zero `exceededCpu`/1102 and zero memory-limit outcomes.
- [ ] Embedded PDFKit hard gate: p95 CPU <500 ms, p99 <2 s, max <5 s, zero limit terminations, visual suite green.
- [ ] Optimization target, not hard safety gate: typical invoice p95 CPU <=100 ms and 100-line invoice <=300 ms.
- [ ] If the account behaves as `FREE_QUEUE_LONG_CPU_PROVEN` and hard gates pass, embedded is safe enough to remain the default while optimization experiments continue.
- [ ] If Queue CPU behaves like 10 ms or any hard gate fails, mark embedded PDFKit `NOT_FREE_SAFE` and continue to optimization/remote tracks.
- [ ] Commit only scripts and sanitized aggregate evidence, never raw customer fixtures/logs.

### Task 12: Decouple `generador-ride` Layout From PDFKit Mechanically

**Repository:** `~/code/javascript/generador-ride`

**Files:**
- Create: `src/pdf/contract.ts`
- Rename/refactor: current PDF document implementation -> `src/pdf/pdfkit-document.ts`
- Modify: `src/layout/*.ts`, `src/barcode/code128.ts`, `src/qr/qr-vector.ts`

- [ ] First write characterization tests for every PDF method currently used by layout.
- [ ] Define `RidePdfDocument` with only: page/margins, font/fontSize/colors, width/height measurement, text, rect/path/fill/stroke, save/restore, addPage, image and finalize.
- [ ] Preserve top-left coordinate semantics used by current layout; backend adapters translate internally when necessary.
- [ ] Implement PDFKit adapter with exactly current behavior before any new backend exists.
- [ ] Replace `PDFKit.PDFDocument` type references mechanically; do not change layout constants/arithmetic in this task.
- [ ] Run `bun run verify` and require all existing functional/Worker/visual/package gates green.
- [ ] If this refactor changes any golden, revert/fix before proceeding.
- [ ] Commit: `refactor: isolate ride pdf backend contract`.

### Task 13: Implement and Judge `pdf-lib` as Candidate Backend

**Repository:** `~/code/javascript/generador-ride`

- [ ] Pin the exact tested `pdf-lib` version; do not replace PDFKit production path yet.
- [ ] Implement standard Helvetica/Helvetica-Bold without `fontkit`.
- [ ] Implement coordinate translation, text alignment, character spacing, width/height measurements, pages, rectangles/lines and PNG/JPEG logos behind `RidePdfDocument`.
- [ ] Match wrapping and font metrics before comparing full documents.
- [ ] Run all six golden documents plus extreme/logo/QR variants.
- [ ] Reject candidate on any page-count difference, geometry >0.5 pt or pixel diff >0.1%.
- [ ] If visual gates pass, run Worker tests and benchmarks for 1/40/100-line invoice, guide, retention and QR.
- [ ] Record bundle gzip and real workerd timings. Earlier micro-spike was ~216 KiB gzip and ~2/4/14 ms for simple 1/40/100-line PDFs; treat that only as motivation, not acceptance evidence.
- [ ] Candidate stays unreachable from production exports until Task 15 selection.
- [ ] Commit only if it is either accepted or clearly isolated as experimental with tests.

### Task 14: Implement and Judge an Ultra-Light `MiniPdfDocument`

**Repository:** `~/code/javascript/generador-ride`

**Files:**
- Create: `src/pdf/mini-document.ts`
- Create: `src/pdf/standard-font-metrics.ts`
- Create image helpers only for formats required by current logo tests.
- Extend: `test/backend-parity.test.ts`

- [ ] Characterize PDFKit `widthOfString`/`heightOfString` for Helvetica and Helvetica-Bold at sizes 4–14 pt across all widths/layout strings used by the RIDE.
- [ ] Generate compact static font metric tables at development time; production must not read AFM files or use `fs`.
- [ ] Require width error <=0.01 pt and wrapped-height error <=0.05 pt on the characterization corpus before rendering golden PDFs.
- [ ] Implement only PDF 1.4 objects/xref, Type1 fonts, text operators, rectangles/paths, colors, save/restore, pages and the exact logo subset needed.
- [ ] Preserve Code128 and QR as vector operations from existing layout; do not reimplement their data algorithms.
- [ ] Do not add forms, arbitrary fonts, SVG, encryption, annotations or other general-PDF features.
- [ ] Run complete semantic/geometric/pixel suite. One visual failure rejects Mini for production.
- [ ] If green, benchmark all six documents + 1/40/100 detail invoices + QR + logo in Bun and workerd.
- [ ] Optimization targets: typical RIDE <=10 ms local/workerd wall target, 100-line <=30 ms, Worker contribution <=150 KiB gzip; visual parity remains mandatory even if targets are exceeded.
- [ ] Earlier manual writer numbers (~0.2–2.5 ms) are proof that tiny PDF generation is possible, not proof that Mini already matches the approved RIDE.

### Task 15: Select the Production PDF Backend With a Non-Negotiable Visual Gate

**Files:**
- Create: `~/code/javascript/generador-ride/docs/backend-decision-2026-09-04.md`
- Modify production backend factory/dependencies only after selection.

- [ ] Produce a matrix for PDFKit, pdf-lib and Mini: visual pass, pages, max geometry diff, pixel diff, Worker runtime, p50/p95 CPU/wall, 100-line timing, QR/logo support, gzip size.
- [ ] Discard every backend that fails one semantic or visual requirement.
- [ ] Among survivors choose the lowest real Worker CPU; use size/simplicity only as tie-breaker when CPU difference is <10%.
- [ ] If only PDFKit survives, keep PDFKit and stop renderer rewriting; queue isolation already solves separation.
- [ ] Remove unreachable rejected production dependencies from final package.
- [ ] Run `bun run verify`, `bun run benchmark`, `bun run check:bundle`, package-consumer tests and Worker tests with the selected backend.
- [ ] Pin the selected `generador-ride` SHA back into `facturador` and rerun Task 9 visual integration.
- [ ] Commit: `perf: select verified ride pdf backend`.

### Task 16: Re-measure the Selected Embedded Backend in Real Staging

**Repository:** `~/code/javascript/facturador`

- [ ] Update the immutable dependency SHA and install cleanly.
- [ ] Re-run full local functional and visual integration tests.
- [ ] Dry-run both top-level and staging Wrangler configs and record bundle size.
- [ ] Repeat the 150-job staging sample from Task 11 with the selected backend.
- [ ] Record actual Queue invocation `cpuTime` p50/p95/p99/max and `exceededCpu` outcomes.
- [ ] Record overall account Queue operations/day and estimate documents/day at current message/retry pattern.
- [ ] Mark `EMBEDDED_FREE_ACCEPTED=true` only when Task 1 proved the runtime model, zero CPU/memory terminations occur, visual gates are green and queue operation budget remains sustainable.
- [ ] If accepted, embedded remains the production default; still finish remote fallback implementation as dormant disaster/scale capability.
- [ ] If not accepted, do not deploy embedded production RIDE; activate Tasks 17–20 and choose `remote`.

### Task 17: Build One Stateless RIDE Service Image for Private Server and Cloud Run

**Repository:** `~/code/javascript/generador-ride`

**Files:**
- Create: `service/src/server.ts`, `service/src/auth.ts`, `service/src/schema.ts`
- Create: `service/test/server.test.ts`
- Create: `service/Dockerfile`, `service/.dockerignore`, `service/package.json`

- [ ] Use Bun native HTTP server and the same selected `generador-ride` package code; no duplicate layout implementation.
- [ ] Implement `GET /healthz` and `POST /v1/render -> application/pdf`.
- [ ] Accept max 1 MiB request body and the normalized `SolicitudRenderRide` payload.
- [ ] Authenticate render calls using timestamp + body SHA-256 + HMAC-SHA256 shared secret with 60 s skew.
- [ ] Use constant-time signature comparison and verify auth before parsing fiscal JSON.
- [ ] Map errors deterministically: 400 malformed, 401 auth, 413 too large, 422 invalid/unsupported document, 500 renderer defect.
- [ ] Return `x-ride-renderer-version` containing package version + git SHA.
- [ ] Never persist R2, query SRI, send email or log fiscal payloads in this service.
- [ ] Build as non-root container and prove direct library vs service output passes the same visual gate.
- [ ] Load test 100 sequential + 20 concurrent renders; record p50/p95 and RSS.
- [ ] Commit: `feat: add stateless ride renderer service`.

### Task 18: Deploy the Primary Renderer on the Private Server via Cloudflare Tunnel

**Files in `generador-ride`:**
- Create: `deploy/private/docker-compose.yml`
- Create: `deploy/private/README.md`

- [ ] Build one release image from the selected SHA and push it to Artifact Registry; record the immutable image digest.
- [ ] Configure private server to pull that exact digest, not a mutable tag.
- [ ] Bind container only to `127.0.0.1:18080:8080`; do not expose port 18080 on WAN/router/firewall.
- [ ] Set `restart: unless-stopped`, healthcheck `/healthz`, read-only filesystem where practical, non-root user and resource limits validated by load test.
- [ ] Start with 256 MiB memory hard limit and one CPU-equivalent ceiling if supported; raise only if measured RSS proves necessary.
- [ ] Store `RIDE_SHARED_SECRET` in a root/service-readable environment file outside git.
- [ ] Configure a dedicated Cloudflare Tunnel hostname -> `http://127.0.0.1:18080`.
- [ ] Verify unsigned `/v1/render` -> 401, signed render -> 200 PDF, direct origin port from Internet -> unreachable.
- [ ] Stop the renderer container while cloudflared remains up; document the HTTP/network failure observed by an external caller because that condition must trigger Cloud Run fallback.
- [ ] Restart and prove automatic recovery without changing `facturador`.
- [ ] Run 100 signed renders from staging Worker to private endpoint and record network p50/p95 plus server render p50/p95.
- [ ] Document pull-by-digest, health, logs, restart and rollback commands.

### Task 19: Deploy the Exact Same Image Digest to Cloud Run

**Files:**
- Create: `deploy/cloud-run/deploy.sh`
- Create: `deploy/cloud-run/README.md`

- [ ] Use the same Artifact Registry digest already running on private server.
- [ ] Initial service config: region chosen explicitly, 1 vCPU, 256 MiB memory, request timeout 15 s, concurrency 4, `min-instances=0`, `max-instances=3`.
- [ ] Put `RIDE_SHARED_SECRET` in Secret Manager and inject it; never commit or place it in command history arguments when avoidable.
- [ ] Expose HTTPS because the caller is Cloudflare, but require HMAC on every render request.
- [ ] Verify cold-start and warm-start separately.
- [ ] Run all six documents through Cloud Run and require the same visual parity as direct library/private container.
- [ ] Increase memory/concurrency only from measured RSS/latency data; fallback correctness is more important than peak throughput.
- [ ] Save Cloud Run revision + image digest in sanitized deployment evidence.
- [ ] Test rollback by redeploying the previous known-good digest in staging, then return to current digest.

### Task 20: Add `RemoteRideRenderer` With Private -> Cloud Run Failover

**Files:**
- Create: `src/infraestructura/ride/remote-renderer.ts`
- Create: `src/infraestructura/ride/remote-renderer.test.ts`
- Modify: `src/infraestructura/workers/env.ts`
- Modify: `src/composicion/workers.ts`

- [ ] Add `RIDE_RENDER_MODE=embedded|remote`, `RIDE_PRIMARY_URL`, `RIDE_FALLBACK_URL`; keep `RIDE_SHARED_SECRET` as Worker secret.
- [ ] Serialize request exactly once to bytes; compute body SHA-256 and HMAC over those exact bytes.
- [ ] Primary private request timeout: 1,500 ms.
- [ ] Fallback only for network errors, timeout, 429, 502, 503 or 504.
- [ ] Do not fallback for 400/401/413/422; request is invalid.
- [ ] Do not mask HTTP 500 by automatically trying the same image elsewhere; surface renderer defect for Queue retry/DLQ and investigation.
- [ ] Cloud Run fallback timeout: 15,000 ms.
- [ ] Require response `Content-Type: application/pdf`, `%PDF-`, `%%EOF` and renderer-version header before returning bytes.
- [ ] Observability records `private` or `cloud-run` and `fallbackUsed`, never the secret URL.
- [ ] Tests: private 200; private timeout -> fallback 200; private 503 -> fallback 200; private 422 -> no fallback; private 500 -> no fallback; both unavailable -> transient error.
- [ ] Prove private and Cloud Run outputs for the same fixture pass identical visual gates.
- [ ] `crearDependenciasWorkers()` defaults to embedded unless evidence/production config explicitly selects remote.
- [ ] Commit: `feat: add private cloud-run ride failover`.

### Task 21: Prove End-to-End Failover Through `rides-queue`

- [ ] In staging set `RIDE_RENDER_MODE=remote` with private Tunnel primary and Cloud Run fallback.
- [ ] Both healthy: send 20 jobs; all persist R2 and report primary/private success.
- [ ] Stop private container: send 20 jobs; all persist R2 using Cloud Run fallback.
- [ ] Restore private container: new jobs return to private automatically without Worker redeploy.
- [ ] Stop private and disable Cloud Run: job retries; no RIDE -> no email delivery.
- [ ] Restore one renderer: retried message produces exactly one immutable `ride.pdf` and one logical email delivery.
- [ ] Simulate crash after R2 persistence but before queue ack; retry must skip rerender and not duplicate mail.
- [ ] Compare R2 PDF produced before/during failover semantically/geometrically/pixel-wise.
- [ ] Record Queue CPU while waiting on remote I/O to verify network wait does not become CPU consumption.
- [ ] Save sanitized evidence to `docs/operacion/RIDE-RENDERER-FAILOVER.md`.

### Task 22: Production Architecture Gate

**Files:**
- Complete: `docs/operacion/RIDE-QUEUE-BASELINE.md`
- Complete: `docs/operacion/RIDE-RENDERER-FAILOVER.md`

- [ ] Choose `embedded` only if: Queue CPU behavior is empirically proven on the actual Free account; visual tests are 100% green; zero CPU/memory-limit terminations; p95 CPU <500 ms; p99 <2 s; max <5 s; Worker gzip <3 MiB; projected Queue operations <8,000/day.
- [ ] If selected backend can actually meet a 10 ms Free Queue ceiling and Task 1 shows such a ceiling, require real p99 CPU <8 ms to leave safety margin; local wall-clock alone is insufficient.
- [ ] Choose `remote` if any hard embedded criterion fails or account behavior remains ambiguous.
- [ ] Remote production order is always: private server/Tunnel primary -> Cloud Run fallback.
- [ ] Never deploy private-only remote mode without Cloud Run ready and tested.
- [ ] Keep `max_batch_size=1` for at least seven days of production evidence.
- [ ] Do not increase batch size merely to reduce Queue operations: operations are counted per message, not per batch.
- [ ] If backlog grows, tune concurrency before batch size; preserve one-RIDE-per-invocation isolation initially.
- [ ] Record the chosen mode, exact `generador-ride` SHA, backend, Worker version, image digest (if remote), and rollback target.

### Task 23: Production Rollout, Recovery and Future Paid Migration

**Files:**
- Create/update: `docs/operacion/RIDE-RUNBOOK.md`
- Create: `docs/operacion/RIDE-SERVICE-BINDING-MIGRATION.md`

- [ ] Roll out staging -> limited production -> full production; do not jump directly from local to all traffic.
- [ ] Verify a real authorized document reaches R2 and email with the approved visual RIDE before widening rollout.
- [ ] Monitor for seven days: CPU p95/p99, retries, DLQ, oldest message age, queue operations, email lag and renderer selection.
- [ ] Runbook must cover replay from DLQ, R2 already-exists idempotency, renderer rollback, private server restart, Tunnel status and Cloud Run fallback verification.
- [ ] Rollback embedded -> remote is a configuration/composition change; rollback remote image is by immutable digest.
- [ ] When moving to Workers Paid later, evaluate a separate `ride-renderer` Worker behind Service Binding using the same `RideRenderer` request contract and visual suite.
- [ ] Do not delete private/Cloud Run fallback until the Service Binding path has equivalent production evidence.
- [ ] Commit: `docs: finalize ride queue operations and migration runbook`.## Exact Execution Order

1. Tasks 0–1: establish baseline and prove the real Free Queue CPU behavior.
2. Tasks 2–9: implement dedicated queue, canonical renderer integration, idempotency and visual parity.
3. Tasks 10–11: measure embedded PDFKit in real staging.
4. Tasks 12–15: optimize backend while preserving the exact visuals.
5. Task 16: measure the selected backend again in staging.
6. Tasks 17–21: build and prove dormant/active remote path with private primary + Cloud Run fallback.
7. Task 22: choose production mode from evidence.
8. Task 23: controlled rollout, monitoring, recovery and future Service Binding plan.

## Definition of Done

The implementation is complete only when all statements below are true:

- `facturas-queue` never renders a PDF inline after SRI authorization.
- `rides-queue` exists in production and staging and starts at `max_batch_size=1`.
- `AUTHORIZED` RIDE messages bypass the old terminal-state guard correctly.
- The PDF stored in R2 and sent by email is produced through the real pinned `generador-ride` renderer.
- All six SRI document types pass full facturador->renderer semantic, page, geometry and pixel parity.
- A retry after PDF persistence does not render again or duplicate email delivery.
- RIDE failure never reverts `AUTHORIZED` and never sends email without a valid PDF.
- Actual Free Queue CPU behavior has direct account evidence.
- Embedded mode has real CPU p50/p95/p99/max evidence; no claim is based only on local wall-clock.
- PDFKit/pdf-lib/Mini selection is documented and every rejected backend failed for explicit evidence, never intuition.
- Private server and Cloud Run run the same immutable image digest when remote mode is exercised.
- Automatic private->Cloud Run failover is proven through the actual `rides-queue` flow.
- No observability output contains fiscal/customer PII.
- Queue operations/day are measured against the Free allowance.
- Rollback and DLQ recovery have been tested, not merely documented.

## Execution Handoff

The local implementing agent must first read this plan and `docs/superpowers/specs/2026-09-04-ride-rendering-runtime-strategy.md`, then the existing `generador-ride` design/implementation plans. Use `superpowers:using-git-worktrees`, TDD, `superpowers:subagent-driven-development` and `superpowers:verification-before-completion`.

Do not mark a task complete because it compiles. Each task must finish its listed tests and acceptance gate. A rejected optimized PDF backend is a successful experimental result if the visual gate rejects it; do not weaken the visual gate to make an optimization pass.