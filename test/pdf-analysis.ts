import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ItemTexto {
  texto: string;
  x: number;
  y: number;
}

export interface RectPdf {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface PaginaPdf {
  numero: number;
  ancho: number;
  alto: number;
  items: ItemTexto[];
  rects: RectPdf[];
  texto: string;
}

export async function analizarPdf(pdfBytes: Uint8Array): Promise<PaginaPdf[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjsLib;
  const documento = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const paginas: PaginaPdf[] = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const [, , ancho, alto] = pagina.view;

    const contenido = await pagina.getTextContent();
    const items: ItemTexto[] = [];
    for (const item of contenido.items) {
      if (!('str' in item)) continue;
      const transform = (item as { transform: number[] }).transform;
      items.push({ texto: item.str, x: transform[4], y: alto - transform[5] });
    }

    const rects: RectPdf[] = [];
    const ops = await pagina.getOperatorList();
    for (let k = 0; k < ops.fnArray.length; k++) {
      if (ops.fnArray[k] !== OPS.constructPath) continue;
      const [subOps, coords] = ops.argsArray[k] as [number[], number[]];
      let c = 0;
      for (const op of subOps) {
        if (op === OPS.rectangle) {
          rects.push({ x: coords[c], y: coords[c + 1], ancho: coords[c + 2], alto: coords[c + 3] });
          c += 4;
        } else if (op === OPS.moveTo || op === OPS.lineTo) {
          c += 2;
        } else if (op === OPS.curveTo) {
          c += 6;
        }
      }
    }

    paginas.push({
      numero: i,
      ancho,
      alto,
      items,
      rects,
      texto: items.map((item) => item.texto).join(' '),
    });
  }
  return paginas;
}
