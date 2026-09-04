import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import type { TamanoPaginaRide } from '../types.js';

export async function crearDocumentoRide(
  tamano: TamanoPaginaRide
): Promise<{ doc: PDFKit.PDFDocument; finalizar(): Promise<Uint8Array> }> {
  const chunks: Uint8Array[] = [];

  const doc = new PDFDocument({
    size: tamano,
    margin: 36,
    autoFirstPage: true,
  });

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
  doc.on('error', (err: Error) => {
    rejectFn?.(err);
  });

  let rejectFn: (err: Error) => void;

  const finalizePromise = new Promise<Uint8Array>((resolve, reject) => {
    rejectFn = reject;
    doc.on('end', () => {
      const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(result);
    });
  });

  return {
    doc,
    finalizar() {
      doc.end();
      return finalizePromise;
    },
  };
}
