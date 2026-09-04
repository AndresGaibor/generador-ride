import { describe, expect, it } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('Worker runtime: generador-ride package', () => {
  async function fetchPdf(query = '') {
    const res = await SELF.fetch(`http://test.internal/ride${query ? `?${query}` : ''}`);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('latin1').decode(bytes);
    return { res, bytes, text };
  }

  describe('default factura (tipo=01)', () => {
    it('returns 200', async () => {
      const { res } = await fetchPdf('tipo=01');
      expect(res.status).toBe(200);
    });

    it('Content-Type is application/pdf', async () => {
      const { res } = await fetchPdf('tipo=01');
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('body starts with %PDF-', async () => {
      const { text } = await fetchPdf('tipo=01');
      expect(text.startsWith('%PDF-')).toBe(true);
    });

    it('body ends with %%EOF', async () => {
      const { text } = await fetchPdf('tipo=01');
      expect(text).toContain('%%EOF');
    });

    it('body is non-empty', async () => {
      const { bytes } = await fetchPdf('tipo=01');
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('six dispatch types', () => {
    it('tipo=01 factura', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=01');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('tipo=03 liquidacion-compra', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=03');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('tipo=04 nota-credito', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=04');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('tipo=05 nota-debito', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=05');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('tipo=06 guia-remision', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=06');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('tipo=07 retencion', async () => {
      const { res, text, bytes } = await fetchPdf('tipo=07');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('%%EOF');
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('logo', () => {
    it('logo=true produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01&logo=true');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('logo=false produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01&logo=false');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('logo=true and logo=false produce different sizes (logo embedded)', async () => {
      const { bytes: withLogo } = await fetchPdf('tipo=01&logo=true');
      const { bytes: noLogo } = await fetchPdf('tipo=01&logo=false');
      expect(withLogo.length).not.toBe(noLogo.length);
    });
  });

  it('default PDF contains structural markers', async () => {
    const { text } = await fetchPdf('tipo=01');
    expect(text).toContain('/Catalog');
    expect(text).toContain('/Pages');
    expect(text).toContain('startxref');
  });

  describe('QR code', () => {
    it('qr=true produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01&qr=true');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('qr=false produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01&qr=false');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('qr=true and qr=false produce different sizes (QR block absent)', async () => {
      const { bytes: withQR } = await fetchPdf('tipo=01&qr=true');
      const { bytes: noQR } = await fetchPdf('tipo=01&qr=false');
      expect(withQR.length).not.toBe(noQR.length);
    });
  });

  describe('autorizacion', () => {
    it('auth absent (default) produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('auth=true produces non-empty PDF', async () => {
      const { bytes } = await fetchPdf('tipo=01&auth=true');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('auth=true and auth absent produce different sizes (auth block present)', async () => {
      const { bytes: withAuth } = await fetchPdf('tipo=01&auth=true');
      const { bytes: noAuth } = await fetchPdf('tipo=01&auth=false');
      expect(withAuth.length).not.toBe(noAuth.length);
    });
  });
});
