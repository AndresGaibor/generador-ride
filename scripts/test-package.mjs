import { strict as assert } from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'generador-ride-package-'));
const consumer = join(temp, 'consumer');
const archive = join(temp, 'generador-ride-0.1.0.tgz');
const fixture = fileURLToPath(new URL('../test/package-consumer/worker.ts', import.meta.url));
let wrangler;

function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
}

try {
  run('bun', ['run', 'build']);
  run('bun', ['pm', 'pack', '--destination', temp]);

  const listing = run('tar', ['-tzf', archive]).split('\n').filter(Boolean).map((entry) => entry.replace(/^package\//, ''));
  const forbidden = /(^|\/)(test|tests|fixtures?|visual|worker|reference|__tests?__)(\/|$)|\.pdf$|\.png$|\.woff2?$|\.ttf$|\.otf$/i;
  const allowed = (entry) => entry === 'package.json' || entry === 'README.md' || entry === 'LICENSE' || entry.startsWith('dist/');
  const invalid = listing.filter((entry) => !allowed(entry) || forbidden.test(entry));
  assert.deepEqual(invalid, [], `contenido no permitido en el tarball: ${invalid.join(', ')}`);

  const packedPackage = JSON.parse(run('tar', ['-xOzf', archive, 'package/package.json']));
  for (const [name, value] of Object.entries(packedPackage.dependencies ?? {})) {
    assert(!/^(file:|link:|workspace:|\.\.?\/)/.test(value), `dependencia local publicada: ${name}=${value}`);
  }

  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), '{"name":"clean-consumer","private":true,"type":"module"}\n');
  await run('bun', ['add', archive], consumer);
  await cp(fileURLToPath(new URL('../test/package-consumer/smoke.mjs', import.meta.url)), join(consumer, 'smoke.mjs'));
  console.log(run('node', ['smoke.mjs'], consumer).trim());

  await cp(fixture, join(consumer, 'worker.ts'));
  await writeFile(join(consumer, 'wrangler.jsonc'), '{\n  "name": "generador-ride-package-consumer",\n  "main": "worker.ts",\n  "compatibility_date": "2026-09-03"\n}\n');
  run('bunx', ['wrangler', 'deploy', '--dry-run', '--config', 'wrangler.jsonc'], consumer);

  const port = 18765 + Math.floor(Math.random() * 1000);
  wrangler = spawn('bunx', ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--config', 'wrangler.jsonc'], {
    cwd: consumer, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 30000;
  let response;
  while (Date.now() < deadline) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert(response, 'Wrangler no inició el Worker local');
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert(text.startsWith('%PDF-') && text.includes('%%EOF') && bytes.length > 0, 'runtime Worker no generó un PDF válido');
  console.log(`Worker runtime OK (${bytes.length} bytes)`);
} finally {
  if (wrangler) {
    wrangler.kill('SIGTERM');
    await new Promise((resolve) => wrangler.once('exit', resolve));
  }
  await rm(temp, { recursive: true, force: true });
}
