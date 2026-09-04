import { describe, expect, test } from 'vitest';
import PDFKit from 'pdfkit';
import { crearDocumentoRide } from '../src/pdf/document.js';

describe('crearDocumentoRide', () => {
  test('creates A4 document with PDF header', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.font('Helvetica').text('Hello World', 36, 36);
    const buffer = await finalizar();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  test('A4 document has correct page dimensions (595.28 x 841.89)', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.font('Helvetica').text('Test', 36, 36);
    const buffer = await finalizar();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const content = String.fromCharCode(...bytes);
    expect(content).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  test('document produces extractable text', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.font('Helvetica').text('Test Content', 36, 36);
    const buffer = await finalizar();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const content = String.fromCharCode(...bytes);
    expect(content).toContain('/BaseFont /Helvetica');
    expect(content).toContain('/Type /Font');
  });

  test('multiple pages - no content loss without bufferPages', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    for (let i = 1; i <= 5; i++) {
      doc.font('Helvetica').text(`Page ${i} content`, 36, 36);
      if (i < 5) doc.addPage();
    }
    const buffer = await finalizar();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const content = String.fromCharCode(...bytes);
    expect(content).toMatch(/\/Count 5/);
  });

  test('finalizar returns a Uint8Array with PDF bytes', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.font('Helvetica').text('Test', 36, 36);
    const result = await finalizar();
    expect(result).toBeInstanceOf(Uint8Array);
    const bytes = result;
    expect(bytes.length).toBeGreaterThan(0);
    const header = '%' + String.fromCharCode(bytes[1], bytes[2], bytes[3], bytes[4]);
    expect(header).toBe('%PDF-');
    expect(result.byteLength).toBe(bytes.length);
  });

  test('rejects on stream error', async () => {
    const { doc, finalizar } = await crearDocumentoRide('A4');
    doc.font('Helvetica');
    doc.emit('error', new Error('Stream error'));
    await expect(finalizar()).rejects.toThrow('Stream error');
  });
});

describe('LETTER size', () => {
  test('LETTER document has correct dimensions', async () => {
    const { doc, finalizar } = await crearDocumentoRide('LETTER');
    doc.font('Helvetica').text('Test', 36, 36);
    const buffer = await finalizar();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const content = String.fromCharCode(...bytes);
    expect(content).toContain('/MediaBox [0 0 612 792]');
  });
});
