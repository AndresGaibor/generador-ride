import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DOCKER_IMAGE = 'generador-ride-visual-test:latest';
export const DPI = 144;
export const THRESHOLD = 0.001;

export const QR_LADO_PT = 85;

export function dockerAvailable() {
  try {
    const r = spawnSync('docker', ['info'], { stdio: 'pipe' });
    return r.status === 0;
  } catch {
    return false;
  }
}

export function buildDockerImage() {
  const dockerfilePath = join(__dirname, 'Dockerfile');
  const r = spawnSync('docker', ['build', '-t', DOCKER_IMAGE, '-f', dockerfilePath, join(__dirname, '..', '..')], {
    stdio: 'inherit'
  });
  if (r.status !== 0) {
    throw new Error('Docker build failed');
  }
}

export function rasterizePdf(pdfPath, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const r = spawnSync('docker', ['run', '--rm',
    '-v', `${pdfPath}:/in.pdf`,
    '-v', `${outputDir}:/out`,
    DOCKER_IMAGE,
    '/in.pdf', '/out/page'
  ], { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error('pdftoppm via Docker failed');
  }
}

export function maskQrRegion(img1, img2, qrBounds) {
  const { x, y, width, height } = qrBounds;
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      const idx = (row * img1.width + col) * 4;
      img1.data[idx] = img1.data[idx + 1] = img1.data[idx + 2] = img1.data[idx + 3] = 0;
      img2.data[idx] = img2.data[idx + 1] = img2.data[idx + 2] = img2.data[idx + 3] = 0;
    }
  }
}

export function loadPng(path) {
  const data = readFileSync(path);
  return PNG.sync.read(data);
}

export function saveDiff(diffPath, diffImg, width, height) {
  const png = new PNG({ width, height });
  png.data.set(diffImg);
  mkdirSync(dirname(diffPath), { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(png));
}

export function comparePixels(img1, img2, width, height, threshold) {
  const diff = new Uint8Array(width * height * 4);
  const numDiffPixels = pixelmatch(img1.data, img2.data, diff, width, height, {
    threshold: 0.1,
    includeAA: false,
    alpha: 0.5,
  });
  const totalPixels = width * height;
  const mismatchRatio = numDiffPixels / totalPixels;
  const passed = mismatchRatio <= threshold;
  return { numDiffPixels, mismatchRatio, diff, passed, threshold };
}

export function qrLocationFromLayout(pageWidth, pageHeight) {
  const scale = DPI / 72;
  const qrSizePx = Math.floor(QR_LADO_PT * scale);
  const xOffset = Math.floor(pageWidth * 0.55 * scale);
  const yOffset = Math.floor(pageHeight * 0.08 * scale);
  return { x: xOffset, y: yOffset, width: qrSizePx, height: qrSizePx };
}

export async function comparePageImages(img1Path, img2Path, qrBounds, diffPath) {
  const img1 = loadPng(img1Path);
  const img2 = loadPng(img2Path);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return {
      dockerUsed: true,
      mismatchRatio: 1,
      numDiffPixels: -1,
      passed: false,
      reason: `dimension_mismatch: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`
    };
  }

  const width = img1.width;
  const height = img1.height;

  if (qrBounds) {
    maskQrRegion(img1, img2, qrBounds);
  }

  const result = comparePixels(img1, img2, width, height, THRESHOLD);

  if (!result.passed) {
    saveDiff(diffPath, result.diff, width, height);
  }

  return { ...result, dockerUsed: true, diffPath: result.passed ? null : diffPath };
}

export function cleanupDir(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
