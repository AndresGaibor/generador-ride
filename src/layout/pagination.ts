export function limiteInferior(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

export function alturaUtilPagina(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
}

export function asegurarEspacio(doc: PDFKit.PDFDocument, y: number, alturaMinima: number): number {
  if (y + alturaMinima > limiteInferior(doc)) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}

export function partirTextoPorAltura(
  doc: PDFKit.PDFDocument,
  texto: string,
  ancho: number,
  altoMax: number,
): string[] {
  if (texto === '' || doc.heightOfString(texto, { width: ancho }) <= altoMax) {
    return [texto];
  }

  const trozos: string[] = [];
  let actual = '';
  for (const token of texto.split(/(\s+)/)) {
    const candidato = actual + token;
    if (actual.trim() !== '' && doc.heightOfString(candidato, { width: ancho }) > altoMax) {
      trozos.push(actual.replace(/\s+$/, ''));
      actual = token.replace(/^\s+/, '');
    } else {
      actual = candidato;
    }
  }
  if (actual.trim() !== '') {
    trozos.push(actual);
  }
  return trozos.length > 0 ? trozos : [texto];
}
