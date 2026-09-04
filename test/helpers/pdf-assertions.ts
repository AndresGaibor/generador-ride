import type { ItemTexto, PaginaPdf, RectPdf } from '../pdf-analysis.js';

export function esperarRectangulosSanos(paginas: PaginaPdf[]): void {
  for (const pagina of paginas) {
    for (const rect of pagina.rects) {
      expect(rect.alto, `pág ${pagina.numero}: rectángulo de alto no positivo ${JSON.stringify(rect)}`).toBeGreaterThan(0);
      expect(rect.ancho, `pág ${pagina.numero}: rectángulo de ancho no positivo ${JSON.stringify(rect)}`).toBeGreaterThan(0);
      expect(rect.y, `pág ${pagina.numero}: rectángulo por encima del papel ${JSON.stringify(rect)}`).toBeGreaterThan(-0.5);
      expect(rect.y + rect.alto, `pág ${pagina.numero}: rectángulo que se sale del papel ${JSON.stringify(rect)}`).toBeLessThanOrEqual(pagina.alto + 0.5);
    }
  }
}

const IMPORTE = /^-?\d+\.\d{2}$/;

export function esperarEtiquetasConSuImporte(paginas: PaginaPdf[], etiquetas: string[]): void {
  for (const pagina of paginas) {
    for (const item of pagina.items) {
      if (!etiquetas.includes(item.texto.trim())) continue;
      const acompanante = pagina.items.find(
        (otro) => otro !== item && Math.abs(otro.y - item.y) < 1 && IMPORTE.test(otro.texto.trim()),
      );
      expect(
        acompanante,
        `pág ${pagina.numero}: "${item.texto}" quedó sin su importe (y=${item.y})`,
      ).toBeDefined();
    }
  }
}

export function tieneBordeAlrededor(pagina: PaginaPdf, x: number, y: number): boolean {
  return pagina.rects.some(
    (rect) => rect.x <= x && x <= rect.x + rect.ancho && rect.y <= y && y <= rect.y + rect.alto,
  );
}

export function cajaDe(paginas: PaginaPdf[], fragmento: string): RectPdf {
  const encontrado = localizar(paginas, fragmento);
  expect(encontrado, `no se encontró "${fragmento}" en el PDF`).toBeDefined();
  const { pagina, item } = encontrado!;
  const contenedoras = pagina.rects.filter(
    (r) => r.x <= item.x && item.x <= r.x + r.ancho && r.y <= item.y && item.y <= r.y + r.alto,
  );
  expect(contenedoras.length, `"${fragmento}" no está dentro de ninguna caja con borde`).toBeGreaterThan(0);
  return contenedoras.reduce((menor, r) => (r.ancho * r.alto < menor.ancho * menor.alto ? r : menor));
}

export function localizar(paginas: PaginaPdf[], fragmento: string): { pagina: PaginaPdf; item: ItemTexto } | undefined {
  for (const pagina of paginas) {
    const item = pagina.items.find((i) => i.texto.includes(fragmento));
    if (item) return { pagina, item };
  }
  return undefined;
}
