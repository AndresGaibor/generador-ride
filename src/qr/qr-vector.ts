import { create } from 'qrcode/lib/core/qrcode.js';

export interface QrMatrix {
  size: number;
  version: number;
  maskPattern: number;
  get(row: number, col: number): boolean;
}

export interface QrDrawOptions {
  x: number;
  y: number;
  size: number;
}

export async function crearQrMatrix(texto: string): Promise<QrMatrix> {
  const qrData = create(texto, { errorCorrectionLevel: 'M' });
  const size = qrData.modules.size;

  return {
    size,
    version: qrData.version,
    maskPattern: qrData.maskPattern ?? 0,
    get(row: number, col: number): boolean {
      if (row < 0 || row >= size || col < 0 || col >= size) {
        return false;
      }
      return qrData.modules.get(row, col) === 1;
    },
  };
}

export function dibujarQr(doc: PDFKit.PDFDocument, matrix: QrMatrix, opts: QrDrawOptions): void {
  const moduleSize = opts.size / (matrix.size + 4);
  const quietZone = moduleSize * 2;

  doc.save().fillColor('#ffffff');
  doc.rect(opts.x, opts.y, opts.size, opts.size).fill();
  doc.restore();

  doc.save().fillColor('#000000');
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.get(row, col)) {
        const x = opts.x + quietZone + col * moduleSize;
        const y = opts.y + quietZone + row * moduleSize;
        doc.rect(x, y, moduleSize, moduleSize).fill();
      }
    }
  }
  doc.restore();
}
