#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
const OUTDIR = join(ROOT, '.tmp', 'worker-bundle');
const BUNDLE = join(OUTDIR, 'worker.js');
const BASELINE = { task: 'Task 10', gzipKiB: 515.65, source: 'Task 10 measured bundle, supplied in Task 11 requirements' };
const limit = Math.ceil(BASELINE.gzipKiB * 1024 * 1.10);

mkdirSync(OUTDIR, { recursive: true });
execFileSync('bun', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('bunx', ['wrangler', 'deploy', '--config', 'test/worker/wrangler.jsonc', '--dry-run', '--outdir', '.tmp/worker-bundle', '--outfile', '.tmp/worker-bundle/worker.js', '--metafile', '.tmp/worker-bundle/meta.json'], { cwd: ROOT, stdio: 'inherit' });
const files = [];
function visit(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) visit(path); else if (/\.m?js$/.test(name)) files.push(path); } }
visit(OUTDIR);
if (!files.length) throw new Error(`No se encontró JavaScript en ${OUTDIR}`);
const raw = files.reduce((sum, path) => sum + readFileSync(path).byteLength, 0);
const compressed = gzipSync(Buffer.concat(files.map((path) => readFileSync(path)))).byteLength;
const analysis = files.map((path) => readFileSync(path, 'utf8')).join('\n');
const findings = { afm: /AFMFont|STANDARD_FONTS/.test(analysis), fontkit: /fontkit/.test(analysis), qrPng: /node_modules\/qrcode\/lib\/renderer|image\/png/.test(analysis), serverRenderer: /renderer\/canvas|renderer\/svg/.test(analysis) };
console.log(JSON.stringify({ files, rawBytes: raw, gzipBytes: compressed, baseline: BASELINE, limitBytes: limit, findings }, null, 2));
if (compressed > limit) throw new Error(`Bundle gzip ${compressed} bytes supera el limite ${limit} bytes (baseline ${BASELINE.gzipKiB} KiB + 10%)`);
execFileSync('bunx', ['wrangler', 'check', 'startup', '--config', 'test/worker/wrangler.jsonc', '--worker', '.tmp/worker-bundle/worker.js'], { cwd: ROOT, stdio: 'inherit' });
