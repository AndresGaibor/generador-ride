#!/usr/bin/env bun
/**
 * Genera los PDFs de referencia v0.3.0 del RIDE (sri-ec/ride).
 *
 *用法:
 *   bun run scripts/generate-reference.mjs
 *
 * Requisitos:
 *   - ../teran-sri-ec-node debe estar en commit f6d878df965af8655b89890c7e2098c0ba92d5eb
 *   - El paquete sri-ec debe estar construido (bun run build --workspaces)
 *   - pdfkit y qrcode deben estar instalados en el sibling
 *
 * Salida:
 *   test/reference/v0.3.0/
 *   ├── factura.pdf
 *   ├── liquidacion-compra.pdf
 *   ├── nota-credito.pdf
 *   ├── nota-debito.pdf
 *   ├── guia-remision.pdf
 *   ├── retencion.pdf
 *   └── README.md  (hashes SHA-256 de cada PDF)
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SIBLING = join(ROOT, '..', 'teran-sri-ec-node');
const SIBLING_COMMIT = 'f6d878df965af8655b89890c7e2098c0ba92d5eb';
const FIXTURES_DIR = join(ROOT, 'test', 'fixtures', 'reference');
const OUTPUT_DIR = join(ROOT, 'test', 'reference', 'v0.3.0');

const DOCUMENTOS = [
  'factura',
  'liquidacion-compra',
  'nota-credito',
  'nota-debito',
  'guia-remision',
  'retencion',
];

function gitRevParse(repo, ref) {
  return execSync(`git rev-parse ${ref}`, { cwd: repo }).toString().trim();
}

function verificarCommit() {
  const actual = gitRevParse(SIBLING, 'HEAD');
  if (actual !== SIBLING_COMMIT) {
    console.error(
      `ERROR: ../teran-sri-ec-node esta en commit ${actual}, se requiere ${SIBLING_COMMIT}`,
    );
    process.exit(1);
  }
  console.log(`✓ Commit verificado: ${SIBLING_COMMIT}`);
}

async function main() {
  console.log('Generando referencias RIDE v0.3.0...\n');

  verificarCommit();

  const SIBLING_RIDE_DIST = join(
    SIBLING,
    'packages',
    'sri-ec',
    'dist',
    'ride',
    'index.js',
  );

  let sriEcRide;
  try {
    sriEcRide = await import(`file://${SIBLING_RIDE_DIST}`);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      console.error(
        `ERROR: No se pudo importar ${SIBLING_RIDE_DIST}. ` +
        'Asegurate de que el sibling este construido (bun run build --workspaces) ' +
        'y de que pdfkit y qrcode esten instalados.',
      );
      process.exit(1);
    }
    throw err;
  }

  const { generarRide } = sriEcRide;

  const hashes = {};
  const AUTH_DATE = '03/08/2026 10:00:00';

  for (const nombre of DOCUMENTOS) {
    const fixturePath = join(FIXTURES_DIR, `${nombre}.json`);
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

    const claveAcceso = fixture.infoTributaria.claveAcceso;
    const autorizacion = { numero: claveAcceso, fecha: AUTH_DATE };

    const variantes = [
      { label: '', opts: {} },
      { label: '-qr', opts: { opciones: { incluirQr: true } } },
      { label: '-letter', opts: { opciones: { tamano: 'LETTER' } } },
      { label: '-letter-qr', opts: { opciones: { tamano: 'LETTER', incluirQr: true } } },
      { label: '-no-auth', opts: { autorizacion: undefined } },
    ];

    for (const variante of variantes) {
      const nombreArchivo = `${nombre}${variante.label}.pdf`;
      const salidaPdf = join(OUTPUT_DIR, nombreArchivo);

      const opcionesRide = {
        documento: fixture,
        claveAcceso,
        autorizacion: variante.opts.autorizacion ?? autorizacion,
        ...variante.opts,
      };

      const pdfBytes = await generarRide(opcionesRide);
      const { writeFileSync, mkdirSync } = await import('node:fs');
      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(salidaPdf, pdfBytes);

      const sha256 = createHash('sha256').update(pdfBytes).digest('hex');
      hashes[nombreArchivo] = sha256;

      const header = pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46;
      console.log(`${header ? '✓' : '✗'} ${nombreArchivo} (${(pdfBytes.length / 1024).toFixed(1)} KB) SHA-256: ${sha256}`);
    }
  }

  const readme = `# Referencias RIDE v0.3.0

Commit fuente: \`${SIBLING_COMMIT}\`
Fecha de autorizacion: \`${AUTH_DATE}\`

## Archivos

| Archivo | SHA-256 |
|---------|---------|
${Object.entries(hashes).map(([f, h]) => `| ${f} | \`${h}\` |`).join('\n')}

## Variantes

Cada documento base se genera en las siguientes variantes:

- \`<nombre>.pdf\` — A4, sin logo, sin QR, con autorizacion
- \`<nombre>-qr.pdf\` — A4, sin logo, CON QR, con autorizacion
- \`<nombre>-letter.pdf\` — LETTER, sin logo, sin QR, con autorizacion
- \`<nombre>-letter-qr.pdf\` — LETTER, sin logo, CON QR, con autorizacion
- \`<nombre>-no-auth.pdf\` — A4, sin logo, sin QR, SIN autorizacion
`;

  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUTPUT_DIR, 'README.md'), readme);
  console.log('\n✓ README.md actualizado');
  console.log('\nGeneracion completada.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
