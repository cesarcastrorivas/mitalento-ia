/**
 * Copy the pdf.js worker from pdfjs-dist into /public so Next.js serves it
 * as a static asset at /pdf.worker.min.mjs. PdfReader.tsx points
 * pdfjs.GlobalWorkerOptions.workerSrc to that path.
 *
 * Servir el worker como asset same-origin evita problemas con Turbopack
 * y mantiene el CSP simple (worker-src 'self').
 */
const fs = require('fs');
const path = require('path');

const SOURCES = [
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  'node_modules/pdfjs-dist/build/pdf.worker.mjs',
];

const destDir = path.join(__dirname, '..', 'public');
const destPath = path.join(destDir, 'pdf.worker.min.mjs');

let srcPath = null;
for (const candidate of SOURCES) {
  const full = path.join(__dirname, '..', candidate);
  if (fs.existsSync(full)) {
    srcPath = full;
    break;
  }
}

if (!srcPath) {
  console.log('[copy-pdfjs-worker] pdfjs-dist not found in node_modules, skipping.');
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(destPath)) {
  const srcStat = fs.statSync(srcPath);
  const destStat = fs.statSync(destPath);
  if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
    console.log('[copy-pdfjs-worker] Worker already up to date.');
    process.exit(0);
  }
}

fs.copyFileSync(srcPath, destPath);
console.log(`[copy-pdfjs-worker] Copied ${path.relative(path.join(__dirname, '..'), srcPath)} -> public/pdf.worker.min.mjs`);
