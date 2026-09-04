import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfTextContent {
  text: string;
  items: TextItem[];
  numPages: number;
}

export async function extractTextFromPdf(pdfData: Uint8Array): Promise<PdfTextContent> {
  const data = pdfData instanceof Buffer ? new Uint8Array(pdfData) : pdfData;
  const doc = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const allItems: TextItem[] = [];
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    allItems.push(...(content.items as TextItem[]));
    fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
  }

  return { text: fullText.trim(), items: allItems, numPages: doc.numPages };
}

export function findText(content: PdfTextContent, search: string): boolean {
  return content.text.includes(search);
}
