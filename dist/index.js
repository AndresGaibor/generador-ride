// src/errors.ts
var RideError = class _RideError extends Error {
  code;
  cause;
  constructor(message, code, options) {
    super(message);
    this.code = code;
    this.cause = options?.cause;
    this.name = "RideError";
    Object.setPrototypeOf(this, _RideError.prototype);
  }
};

// src/layout/pagination.ts
function limiteInferior(doc) {
  return doc.page.height - doc.page.margins.bottom;
}
function alturaUtilPagina(doc) {
  return doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
}
function asegurarEspacio(doc, y, alturaMinima) {
  if (y + alturaMinima > limiteInferior(doc)) {
    doc.addPage();
    return doc.page.margins.top;
  }
  return y;
}
function partirTextoPorAltura(doc, texto2, ancho, altoMax) {
  if (texto2 === "" || doc.heightOfString(texto2, { width: ancho }) <= altoMax) {
    return [texto2];
  }
  const trozos = [];
  let actual = "";
  for (const token of texto2.split(/(\s+)/)) {
    const candidato = actual + token;
    if (actual.trim() !== "" && doc.heightOfString(candidato, { width: ancho }) > altoMax) {
      trozos.push(actual.replace(/\s+$/, ""));
      actual = token.replace(/^\s+/, "");
    } else {
      actual = candidato;
    }
  }
  if (actual.trim() !== "") {
    trozos.push(actual);
  }
  return trozos.length > 0 ? trozos : [texto2];
}

// src/barcode/code128.ts
var PATRONES = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112"
];
var START_B = 104;
var START_C = 105;
var STOP = 106;
var CAMBIO_A_C = 99;
var MODULOS_ZONA_MUDA = 10;
function valoresCode128(texto2) {
  if (texto2 === "") {
    throw new RangeError("Code 128: el texto a codificar no puede estar vac\xEDo.");
  }
  if (/^\d+$/.test(texto2)) {
    const impar = texto2.length % 2 === 1;
    const valores2 = impar ? [START_B, texto2.charCodeAt(0) - 32, CAMBIO_A_C] : [START_C];
    for (let i = impar ? 1 : 0; i < texto2.length; i += 2) {
      valores2.push(Number(texto2.slice(i, i + 2)));
    }
    return valores2;
  }
  const valores = [START_B];
  for (const caracter of texto2) {
    const codigo = caracter.charCodeAt(0);
    if (codigo < 32 || codigo > 126) {
      throw new RangeError(`Code 128: car\xE1cter no representable en Code B: ${JSON.stringify(caracter)}.`);
    }
    valores.push(codigo - 32);
  }
  return valores;
}
function patronCode128(texto2) {
  const valores = valoresCode128(texto2);
  let suma = valores[0];
  for (let i = 1; i < valores.length; i++) {
    suma += i * valores[i];
  }
  valores.push(suma % 103, STOP);
  const modulos = [];
  for (const valor of valores) {
    for (const ancho of PATRONES[valor]) {
      modulos.push(Number(ancho));
    }
  }
  return modulos;
}
function dibujarCode128(doc, texto2, area) {
  const modulos = patronCode128(texto2);
  const anchoModulo = area.ancho / (modulos.reduce((a, b) => a + b, 0) + MODULOS_ZONA_MUDA * 2);
  doc.save().fillColor("#000000");
  let x = area.x + MODULOS_ZONA_MUDA * anchoModulo;
  for (let i = 0; i < modulos.length; i++) {
    const ancho = modulos[i] * anchoModulo;
    if (i % 2 === 0) {
      doc.rect(x, area.y, ancho, area.alto).fill();
    }
    x += ancho;
  }
  doc.restore();
}

// src/qr/qr-vector.ts
import { create } from "qrcode/lib/core/qrcode.js";
async function crearQrMatrix(texto2) {
  const qrData = create(texto2, { errorCorrectionLevel: "M" });
  const size = qrData.modules.size;
  return {
    size,
    version: qrData.version,
    maskPattern: qrData.maskPattern ?? 0,
    get(row, col) {
      if (row < 0 || row >= size || col < 0 || col >= size) {
        return false;
      }
      return qrData.modules.get(row, col) === 1;
    }
  };
}
function dibujarQr(doc, matrix, opts) {
  const moduleSize = opts.size / (matrix.size + 4);
  const quietZone = moduleSize * 2;
  doc.save().fillColor("#ffffff");
  doc.rect(opts.x, opts.y, opts.size, opts.size).fill();
  doc.restore();
  doc.save().fillColor("#000000");
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

// src/layout/constants.ts
var FUENTE_NORMAL = "Helvetica";
var FUENTE_NEGRITA = "Helvetica-Bold";
var TAMANO_TITULO = 9;
var TAMANO_TEXTO = 8;
var TAMANO_TABLA = 7.5;
var COLOR_TEXTO = "#000000";
var COLOR_NO_AUTORIZADO = "#b00020";
var COLOR_ENCABEZADO_TABLA = "#ffffff";
var PADDING_CAJA = 6;
var PADDING_CELDA = 3;
var ESPACIO_LINEA = 2;
var ANCHO_VALOR = 75;
var TAMANO_MINIMO_AJUSTE = 4.5;
var QR_LADO = 85;
var ALTURA_CODIGO_BARRAS = 34;
var SEPARACION_COLUMNAS = 8;
var ALTURA_IMAGEN_LOGO = 62;
var ALTURA_LOGO = ALTURA_IMAGEN_LOGO + 6;
var FRACCION_ETIQUETA_DIRECCION = 0.3;
var FRACCION_ETIQUETA_ANCHA = 0.68;
var FRACCIONES_BANDA = [0.32, 0.3, 0.14, 0.24];
var SEPARACION_SUBSIDIO = 6;
var FRACCION_PIE_IZQUIERDA = 0.6;
var SEPARACION_PIE = 8;
var MAX_DETALLES_ADICIONALES = 3;
var TAMANO_DETALLE = 6.5;
var CODIGO_IMPUESTO_IVA = "2";
var CODIGO_IMPUESTO_ICE = "3";
var CODIGO_IMPUESTO_IRBPNR = "5";
var CODIGO_PORCENTAJE_CERO = "0";
var CODIGO_PORCENTAJE_NO_OBJETO = "6";
var CODIGO_PORCENTAJE_EXENTO = "7";
var TITULO_INFO_ADICIONAL = "Informaci\xF3n Adicional";

// src/layout/labels.ts
var FormaPago = {
  EFECTIVO: "01",
  COMPENSACION_DEUDAS: "15",
  TARJETA_DEBITO: "16",
  DINERO_ELECTRONICO: "17",
  TARJETA_PREPAGO: "18",
  TARJETA_CREDITO: "19",
  OTROS_SISTEMA_FINANCIERO: "20",
  ENDOSO_TITULOS: "21"
};
var LABEL_IMPUESTO = {
  [CODIGO_IMPUESTO_IRBPNR]: "IRBPNR"
};
var LABEL_CODIGO_PORCENTAJE = {
  "0": "0%",
  "2": "12%",
  "3": "14%",
  "4": "15%",
  "5": "5%",
  "6": "No objeto de IVA",
  "7": "Exento de IVA",
  "8": "IVA diferenciado",
  "10": "13%"
};
var LABEL_FORMA_PAGO = {
  [FormaPago.EFECTIVO]: "Sin utilizaci\xF3n del sistema financiero",
  [FormaPago.COMPENSACION_DEUDAS]: "Compensaci\xF3n de deudas",
  [FormaPago.TARJETA_DEBITO]: "Tarjeta de d\xE9bito",
  [FormaPago.DINERO_ELECTRONICO]: "Dinero electr\xF3nico",
  [FormaPago.TARJETA_PREPAGO]: "Tarjeta prepago",
  [FormaPago.TARJETA_CREDITO]: "Tarjeta de cr\xE9dito",
  [FormaPago.OTROS_SISTEMA_FINANCIERO]: "Otros con utilizaci\xF3n del sistema financiero",
  [FormaPago.ENDOSO_TITULOS]: "Endoso de t\xEDtulos"
};
var LABEL_AMBIENTE = {
  ["1"]: "PRUEBAS",
  ["2"]: "PRODUCCI\xD3N"
};
var LABEL_TIPO_EMISION = {
  ["1"]: "NORMAL"
};
var LABEL_TIPO_IDENTIFICACION = {
  "04": "RUC",
  "05": "C\xE9dula de Identidad",
  "06": "Pasaporte",
  "07": "Consumidor Final",
  "08": "Identificaci\xF3n del Exterior"
};
var NOMBRE_POR_COD_DOC = {
  ["01"]: "Factura",
  ["03"]: "Liquidaci\xF3n de Compra",
  ["04"]: "Nota de Cr\xE9dito",
  ["05"]: "Nota de D\xE9bito",
  ["06"]: "Gu\xEDa de Remisi\xF3n",
  ["07"]: "Comprobante de Retenci\xF3n"
};
function etiquetaCatalogo(mapa, codigo) {
  if (codigo === void 0) return "";
  return mapa[codigo] ?? String(codigo);
}
function nombreDocumento(tipo) {
  switch (tipo) {
    case "01":
      return "FACTURA";
    case "03":
      return "LIQUIDACI\xD3N DE COMPRA DE BIENES Y PRESTACI\xD3N DE SERVICIOS";
    case "04":
      return "NOTA DE CR\xC9DITO";
    case "05":
      return "NOTA DE D\xC9BITO";
    case "06":
      return "GU\xCDA DE REMISI\xD3N";
    case "07":
      return "COMPROBANTE DE RETENCI\xD3N";
  }
}
function nombreDocumentoPorCodigo(codDoc) {
  return NOMBRE_POR_COD_DOC[codDoc] ?? codDoc;
}
function tipoIdentificacionLabel(codigo) {
  return LABEL_TIPO_IDENTIFICACION[codigo] ?? codigo;
}
function identificacionConTipo(identificacion, tipo) {
  return tipo ? `${identificacion} (${tipoIdentificacionLabel(tipo)})` : identificacion;
}
function formaPagoLabel(codigo) {
  return LABEL_FORMA_PAGO[codigo] ?? codigo;
}
function formatNumeroComprobante(info) {
  return `${info.estab}-${info.ptoEmi}-${info.secuencial}`;
}

// src/layout/primitives.ts
function noVacio(v) {
  return v !== void 0 && v.trim() !== "";
}
function aplicarFuente(doc, linea) {
  doc.font(linea.negrita ? FUENTE_NEGRITA : FUENTE_NORMAL).fontSize(linea.tamano ?? TAMANO_TEXTO).fillColor(linea.color ?? COLOR_TEXTO);
}
function aplicarFuenteColumna(doc, columna) {
  doc.font(columna.negrita ? FUENTE_NEGRITA : FUENTE_NORMAL).fillColor(columna.color ?? COLOR_TEXTO);
  const base = columna.tamano ?? TAMANO_TEXTO;
  const tamano = columna.ajustar ? tamanoQueCabe(doc, columna.texto, columna.ancho, base) : base;
  doc.fontSize(tamano);
  return tamano;
}
function opcionesColumna(columna) {
  return {
    width: columna.ancho,
    align: columna.alineacion ?? "left",
    characterSpacing: columna.espaciadoCaracteres
  };
}
function opcionesLinea(doc, linea, ancho) {
  if (linea.ajustar) {
    doc.fontSize(tamanoQueCabe(doc, linea.texto, ancho, linea.tamano ?? TAMANO_TEXTO));
  }
  return { width: ancho, align: linea.alineacion ?? "left", characterSpacing: linea.espaciadoCaracteres };
}
function alturaLinea(doc, linea, anchoCaja) {
  if (linea.espaciador !== void 0) {
    return linea.espaciador;
  }
  if (linea.columnas) {
    return Math.max(
      ...linea.columnas.map((columna) => {
        aplicarFuenteColumna(doc, columna);
        return doc.heightOfString(columna.texto, opcionesColumna(columna));
      })
    );
  }
  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  if (linea.valor === void 0) {
    return doc.heightOfString(linea.texto, opcionesLinea(doc, linea, ancho));
  }
  const anchoValor = linea.anchoValor ?? ANCHO_VALOR;
  return Math.max(
    doc.heightOfString(linea.texto, opcionesLinea(doc, linea, ancho - anchoValor - ESPACIO_LINEA)),
    doc.heightOfString(linea.valor, { width: anchoValor })
  );
}
function avanceLinea(doc, linea, anchoCaja) {
  return alturaLinea(doc, linea, anchoCaja) + (linea.espaciador !== void 0 ? 0 : ESPACIO_LINEA);
}
function escribirTexto(doc, texto2, x, y, opciones) {
  doc.text(texto2, x, y, { ...opciones, height: Infinity });
}
function dibujarLinea(doc, linea, x, y, anchoCaja) {
  if (linea.espaciador !== void 0) {
    linea.dibujar?.(x, y, anchoCaja);
    return;
  }
  if (linea.columnas) {
    let cx = x;
    for (const columna of linea.columnas) {
      aplicarFuenteColumna(doc, columna);
      escribirTexto(doc, columna.texto, cx, y, opcionesColumna(columna));
      cx += columna.ancho;
    }
    return;
  }
  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  if (linea.valor === void 0) {
    escribirTexto(doc, linea.texto, x, y, opcionesLinea(doc, linea, ancho));
    return;
  }
  const anchoValor = linea.anchoValor ?? ANCHO_VALOR;
  escribirTexto(doc, linea.texto, x, y, opcionesLinea(doc, linea, ancho - anchoValor - ESPACIO_LINEA));
  aplicarFuente(doc, linea);
  escribirTexto(doc, linea.valor, x + ancho - anchoValor, y, { width: anchoValor, align: "right" });
}
function dibujarBordeCaja(doc, x, y, ancho, alto) {
  doc.lineWidth(0.75).strokeColor(COLOR_TEXTO).rect(x, y, ancho, alto).stroke();
}
function tamanoQueCabe(doc, texto2, ancho, base) {
  if (texto2 === "" || /\s/.test(texto2)) return base;
  doc.fontSize(base);
  if (doc.widthOfString(texto2) <= ancho) return base;
  let tamano = base;
  while (tamano > TAMANO_MINIMO_AJUSTE) {
    tamano = Math.max(TAMANO_MINIMO_AJUSTE, tamano - 0.25);
    doc.fontSize(tamano);
    if (doc.widthOfString(texto2) <= ancho) return tamano;
  }
  return TAMANO_MINIMO_AJUSTE;
}
function lineaContinuacion(titulo) {
  return { texto: `${titulo} (continuaci\xF3n)`, negrita: true, tamano: TAMANO_TITULO };
}
function partirLinea(doc, linea, anchoCaja, presupuesto) {
  if (linea.espaciador !== void 0 || alturaLinea(doc, linea, anchoCaja) <= presupuesto) {
    return [linea];
  }
  if (linea.columnas) {
    const plano = { texto: linea.columnas.map((c) => c.texto).join(" "), negrita: linea.columnas[0]?.negrita };
    return partirLinea(doc, plano, anchoCaja, presupuesto);
  }
  aplicarFuente(doc, linea);
  const ancho = linea.ancho ?? anchoCaja;
  const anchoTexto = linea.valor === void 0 ? ancho : ancho - (linea.anchoValor ?? ANCHO_VALOR) - ESPACIO_LINEA;
  const trozos = partirTextoPorAltura(doc, linea.texto, anchoTexto, presupuesto);
  return trozos.map((texto2, i) => i === 0 ? { ...linea, texto: texto2 } : { ...linea, texto: texto2, valor: void 0 });
}
function medirCaja(doc, lineas, anchoArea, alturaExtra = 0) {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  let alto = PADDING_CAJA * 2 + alturaExtra;
  for (const linea of lineas) {
    alto += avanceLinea(doc, linea, anchoCaja);
  }
  return alto;
}
function dibujarCaja(doc, area, lineas, opciones = {}) {
  const anchoCaja = area.width - PADDING_CAJA * 2;
  const x = area.x + PADDING_CAJA;
  const alturaExtra = opciones.alturaExtra ?? 0;
  const altoContinuacion = opciones.titulo ? avanceLinea(doc, lineaContinuacion(opciones.titulo), anchoCaja) : 0;
  const presupuestoLinea = alturaUtilPagina(doc) - PADDING_CAJA * 2 - ESPACIO_LINEA - altoContinuacion;
  const lineasFinales = lineas.flatMap((linea) => partirLinea(doc, linea, anchoCaja, presupuestoLinea));
  let topCaja = area.y;
  let y = topCaja + PADDING_CAJA;
  if (opciones.dibujarExtra) {
    opciones.dibujarExtra(x, y, anchoCaja);
  }
  y += alturaExtra;
  let hayContenido = alturaExtra > 0;
  for (const linea of lineasFinales) {
    const alto = alturaLinea(doc, linea, anchoCaja);
    if (hayContenido && y + alto + PADDING_CAJA > limiteInferior(doc)) {
      dibujarBordeCaja(doc, area.x, topCaja, area.width, y + PADDING_CAJA - topCaja);
      doc.addPage();
      topCaja = doc.page.margins.top;
      y = topCaja + PADDING_CAJA;
      if (opciones.titulo) {
        const continuacion = lineaContinuacion(opciones.titulo);
        dibujarLinea(doc, continuacion, x, y, anchoCaja);
        y += avanceLinea(doc, continuacion, anchoCaja);
      }
    }
    dibujarLinea(doc, linea, x, y, anchoCaja);
    y += avanceLinea(doc, linea, anchoCaja);
    hayContenido = true;
  }
  const abajo = Math.max(y + PADDING_CAJA, Math.min(topCaja + (opciones.altoMinimo ?? 0), limiteInferior(doc)));
  dibujarBordeCaja(doc, area.x, topCaja, area.width, abajo - topCaja);
  return abajo;
}

// src/layout/header.ts
function drawCabecera(doc, cabecera, area) {
  const { anchoIzquierda, anchoDerecha } = anchosCabecera(area.width);
  const codigoBarras = cabecera.codigoBarras ?? true;
  const altoIzquierda = medirEmisor(doc, cabecera.emisor, anchoIzquierda);
  const altoDerecha = medirComprobante(doc, cabecera.comprobante, anchoDerecha, cabecera.qr !== void 0, codigoBarras);
  const alto = Math.max(altoIzquierda, altoDerecha);
  const y = asegurarEspacio(doc, area.y, alto);
  const altoMinimoEmisor = cabecera.emisor.logo ? alto : void 0;
  const abajoIzquierda = drawEmisor(doc, cabecera.emisor, { x: area.x, y, width: anchoIzquierda }, altoMinimoEmisor);
  const abajoDerecha = drawComprobante(
    doc,
    cabecera.comprobante,
    { x: area.x + anchoIzquierda + SEPARACION_COLUMNAS, y, width: anchoDerecha },
    cabecera.qr,
    codigoBarras,
    alto
  );
  return Math.max(abajoIzquierda, abajoDerecha);
}
function medirCabecera(doc, cabecera, ancho) {
  const { anchoIzquierda, anchoDerecha } = anchosCabecera(ancho);
  return Math.max(
    medirEmisor(doc, cabecera.emisor, anchoIzquierda),
    medirComprobante(doc, cabecera.comprobante, anchoDerecha, cabecera.qr !== void 0, cabecera.codigoBarras ?? true)
  );
}
function anchosCabecera(ancho) {
  const anchoIzquierda = Math.floor((ancho - SEPARACION_COLUMNAS) / 2);
  return { anchoIzquierda, anchoDerecha: ancho - anchoIzquierda - SEPARACION_COLUMNAS };
}
function drawEmisor(doc, emisor, area, altoMinimo) {
  let y = area.y;
  if (emisor.logo) {
    dibujarLogo(doc, emisor.logo, area.x, y, area.width);
    y += ALTURA_LOGO;
  }
  return dibujarCaja(doc, { ...area, y }, lineasEmisor(emisor, area.width), {
    altoMinimo: altoMinimo !== void 0 ? altoMinimo - (y - area.y) : void 0
  });
}
function dibujarLogo(doc, logo, x, y, ancho) {
  try {
    const logoData = logo.slice().buffer;
    doc.image(logoData, x, y, { fit: [ancho, ALTURA_IMAGEN_LOGO], align: "center", valign: "center" });
  } catch {
    throw new RideError(
      "El logo del emisor no se pudo procesar: formato no soportado o archivo corrupto. Usa PNG o JPG.",
      "RIDE_INVALID_LOGO"
    );
  }
}
function filaEtiquetaValor(anchoCaja, etiqueta, valor, fraccionEtiqueta, opciones = {}) {
  const anchoEtiqueta = Math.floor(anchoCaja * fraccionEtiqueta);
  return {
    texto: etiqueta,
    columnas: [
      { texto: etiqueta, ancho: anchoEtiqueta, negrita: true, tamano: opciones.tamano },
      {
        texto: valor,
        ancho: anchoCaja - anchoEtiqueta,
        tamano: opciones.tamano,
        alineacion: opciones.alinearValorDerecha ? "right" : "left",
        ajustar: true
      }
    ]
  };
}
function lineasEmisor(emisor, anchoArea) {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const lineas = [{ texto: emisor.razonSocial, negrita: true, tamano: TAMANO_TITULO }];
  if (emisor.nombreComercial) {
    lineas.push({ texto: emisor.nombreComercial, tamano: TAMANO_TABLA });
  }
  lineas.push({ texto: "", espaciador: ESPACIO_LINEA * 2 });
  lineas.push(filaEtiquetaValor(anchoCaja, "Direcci\xF3n Matriz:", emisor.dirMatriz, FRACCION_ETIQUETA_DIRECCION));
  if (noVacio(emisor.dirEstablecimiento)) {
    lineas.push(
      filaEtiquetaValor(anchoCaja, "Direcci\xF3n Sucursal:", emisor.dirEstablecimiento, FRACCION_ETIQUETA_DIRECCION)
    );
  }
  if (noVacio(emisor.contribuyenteEspecial)) {
    lineas.push(
      filaEtiquetaValor(anchoCaja, "Contribuyente Especial Nro", emisor.contribuyenteEspecial, FRACCION_ETIQUETA_ANCHA, {
        alinearValorDerecha: true
      })
    );
  }
  if (emisor.obligadoContabilidad) {
    lineas.push(
      filaEtiquetaValor(anchoCaja, "OBLIGADO A LLEVAR CONTABILIDAD", emisor.obligadoContabilidad, FRACCION_ETIQUETA_ANCHA, {
        alinearValorDerecha: true
      })
    );
  }
  for (const [etiqueta, valor] of [
    ["Agente de Retenci\xF3n:", emisor.agenteRetencion],
    ["Contribuyente R\xE9gimen RIMPE:", emisor.contribuyenteRimpe],
    ["RISE:", emisor.rise]
  ]) {
    if (noVacio(valor)) {
      lineas.push(filaEtiquetaValor(anchoCaja, etiqueta, valor, 0.45));
    }
  }
  return lineas;
}
function medirEmisor(doc, emisor, ancho) {
  return medirCaja(doc, lineasEmisor(emisor, ancho), ancho) + (emisor.logo ? ALTURA_LOGO : 0);
}
function drawComprobante(doc, comprobante, area, qr, codigoBarras = true, altoMinimo) {
  return dibujarCaja(doc, area, lineasComprobante(doc, comprobante, area.width, qr, codigoBarras), { altoMinimo });
}
function ajustarNombreDocumento(doc, nombre, anchoCaja) {
  const TAMANO_MAX = TAMANO_TITULO + 3;
  const ESPACIADO_MAX = 2.5;
  const lineas = (espaciado) => {
    const alto = doc.heightOfString(nombre, { width: anchoCaja, characterSpacing: espaciado });
    return Math.max(1, Math.round(alto / doc.heightOfString("X", { width: anchoCaja })));
  };
  doc.font(FUENTE_NEGRITA);
  for (const maxLineas of [1, 2]) {
    let tamano = TAMANO_MAX;
    let espaciado = ESPACIADO_MAX;
    while (tamano > TAMANO_TABLA) {
      doc.fontSize(tamano);
      if (lineas(espaciado) <= maxLineas) {
        return { tamano, espaciado };
      }
      tamano -= 0.5;
      espaciado = Math.max(0, espaciado - 0.35);
    }
  }
  doc.fontSize(TAMANO_TABLA);
  return { tamano: TAMANO_TABLA, espaciado: 0 };
}
function lineasComprobante(doc, comprobante, anchoArea, qr, codigoBarras) {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const { tamano: tamanoNombreDoc, espaciado: espaciadoNombreDoc } = ajustarNombreDocumento(
    doc,
    comprobante.nombreDocumento,
    anchoCaja
  );
  const lineas = [
    filaEtiquetaValor(anchoCaja, "R.U.C.:", comprobante.ruc, 0.3, { tamano: TAMANO_TITULO }),
    {
      texto: comprobante.nombreDocumento,
      negrita: true,
      tamano: tamanoNombreDoc,
      espaciadoCaracteres: espaciadoNombreDoc
    },
    filaEtiquetaValor(anchoCaja, "No.", comprobante.numero, 0.15, { tamano: TAMANO_TITULO }),
    { texto: "N\xDAMERO DE AUTORIZACI\xD3N", tamano: TAMANO_TABLA }
  ];
  if (comprobante.autorizacion) {
    lineas.push({ texto: comprobante.autorizacion.numero, negrita: true, tamano: TAMANO_TABLA, ajustar: true });
    lineas.push(
      filaEtiquetaValor(anchoCaja, "FECHA Y HORA DE AUTORIZACI\xD3N", comprobante.autorizacion.fecha, 0.5, {
        tamano: TAMANO_TABLA
      })
    );
  } else {
    lineas.push({ texto: "COMPROBANTE NO AUTORIZADO", negrita: true, color: COLOR_NO_AUTORIZADO });
  }
  lineas.push(filaEtiquetaValor(anchoCaja, "AMBIENTE:", etiquetaCatalogo(LABEL_AMBIENTE, comprobante.ambiente), 0.35));
  lineas.push(
    filaEtiquetaValor(anchoCaja, "EMISI\xD3N:", etiquetaCatalogo(LABEL_TIPO_EMISION, comprobante.tipoEmision), 0.35)
  );
  lineas.push({ texto: "CLAVE DE ACCESO", tamano: TAMANO_TITULO });
  if (codigoBarras) {
    lineas.push({
      texto: "",
      espaciador: ALTURA_CODIGO_BARRAS + ESPACIO_LINEA,
      dibujar: (x, y, ancho) => dibujarCode128(doc, comprobante.claveAcceso, { x, y, ancho, alto: ALTURA_CODIGO_BARRAS })
    });
  }
  if (qr) {
    lineas.push({
      texto: "",
      espaciador: QR_LADO + ESPACIO_LINEA,
      dibujar: (x, y, ancho) => dibujarQr(doc, qr, { x: x + (ancho - QR_LADO) / 2, y, size: QR_LADO })
    });
  }
  lineas.push({ texto: comprobante.claveAcceso, tamano: TAMANO_TABLA, alineacion: "center", ajustar: true });
  return lineas;
}
function medirComprobante(doc, comprobante, ancho, hayQr, codigoBarras = true) {
  return medirCaja(doc, lineasComprobante(doc, comprobante, ancho, hayQr ? FALSO_QR : void 0, codigoBarras), ancho);
}
var FALSO_QR = {
  size: QR_LADO,
  version: 1,
  maskPattern: 0,
  get: () => false
};

// src/layout/subject.ts
function drawBandaSujeto(doc, filas, area, titulo) {
  return dibujarCaja(doc, area, lineasBanda(filas, area.width, titulo), { titulo });
}
function medirBandaSujeto(doc, filas, ancho, titulo) {
  return medirCaja(doc, lineasBanda(filas, ancho, titulo), ancho);
}
function lineasBanda(filas, anchoArea, titulo) {
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const anchosDe = (fracciones) => {
    const total = fracciones.reduce((s, f) => s + f, 0);
    const anchos = fracciones.map((f) => Math.floor(anchoCaja * f / total));
    anchos[3] = anchoCaja - anchos[0] - anchos[1] - anchos[2];
    return anchos;
  };
  const lineas = titulo ? [{ texto: titulo, negrita: true, tamano: TAMANO_TITULO }] : [];
  for (const fila of filas) {
    const anchos = anchosDe(fila.fracciones ?? FRACCIONES_BANDA);
    const columnas = fila.derecha === void 0 ? [
      { texto: fila.izquierda.etiqueta, ancho: anchos[0], negrita: true },
      { texto: fila.izquierda.valor, ancho: anchoCaja - anchos[0], ajustar: true }
    ] : [
      { texto: fila.izquierda.etiqueta, ancho: anchos[0], negrita: true },
      { texto: fila.izquierda.valor, ancho: anchos[1], ajustar: true },
      { texto: fila.derecha.etiqueta, ancho: anchos[2], negrita: true },
      { texto: fila.derecha.valor, ancho: anchos[3], ajustar: true }
    ];
    lineas.push({ texto: fila.izquierda.etiqueta, columnas });
  }
  return lineas;
}
function drawComprador(doc, comprador, area) {
  return drawBandaSujeto(doc, filasComprador(comprador), area, tituloComprador(comprador));
}
function tituloComprador(comprador) {
  return comprador.etiquetaSujeto?.toUpperCase();
}
function filasComprador(comprador) {
  const tipo = comprador.tipoIdentificacion ? ` (${LABEL_TIPO_IDENTIFICACION[comprador.tipoIdentificacion] ?? comprador.tipoIdentificacion})` : "";
  const pares = [
    ["Raz\xF3n Social / Nombres y Apellidos:", noVacio(comprador.razonSocial) ? comprador.razonSocial : void 0],
    ["Identificaci\xF3n:", noVacio(comprador.identificacion) ? `${comprador.identificacion}${tipo}` : void 0],
    ["Fecha Emisi\xF3n:", noVacio(comprador.fechaEmision) ? comprador.fechaEmision : void 0],
    ["Gu\xEDa Remisi\xF3n:", noVacio(comprador.guiaRemision) ? comprador.guiaRemision : void 0],
    ["Direcci\xF3n:", noVacio(comprador.direccion) ? comprador.direccion : void 0]
  ];
  return emparejarFilas(pares);
}
function emparejarFilas(pares) {
  const presentes = pares.filter((par) => par[1] !== void 0).map(([etiqueta, valor]) => ({ etiqueta, valor }));
  const filas = [];
  for (let i = 0; i < presentes.length; i += 2) {
    filas.push({ izquierda: presentes[i], derecha: presentes[i + 1] });
  }
  return filas;
}
function medirComprador(doc, comprador, ancho) {
  return medirBandaSujeto(doc, filasComprador(comprador), ancho, tituloComprador(comprador));
}

// src/money.ts
var MONTO_PATTERN = /^\d+(\.\d{1,6})?$/;
function isMonto(s) {
  return MONTO_PATTERN.test(s);
}
function toCents(monto) {
  if (!isMonto(monto)) {
    throw new RideError(`Monto inv\xE1lido: '${monto}'`, "RIDE_INVALID_INPUT", {
      cause: new Error("Debe ser un n\xFAmero no negativo con hasta 6 decimales.")
    });
  }
  const [intPart, fracPart = ""] = monto.split(".");
  const fracPadded = fracPart.padEnd(6, "0");
  const totalMicro = BigInt(intPart) * 1000000n + BigInt(fracPadded);
  const cents = (totalMicro + 5000n) / 10000n;
  return Number(cents);
}
function fromCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const absCents = Math.abs(cents);
  const intPart = Math.floor(absCents / 100);
  const centPart = absCents % 100;
  return `${sign}${intPart}.${centPart.toString().padStart(2, "0")}`;
}
function formatMonto(monto, decimals) {
  if (!isMonto(monto)) {
    throw new RideError(`Monto inv\xE1lido: '${monto}'`, "RIDE_INVALID_INPUT", {
      cause: new Error("Debe ser un n\xFAmero no negativo con hasta 6 decimales.")
    });
  }
  const [intPart, fracPart = ""] = monto.split(".");
  const workScale = Math.max(decimals, fracPart.length);
  const fracPadded = fracPart.padEnd(workScale, "0");
  const totalMicro = BigInt(intPart) * 10n ** BigInt(workScale) + BigInt(fracPadded || "0");
  const divisor = 10n ** BigInt(workScale - decimals);
  const half = divisor / 2n;
  const rounded = (totalMicro + half) / divisor;
  const roundedStr = rounded.toString().padStart(decimals + 1, "0");
  const cut = roundedStr.length - decimals;
  const intOut = roundedStr.slice(0, cut);
  const fracOut = roundedStr.slice(cut);
  return decimals > 0 ? `${intOut}.${fracOut}` : intOut;
}

// src/layout/details.ts
var ETIQUETAS_DETALLE_FACTURA = {
  codigoPrincipal: "Cod. Principal",
  codigoAuxiliar: "Cod. Auxiliar",
  cantidad: "Cant."
};
var ETIQUETAS_DETALLE_COMPLETAS = {
  codigoPrincipal: "C\xF3digo",
  codigoAuxiliar: "C\xF3digo Auxiliar",
  cantidad: "Cantidad"
};
function formatCantidadPrecision(valor) {
  const normalizado = formatMonto(valor, 6);
  const [intPart, fracPart] = normalizado.split(".");
  const fracRecortada = (fracPart ?? "").replace(/0+$/, "");
  return `${intPart}.${fracRecortada.length < 2 ? fracRecortada.padEnd(2, "0") : fracRecortada}`;
}
function celdasDetalle(d, opciones) {
  const columnasExtra = opciones.detallesAdicionales ?? MAX_DETALLES_ADICIONALES;
  const extras = Object.entries(d.detallesAdicionales ?? {}).map(([k, v]) => `${k}: ${v}`);
  const enColumnas = extras.slice(0, columnasExtra);
  const sobrantes = extras.slice(columnasExtra);
  const celdas = [
    d.codigoPrincipal ?? "",
    d.codigoAuxiliar ?? "",
    formatCantidadPrecision(d.cantidad),
    [d.descripcion, ...sobrantes].join("\n"),
    ...Array.from({ length: columnasExtra }, (_, i) => enColumnas[i] ?? ""),
    formatCantidadPrecision(d.precioUnitario)
  ];
  if (opciones.subsidio !== false) {
    celdas.push("0.00", formatMonto(d.precioTotalSinImpuesto, 2));
  }
  celdas.push(formatMonto(d.descuento, 2), formatMonto(d.precioTotalSinImpuesto, 2));
  return celdas;
}
function especificacionDetalle(opciones) {
  const columnasExtra = opciones.detallesAdicionales ?? MAX_DETALLES_ADICIONALES;
  const etiquetas = { ...ETIQUETAS_DETALLE_FACTURA, ...opciones.etiquetas };
  const specs = [
    [etiquetas.codigoPrincipal, 8.5, "left"],
    [etiquetas.codigoAuxiliar, 7.5, "left"],
    [etiquetas.cantidad, 6.5, "right"],
    ["Descripci\xF3n", 18.5, "left"]
  ];
  for (let i = 0; i < columnasExtra; i++) {
    specs.push(["Detalle Adicional", 7, "left"]);
  }
  specs.push(["Precio Unitario", 8, "right"]);
  if (opciones.subsidio !== false) {
    specs.push(["Subsidio", 6.5, "right"], ["Precio Sin Subsidio", 7.5, "right"]);
  }
  specs.push(["Descuento", 7, "right"], ["Precio Total", 9, "right"]);
  return specs;
}
function construirColumnas(anchoTotal, specs) {
  const total = specs.reduce((s, [, peso]) => s + peso, 0);
  const widths = specs.map(([, peso]) => Math.floor(anchoTotal * peso / total));
  const usado = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += anchoTotal - usado;
  return specs.map(([header, , align], i) => ({ header, width: widths[i], align }));
}
function fuenteFilaTabla(doc, esEncabezado, tamano) {
  doc.font(esEncabezado ? FUENTE_NEGRITA : FUENTE_NORMAL).fontSize(tamano).fillColor(COLOR_TEXTO);
}
function tamanosCelda(doc, columnas, celdas, esEncabezado, base) {
  fuenteFilaTabla(doc, esEncabezado, base);
  return columnas.map((col, i) => tamanoQueCabe(doc, celdas[i], col.width - PADDING_CELDA * 2, base));
}
function alturaFilaTabla(doc, columnas, celdas, esEncabezado, base) {
  const tamanos = tamanosCelda(doc, columnas, celdas, esEncabezado, base);
  const alturas = columnas.map((col, i) => {
    doc.fontSize(tamanos[i]);
    return doc.heightOfString(celdas[i], { width: col.width - PADDING_CELDA * 2 });
  });
  return Math.max(...alturas) + PADDING_CELDA * 2;
}
function dibujarFilaTabla(doc, columnas, celdas, x, y, esEncabezado, opciones = {}) {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const alto = alturaFilaTabla(doc, columnas, celdas, esEncabezado, base);
  const anchoTotal = columnas.reduce((s, c) => s + c.width, 0);
  if (esEncabezado) {
    doc.rect(x, y, anchoTotal, alto).fillAndStroke(COLOR_ENCABEZADO_TABLA, COLOR_TEXTO);
    doc.fillColor(COLOR_TEXTO);
  }
  const tamanos = tamanosCelda(doc, columnas, celdas, esEncabezado, base);
  let cx = x;
  for (let i = 0; i < columnas.length; i++) {
    fuenteFilaTabla(doc, esEncabezado, tamanos[i]);
    escribirTexto(doc, celdas[i], cx + PADDING_CELDA, y + PADDING_CELDA, {
      width: columnas[i].width - PADDING_CELDA * 2,
      align: esEncabezado ? "center" : columnas[i].align
    });
    cx += columnas[i].width;
  }
  doc.lineWidth(0.5).strokeColor(COLOR_TEXTO);
  if (!esEncabezado) {
    doc.rect(x, y, anchoTotal, alto).stroke();
  }
  if (opciones.divisores !== false) {
    cx = x;
    for (const col of columnas.slice(0, -1)) {
      cx += col.width;
      doc.moveTo(cx, y).lineTo(cx, y + alto).stroke();
    }
  }
  return y + alto;
}
function dibujarFilaEnVariasPaginas(doc, columnas, encabezados, celdas, x, y, altoEncabezado, opciones) {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;
  const abrirPagina = () => {
    doc.addPage();
    const yTop = doc.page.margins.top;
    return conEncabezado ? dibujarFilaTabla(doc, columnas, encabezados, x, yTop, true, opciones) : yTop;
  };
  let yFila = y;
  if (yFila > doc.page.margins.top + altoEncabezado) {
    yFila = abrirPagina();
  }
  const presupuesto = alturaUtilPagina(doc) - altoEncabezado - PADDING_CELDA * 2;
  fuenteFilaTabla(doc, false, base);
  const trozos = columnas.map(
    (col, i) => partirTextoPorAltura(doc, celdas[i], col.width - PADDING_CELDA * 2, presupuesto)
  );
  const subFilas = Math.max(...trozos.map((t) => t.length));
  for (let s = 0; s < subFilas; s++) {
    if (s > 0) {
      yFila = abrirPagina();
    }
    yFila = dibujarFilaTabla(
      doc,
      columnas,
      trozos.map((t) => t[s] ?? ""),
      x,
      yFila,
      false,
      opciones
    );
  }
  return yFila;
}
function drawTablaGenerica(doc, columnas, filas, area, opciones = {}) {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;
  const encabezados = columnas.map((c) => c.header);
  const altoEncabezado = conEncabezado ? alturaFilaTabla(doc, columnas, encabezados, true, base) : 0;
  const altoPrimeraFila = filas.length > 0 ? alturaFilaTabla(doc, columnas, filas[0], false, base) : 0;
  let y = asegurarEspacio(doc, area.y, Math.min(altoEncabezado + altoPrimeraFila, alturaUtilPagina(doc)));
  if (conEncabezado) {
    y = dibujarFilaTabla(doc, columnas, encabezados, area.x, y, true, opciones);
  }
  for (const fila of filas) {
    const alto = alturaFilaTabla(doc, columnas, fila, false, base);
    if (y + alto <= limiteInferior(doc)) {
      y = dibujarFilaTabla(doc, columnas, fila, area.x, y, false, opciones);
      continue;
    }
    if (altoEncabezado + alto <= alturaUtilPagina(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
      if (conEncabezado) {
        y = dibujarFilaTabla(doc, columnas, encabezados, area.x, y, true, opciones);
      }
      y = dibujarFilaTabla(doc, columnas, fila, area.x, y, false, opciones);
      continue;
    }
    y = dibujarFilaEnVariasPaginas(doc, columnas, encabezados, fila, area.x, y, altoEncabezado, opciones);
  }
  return y;
}
function medirTablaGenerica(doc, columnas, filas, opciones = {}) {
  const base = opciones.tamano ?? TAMANO_TABLA;
  const conEncabezado = opciones.conEncabezado !== false;
  let alto = conEncabezado ? alturaFilaTabla(doc, columnas, columnas.map((c) => c.header), true, base) : 0;
  for (const fila of filas) {
    alto += alturaFilaTabla(doc, columnas, fila, false, base);
  }
  return alto;
}
function drawTablaDetalles(doc, detalles, area, opciones = {}) {
  const columnas = construirColumnas(area.width, especificacionDetalle(opciones));
  const filas = detalles.map((d) => celdasDetalle(d, opciones));
  return drawTablaGenerica(doc, columnas, filas, area, { tamano: TAMANO_DETALLE });
}

// src/layout/totals.ts
var ETIQUETAS_TOTALES_FACTURA = {
  subtotalCero: "SUBTOTAL IVA 0%",
  subtotalNoObjeto: "SUBTOTAL NO OBJETO IVA",
  subtotalExento: "SUBTOTAL EXENTO IVA",
  subtotalSinImpuestos: "SUBTOTAL SIN IMPUESTOS",
  descuento: "DESCUENTO",
  valorTotal: "VALOR TOTAL"
};
var OPCIONES_TABLA_TOTALES = { conEncabezado: false, tamano: TAMANO_TABLA };
var OPCIONES_TABLA_SUBSIDIO = { conEncabezado: false, tamano: TAMANO_TEXTO, divisores: false };
function columnasTotales(ancho) {
  return construirColumnas(ancho, [
    ["", 0.72, "left"],
    ["", 0.28, "right"]
  ]);
}
function basesPorCodigoPorcentaje(impuestos) {
  const grupos = /* @__PURE__ */ new Map();
  for (const imp of impuestos) {
    if (imp.codigo !== CODIGO_IMPUESTO_IVA) continue;
    grupos.set(imp.codigoPorcentaje, (grupos.get(imp.codigoPorcentaje) ?? 0) + toCents(imp.baseImponible));
  }
  return grupos;
}
function agruparValorPorCodigo(impuestos) {
  const grupos = /* @__PURE__ */ new Map();
  for (const imp of impuestos) {
    grupos.set(imp.codigo, (grupos.get(imp.codigo) ?? 0) + toCents(imp.valor));
  }
  return grupos;
}
function filasTotales(totales) {
  const etiquetas = { ...ETIQUETAS_TOTALES_FACTURA, ...totales.etiquetas };
  const bases = basesPorCodigoPorcentaje(totales.impuestos);
  const filas = [];
  const filaSubtotal = (etiqueta, codigoPorcentaje) => {
    const cents = bases.get(codigoPorcentaje);
    bases.delete(codigoPorcentaje);
    filas.push([etiqueta, fromCents(cents ?? 0)]);
  };
  for (const [codigoPorcentaje, cents] of [...bases]) {
    if (codigoPorcentaje === CODIGO_PORCENTAJE_CERO || codigoPorcentaje === CODIGO_PORCENTAJE_NO_OBJETO || codigoPorcentaje === CODIGO_PORCENTAJE_EXENTO) {
      continue;
    }
    bases.delete(codigoPorcentaje);
    filas.push([`SUBTOTAL ${LABEL_CODIGO_PORCENTAJE[codigoPorcentaje] ?? codigoPorcentaje}`, fromCents(cents)]);
  }
  filaSubtotal(etiquetas.subtotalCero, CODIGO_PORCENTAJE_CERO);
  filaSubtotal(etiquetas.subtotalNoObjeto, CODIGO_PORCENTAJE_NO_OBJETO);
  filaSubtotal(etiquetas.subtotalExento, CODIGO_PORCENTAJE_EXENTO);
  filas.push([etiquetas.subtotalSinImpuestos, formatMonto(totales.totalSinImpuestos, 2)]);
  if (totales.totalDescuento !== void 0) {
    filas.push([etiquetas.descuento, formatMonto(totales.totalDescuento, 2)]);
  }
  const grupos = agruparValorPorCodigo(totales.impuestos);
  const ice = grupos.get(CODIGO_IMPUESTO_ICE);
  if (ice !== void 0) {
    filas.push(["ICE", fromCents(ice)]);
  }
  filas.push([`IVA${sufijoTarifaIva(totales.impuestos)}`, fromCents(grupos.get(CODIGO_IMPUESTO_IVA) ?? 0)]);
  for (const [codigo, cents] of grupos) {
    if (codigo === CODIGO_IMPUESTO_ICE || codigo === CODIGO_IMPUESTO_IVA) continue;
    filas.push([LABEL_IMPUESTO[codigo] ?? `OTRO IMPUESTO (C\xD3DIGO ${codigo})`, fromCents(cents)]);
  }
  if (totales.conPropina) {
    filas.push(["PROPINA", formatMonto(totales.propina ?? "0.00", 2)]);
  } else if (totales.propina) {
    filas.push(["PROPINA", formatMonto(totales.propina, 2)]);
  }
  if (totales.moneda) {
    filas.push(["MONEDA", totales.moneda]);
  }
  filas.push([etiquetas.valorTotal, formatMonto(totales.importeTotal, 2)]);
  return filas;
}
function filasSubsidio(totales) {
  if (!totales.conSubsidio) return [];
  return [
    ["VALOR TOTAL SIN SUBSIDIO", formatMonto(totales.importeTotal, 2)],
    ["AHORRO POR SUBSIDIO (incluye IVA cuando corresponda)", "0.00"]
  ];
}
function sufijoTarifaIva(impuestos) {
  const tarifas = new Set(
    impuestos.filter(
      (imp) => imp.codigo === CODIGO_IMPUESTO_IVA && imp.codigoPorcentaje !== CODIGO_PORCENTAJE_CERO && imp.codigoPorcentaje !== CODIGO_PORCENTAJE_NO_OBJETO && imp.codigoPorcentaje !== CODIGO_PORCENTAJE_EXENTO
    ).map((imp) => LABEL_CODIGO_PORCENTAJE[imp.codigoPorcentaje] ?? imp.codigoPorcentaje)
  );
  return tarifas.size === 1 ? ` ${[...tarifas][0]}` : "";
}
function drawTotales(doc, totales, area) {
  const columnas = columnasTotales(area.width);
  let y = drawTablaGenerica(doc, columnas, filasTotales(totales), area, OPCIONES_TABLA_TOTALES);
  const subsidio = filasSubsidio(totales);
  if (subsidio.length > 0) {
    y += SEPARACION_SUBSIDIO;
    y = drawTablaGenerica(doc, columnasTotales(area.width), subsidio, { ...area, y }, OPCIONES_TABLA_SUBSIDIO);
  }
  return y;
}
function medirTotales(doc, totales, ancho) {
  const columnas = columnasTotales(ancho);
  let alto = medirTablaGenerica(doc, columnas, filasTotales(totales), OPCIONES_TABLA_TOTALES);
  const subsidio = filasSubsidio(totales);
  if (subsidio.length > 0) {
    alto += SEPARACION_SUBSIDIO + medirTablaGenerica(doc, columnas, subsidio, OPCIONES_TABLA_SUBSIDIO);
  }
  return alto;
}

// src/layout/footer.ts
function drawInfoAdicional(doc, infoAdicional, area, altoMinimo) {
  const lineas = lineasInfoAdicional(infoAdicional, area.width);
  if (lineas.length === 0) {
    return area.y;
  }
  return dibujarCaja(doc, area, lineas, { titulo: TITULO_INFO_ADICIONAL, altoMinimo });
}
function lineasInfoAdicional(infoAdicional, anchoArea) {
  const entradas = infoAdicional ? Object.entries(infoAdicional).filter(([, valor]) => noVacio(valor)) : [];
  if (entradas.length === 0) {
    return [];
  }
  const anchoCaja = anchoArea - PADDING_CAJA * 2;
  const anchoClave = Math.floor(anchoCaja * 0.4);
  return [
    { texto: TITULO_INFO_ADICIONAL, negrita: true, tamano: TAMANO_TITULO },
    { texto: "", espaciador: ESPACIO_LINEA * 2 },
    ...entradas.map(([clave, valor]) => ({
      texto: `${clave}: ${valor}`,
      columnas: [
        { texto: clave, ancho: anchoClave },
        { texto: valor, ancho: anchoCaja - anchoClave }
      ]
    }))
  ];
}
function medirInfoAdicional(doc, infoAdicional, ancho) {
  const lineas = lineasInfoAdicional(infoAdicional, ancho);
  return lineas.length === 0 ? 0 : medirCaja(doc, lineas, ancho);
}
function columnasFormasPago(ancho) {
  return construirColumnas(ancho, [
    ["Forma de Pago", 0.72, "left"],
    ["Valor", 0.28, "right"]
  ]);
}
function filasFormasPago(pagos) {
  return pagos.map((pago) => {
    const partes = [formaPagoLabel(pago.formaPago)];
    if (pago.plazo) partes.push(`Plazo: ${pago.plazo}`);
    if (pago.unidadTiempo) partes.push(`Unidad de Tiempo: ${pago.unidadTiempo}`);
    return [partes.join(" \u2014 "), formatMonto(pago.total, 2)];
  });
}
function drawFormasPago(doc, pagos, area) {
  return drawTablaGenerica(doc, columnasFormasPago(area.width), filasFormasPago(pagos), area);
}
function medirFormasPago(doc, pagos, ancho) {
  return medirTablaGenerica(doc, columnasFormasPago(ancho), filasFormasPago(pagos));
}
function drawBloqueTexto(doc, titulo, lineas, area) {
  return dibujarCaja(doc, area, lineasBloqueTexto(titulo, lineas), { titulo });
}
function lineasBloqueTexto(titulo, lineas) {
  return [
    { texto: titulo, negrita: true, tamano: TAMANO_TITULO },
    ...lineas.map((texto2) => ({ texto: texto2 }))
  ];
}
function medirBloqueTexto(doc, titulo, lineas, ancho) {
  return medirCaja(doc, lineasBloqueTexto(titulo, lineas), ancho);
}
function drawPie(doc, contenido, area) {
  const { anchoIzquierda, anchoDerecha } = anchosPie(area.width);
  const xDerecha = area.x + anchoIzquierda + SEPARACION_COLUMNAS;
  const altoInfo = medirInfoAdicional(doc, contenido.infoAdicional, anchoIzquierda);
  const altoPagos = contenido.pagos?.length ? medirFormasPago(doc, contenido.pagos, anchoIzquierda) : 0;
  const altoIzquierda = altoInfo + (altoInfo > 0 && altoPagos > 0 ? SEPARACION_PIE : 0) + altoPagos;
  const altoDerecha = contenido.totales ? medirTotales(doc, contenido.totales, anchoDerecha) : 0;
  return drawBloquesEnFila(
    doc,
    area.y,
    altoIzquierda,
    altoDerecha,
    (yFila) => {
      let y = yFila;
      if (altoInfo > 0) {
        const altoCaja = altoInfo + Math.max(0, altoDerecha - altoIzquierda);
        y = drawInfoAdicional(doc, contenido.infoAdicional, { x: area.x, y, width: anchoIzquierda }, altoCaja);
        if (altoPagos > 0) y += SEPARACION_PIE;
      }
      if (altoPagos > 0) {
        y = drawFormasPago(doc, contenido.pagos, { x: area.x, y, width: anchoIzquierda });
      }
      return y;
    },
    (yFila) => contenido.totales ? drawTotales(doc, contenido.totales, { x: xDerecha, y: yFila, width: anchoDerecha }) : yFila,
    SEPARACION_PIE
  );
}
function medirPie(doc, contenido, ancho) {
  const { anchoIzquierda, anchoDerecha } = anchosPie(ancho);
  const altoInfo = medirInfoAdicional(doc, contenido.infoAdicional, anchoIzquierda);
  const altoPagos = contenido.pagos?.length ? medirFormasPago(doc, contenido.pagos, anchoIzquierda) : 0;
  return Math.max(
    altoInfo + (altoInfo > 0 && altoPagos > 0 ? SEPARACION_PIE : 0) + altoPagos,
    contenido.totales ? medirTotales(doc, contenido.totales, anchoDerecha) : 0
  );
}
function anchosPie(ancho) {
  const anchoIzquierda = Math.floor((ancho - SEPARACION_COLUMNAS) * FRACCION_PIE_IZQUIERDA);
  return { anchoIzquierda, anchoDerecha: ancho - anchoIzquierda - SEPARACION_COLUMNAS };
}
function drawBloquesEnFila(doc, y, altoIzquierda, altoDerecha, izquierda, derecha, separacion = 0) {
  const alto = Math.max(altoIzquierda, altoDerecha);
  if (alto > alturaUtilPagina(doc)) {
    let yActual = asegurarEspacio(doc, y, alturaUtilPagina(doc));
    yActual = izquierda(yActual) + separacion;
    yActual = asegurarEspacio(doc, yActual, alturaUtilPagina(doc));
    return derecha(yActual);
  }
  const yFila = asegurarEspacio(doc, y, alto);
  return Math.max(izquierda(yFila), derecha(yFila));
}

// src/pdf/document.ts
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
async function crearDocumentoRide(tamano) {
  const chunks = [];
  const doc = new PDFDocument({
    size: tamano,
    margin: 36,
    autoFirstPage: true
  });
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("error", (err) => {
    rejectFn?.(err);
  });
  let rejectFn;
  const finalizePromise = new Promise((resolve, reject) => {
    rejectFn = reject;
    doc.on("end", () => {
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
    }
  };
}

// src/renderers/factura.ts
var ESPACIADO_BLOQUE = 10;
async function generarRideFactura(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;
  const comprador = {
    razonSocial: documento.razonSocialComprador,
    identificacion: documento.identificacionComprador,
    tipoIdentificacion: documento.tipoIdentificacionComprador,
    fechaEmision: documento.fechaEmision,
    direccion: documento.direccionComprador,
    guiaRemision: documento.guiaRemision
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, comprador, anchoUtil));
  y = drawComprador(doc, comprador, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;
  y = drawTablaDetalles(doc, documento.detalles, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE;
  const totales = {
    impuestos: documento.totalConImpuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    totalDescuento: documento.totalDescuento,
    propina: documento.propina,
    importeTotal: documento.importeTotal,
    moneda: documento.moneda,
    conPropina: true,
    conSubsidio: true
  };
  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}

// src/layout/sri.ts
var SRI_MARGEN = 24;
var SRI_PADDING = 7;
var SRI_TINTA = "#000000";
var SRI_GRIS = "#eeeeee";
var SRI_ROJO = "#d0021b";
var HELVETICA = "Helvetica";
var HELVETICA_BOLD = "Helvetica-Bold";
function texto(doc, valor, x, y, w, opciones = {}) {
  doc.font(opciones.bold ? HELVETICA_BOLD : HELVETICA).fontSize(opciones.size ?? 7).fillColor(opciones.color ?? SRI_TINTA).text(valor, x, y, { width: w, align: opciones.align ?? "left", lineBreak: true });
  return doc.y;
}
function caja(doc, r) {
  doc.lineWidth(0.8).strokeColor(SRI_TINTA).rect(r.x, r.y, r.w, r.h).stroke();
}
function filaEtiquetaValor2(doc, x, y, w, etiqueta, valor, opciones = {}) {
  const anchoEtiqueta = opciones.etiquetaAncho ?? Math.min(88, w * 0.42);
  texto(doc, etiqueta, x, y, anchoEtiqueta, { bold: true, size: opciones.etiquetaSize ?? 6.8 });
  texto(doc, valor, x + anchoEtiqueta, y, w - anchoEtiqueta, {
    size: 6.8,
    bold: opciones.bold,
    align: opciones.valorAlign ?? "left"
  });
  return Math.max(doc.y, y + 9);
}
function dibujarCabeceraSRI(doc, cab) {
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  const y0 = SRI_MARGEN;
  const altoCabecera = 205;
  const anchoIzquierda = Math.floor(anchoUtil * 0.455);
  const anchoDerecha = anchoUtil - anchoIzquierda;
  caja(doc, { x: SRI_MARGEN, y: y0, w: anchoIzquierda, h: altoCabecera });
  let y = y0 + SRI_PADDING;
  const xIzq = SRI_MARGEN + SRI_PADDING;
  const anchoTextoIzq = anchoIzquierda - SRI_PADDING * 2;
  if (cab.logo) {
    try {
      doc.image(cab.logo.slice().buffer, xIzq, y, { fit: [120, 54] });
    } catch {
      throw new RideError("El logo del emisor no se pudo procesar.", "RIDE_INVALID_LOGO");
    }
    y += 58;
  } else {
    texto(doc, "NO TIENE LOGO", xIzq, y, anchoTextoIzq, { bold: true, size: 13, color: SRI_ROJO });
    y += 34;
  }
  texto(doc, cab.razonSocial, xIzq, y, anchoTextoIzq, { bold: true, size: 8.5 });
  y = Math.max(doc.y, y + 10) + 8;
  for (const [etiqueta, valor] of [
    ["Direcci\xF3n Matriz:", cab.dirMatriz],
    ["Direcci\xF3n Sucursal:", cab.dirEstablecimiento ?? ""]
  ]) {
    y = filaEtiquetaValor2(doc, xIzq, y, anchoTextoIzq, etiqueta, valor, { etiquetaAncho: 92 }) + 2;
  }
  if (cab.contribuyenteEspecial) {
    y = filaEtiquetaValor2(doc, xIzq, y, anchoTextoIzq, "Contribuyente Especial Nro", cab.contribuyenteEspecial, {
      etiquetaAncho: 92
    }) + 2;
  }
  for (const [etiqueta, valor] of cab.lineasExtra ?? []) {
    y = filaEtiquetaValor2(doc, xIzq, y, anchoTextoIzq, etiqueta, valor, { etiquetaAncho: 92 }) + 2;
  }
  if (cab.obligadoContabilidad) {
    filaEtiquetaValor2(doc, xIzq, y, anchoTextoIzq, "OBLIGADO A LLEVAR CONTABILIDAD", cab.obligadoContabilidad, {
      etiquetaAncho: 150,
      valorAlign: "right"
    });
  }
  const xDer = SRI_MARGEN + anchoIzquierda;
  caja(doc, { x: xDer, y: y0, w: anchoDerecha, h: altoCabecera });
  const xTextoDer = xDer + SRI_PADDING;
  const anchoTextoDer = anchoDerecha - SRI_PADDING * 2;
  y = y0 + SRI_PADDING;
  y = filaEtiquetaValor2(doc, xTextoDer, y, anchoTextoDer, "R.U.C.:", cab.ruc, { etiquetaAncho: 38 }) + 2;
  texto(doc, cab.titulo, xTextoDer, y, anchoTextoDer, { bold: true, size: 13 });
  y = Math.max(doc.y, y + 17) + 2;
  y = filaEtiquetaValor2(doc, xTextoDer, y, anchoTextoDer, "No.", cab.numero, { etiquetaAncho: 26 }) + 4;
  texto(doc, "N\xDAMERO DE AUTORIZACI\xD3N", xTextoDer, y, anchoTextoDer, { size: 6.8 });
  y += 9;
  texto(doc, cab.autorizacion?.numero ?? "COMPROBANTE NO AUTORIZADO", xTextoDer, y, anchoTextoDer, {
    bold: true,
    size: 6.5,
    color: cab.autorizacion ? SRI_TINTA : SRI_ROJO
  });
  y = Math.max(doc.y, y + 8) + 2;
  y = filaEtiquetaValor2(doc, xTextoDer, y, anchoTextoDer, "FECHA Y HORA DE AUTORIZACI\xD3N:", cab.autorizacion?.fecha ?? "", {
    etiquetaAncho: 130,
    etiquetaSize: 6.2,
    valorAlign: "right"
  }) + 6;
  y = filaEtiquetaValor2(
    doc,
    xTextoDer,
    y,
    anchoTextoDer,
    "AMBIENTE:",
    etiquetaCatalogo(LABEL_AMBIENTE, cab.ambiente),
    { etiquetaAncho: 108 }
  ) + 2;
  y = filaEtiquetaValor2(
    doc,
    xTextoDer,
    y,
    anchoTextoDer,
    "EMISI\xD3N:",
    etiquetaCatalogo(LABEL_TIPO_EMISION, cab.tipoEmision),
    { etiquetaAncho: 108 }
  ) + 3;
  texto(doc, "CLAVE DE ACCESO", xTextoDer, y, anchoTextoDer, { size: 7.5 });
  y += 12;
  dibujarCode128(doc, cab.claveAcceso, { x: xTextoDer, y, ancho: anchoTextoDer, alto: 26 });
  y += 28;
  texto(doc, cab.claveAcceso, xTextoDer, y, anchoTextoDer, { size: 6, align: "center" });
  return y0 + altoCabecera;
}
function dibujarCabeceraDocumentoSRI(doc, datos) {
  return dibujarCabeceraSRI(doc, {
    titulo: datos.titulo,
    razonSocial: datos.infoTributaria.razonSocial,
    ruc: datos.infoTributaria.ruc,
    numero: `${datos.infoTributaria.estab}-${datos.infoTributaria.ptoEmi}-${datos.infoTributaria.secuencial}`,
    ambiente: datos.infoTributaria.ambiente,
    tipoEmision: datos.infoTributaria.tipoEmision ?? "1",
    claveAcceso: datos.claveAcceso,
    autorizacion: datos.autorizacion,
    logo: datos.logo,
    dirMatriz: datos.infoTributaria.dirMatriz,
    dirEstablecimiento: datos.dirEstablecimiento,
    contribuyenteEspecial: datos.contribuyenteEspecial,
    obligadoContabilidad: datos.obligadoContabilidad,
    lineasExtra: datos.lineasExtra
  });
}
var ETIQUETAS_IDENTIFICACION = {
  "04": "RUC",
  "05": "C\xE9dula de Identidad",
  "06": "Pasaporte",
  "07": "Consumidor Final",
  "08": "Identificaci\xF3n del Exterior",
  "09": "Placa"
};
function etiquetaIdentificacionSRI(codigo) {
  return ETIQUETAS_IDENTIFICACION[codigo] ?? codigo;
}
function identificacionConTipoSRI(identificacion, tipo) {
  return tipo ? `${identificacion} (${etiquetaIdentificacionSRI(tipo)})` : identificacion;
}
function dibujarBandaSRI(doc, area, filas, opciones = {}) {
  const altoFila = opciones.altoFila ?? 18.5;
  const fraccion = opciones.fraccionDerecha ?? 0.55;
  const anchoEtiquetaIzq = opciones.anchoEtiquetaIzq ?? 140;
  const anchoEtiquetaDer = opciones.anchoEtiquetaDer ?? 76;
  const altoTitulo = opciones.titulo ? 12 : 0;
  const alto = altoTitulo + filas.length * altoFila;
  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });
  let y = area.y;
  if (opciones.titulo) {
    texto(doc, opciones.titulo, area.x + SRI_PADDING, y + 3, area.width - SRI_PADDING * 2, {
      bold: true,
      size: 7,
      align: "center"
    });
    y += altoTitulo;
  }
  const xDer = area.x + area.width * fraccion;
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const fy = y + i * altoFila + 4;
    if (fila.izquierda) {
      texto(doc, fila.izquierda.etiqueta, area.x + SRI_PADDING, fy, anchoEtiquetaIzq, { bold: true, size: 6.8 });
      texto(
        doc,
        fila.izquierda.valor,
        area.x + SRI_PADDING + anchoEtiquetaIzq,
        fy,
        area.width * fraccion - anchoEtiquetaIzq - SRI_PADDING,
        { size: 6.8 }
      );
    }
    if (fila.derecha) {
      texto(doc, fila.derecha.etiqueta, xDer, fy, anchoEtiquetaDer, { bold: true, size: 6.8 });
      texto(
        doc,
        fila.derecha.valor,
        xDer + anchoEtiquetaDer,
        fy,
        area.width * (1 - fraccion) - anchoEtiquetaDer - SRI_PADDING,
        { size: 6.8 }
      );
    }
  }
  return area.y + alto;
}
function dibujarTablaSRI(doc, area, columnas, filas, opciones = {}) {
  const altoEncabezado = opciones.altoEncabezado ?? 26;
  const altoFila = opciones.altoFila ?? 20;
  const tamanoCelda = opciones.tamanoCelda ?? 6.8;
  const suma = columnas.reduce((acc, col) => acc + col.peso, 0);
  const anchos = columnas.map((col) => Math.floor(area.width * col.peso / suma));
  anchos[anchos.length - 1] += area.width - anchos.reduce((a, b) => a + b, 0);
  let y = area.y;
  const limite = opciones.limite ?? doc.page.height - doc.page.margins.bottom;
  if (opciones.titulo) {
    texto(doc, opciones.titulo, area.x, y, area.width, { bold: true, size: 7 });
    y += 12;
  }
  const dibujarEncabezado = () => {
    doc.rect(area.x, y, area.width, altoEncabezado).fillAndStroke(SRI_GRIS, SRI_TINTA);
    let x = area.x;
    for (let i = 0; i < columnas.length; i++) {
      texto(doc, columnas[i].titulo, x + 2, y + 5, anchos[i] - 4, { bold: true, size: 6, align: "center" });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoEncabezado).stroke();
      x += anchos[i];
    }
    y += altoEncabezado;
  };
  if (y + altoEncabezado + altoFila > limite) {
    doc.addPage();
    y = SRI_MARGEN;
  }
  dibujarEncabezado();
  for (const fila of filas) {
    if (y + altoFila > limite) {
      doc.addPage();
      y = SRI_MARGEN;
      dibujarEncabezado();
    }
    doc.lineWidth(0.6).rect(area.x, y, area.width, altoFila).stroke();
    let x = area.x;
    for (let i = 0; i < columnas.length; i++) {
      texto(doc, fila[i] ?? "", x + 3, y + 5, anchos[i] - 6, { size: tamanoCelda, align: columnas[i].align });
      if (i > 0) doc.moveTo(x, y).lineTo(x, y + altoFila).stroke();
      x += anchos[i];
    }
    y += altoFila;
  }
  return y;
}
function columnasDetalle(conSubsidio) {
  const base = [
    { titulo: "Cod.\nPrincipal", peso: 8.5, align: "left" },
    { titulo: "Cod.\nAuxiliar", peso: 7.5, align: "left" },
    { titulo: "Cantidad", peso: 6.5, align: "right" },
    { titulo: "Descripci\xF3n", peso: 18.5, align: "left" },
    { titulo: "Detalle Adicional", peso: 11, align: "left" },
    { titulo: "Precio Unitario", peso: 8, align: "right" }
  ];
  if (conSubsidio) {
    base.push(
      { titulo: "Subsidio", peso: 6.5, align: "right" },
      { titulo: "Precio sin Subsidio", peso: 7.5, align: "right" }
    );
  }
  base.push({ titulo: "Descuento", peso: 7, align: "right" }, { titulo: "Precio Total", peso: 9, align: "right" });
  return base;
}
function celdasDetalle2(detalle, conSubsidio) {
  const extra = Object.entries(detalle.detallesAdicionales ?? {}).slice(0, 1).map(([k, v]) => `${k}: ${v}`).join("\n");
  const celdas = [
    detalle.codigoPrincipal ?? "",
    detalle.codigoAuxiliar ?? "",
    detalle.cantidad,
    detalle.descripcion,
    extra,
    formatMonto(detalle.precioUnitario, 2)
  ];
  if (conSubsidio) {
    celdas.push("0.00", formatMonto(detalle.precioTotalSinImpuesto, 2));
  }
  celdas.push(formatMonto(detalle.descuento, 2), formatMonto(detalle.precioTotalSinImpuesto, 2));
  return celdas;
}
function calcularFilasTotalesSRI(params) {
  const { impuestos, totalSinImpuestos, totalDescuento, propina, importeTotal } = params;
  const conSubtotales = params.opciones?.conSubtotales ?? true;
  const conDescuento = params.opciones?.conDescuento ?? true;
  const conPropina = params.opciones?.conPropina ?? true;
  const filas = [];
  const cero = basesPorcentaje(impuestos, "0");
  if (cero > 0) filas.push(["SUBTOTAL 0%", formatMonto(cero.toFixed(2), 2)]);
  const otros = /* @__PURE__ */ new Map();
  for (const imp of impuestos) {
    if (imp.codigo !== "2") continue;
    if (imp.codigoPorcentaje === "0" || imp.codigoPorcentaje === "6" || imp.codigoPorcentaje === "7") continue;
    otros.set(imp.codigoPorcentaje, (otros.get(imp.codigoPorcentaje) ?? 0) + Number(imp.baseImponible || 0));
  }
  for (const [porcentaje, base] of otros) {
    const etiqueta = { "2": "12%", "3": "14%", "4": "15%", "5": "5%" }[porcentaje] ?? `${porcentaje}%`;
    filas.push([`SUBTOTAL ${etiqueta}`, formatMonto(base.toFixed(2), 2)]);
  }
  if (conSubtotales) {
    filas.push(["SUBTOTAL NO OBJETO DE IVA", formatMonto(basesPorcentaje(impuestos, "6").toFixed(2), 2)]);
    filas.push(["SUBTOTAL EXENTO DE IVA", formatMonto(basesPorcentaje(impuestos, "7").toFixed(2), 2)]);
    filas.push(["SUBTOTAL SIN IMPUESTOS", formatMonto(totalSinImpuestos, 2)]);
  }
  if (conDescuento) {
    filas.push(["TOTAL DESCUENTO", formatMonto(totalDescuento ?? "0.00", 2)]);
  }
  filas.push(["ICE", formatMonto(sumarImpuesto(impuestos, "3").toFixed(2), 2)]);
  const iva = sumarImpuesto(impuestos, "2");
  if (iva > 0) filas.push(["IVA", formatMonto(iva.toFixed(2), 2)]);
  filas.push(["IRBPNR", formatMonto(sumarImpuesto(impuestos, "5").toFixed(2), 2)]);
  if (conPropina) {
    filas.push(["PROPINA", formatMonto(propina ?? "0.00", 2)]);
  }
  filas.push(["VALOR TOTAL", formatMonto(importeTotal, 2)]);
  return filas;
}
function sumarImpuesto(impuestos, codigo, porcentaje) {
  return impuestos.filter((i) => i.codigo === codigo && (porcentaje === void 0 || i.codigoPorcentaje === porcentaje)).reduce((total, i) => total + Number(i.valor || 0), 0);
}
function basesPorcentaje(impuestos, porcentaje) {
  return impuestos.filter((i) => i.codigo === "2" && i.codigoPorcentaje === porcentaje).reduce((total, i) => total + Number(i.baseImponible || 0), 0);
}
function dibujarTotalesSRI(doc, area, filas, opciones = {}) {
  const altoFilaPorDefecto = opciones.altoFila ?? 13;
  const tamano = opciones.tamano ?? 6.8;
  let y = area.y;
  for (const [etiqueta, valor, altoFila = altoFilaPorDefecto, tamanoEtiqueta] of filas) {
    doc.rect(area.x, y, area.width, altoFila).stroke();
    doc.moveTo(area.x + area.width * 0.68, y).lineTo(area.x + area.width * 0.68, y + altoFila).stroke();
    texto(doc, etiqueta, area.x + 4, y + (tamanoEtiqueta ? 3 : 4), area.width * 0.66, {
      size: tamanoEtiqueta ?? tamano
    });
    texto(doc, valor, area.x + area.width * 0.69, y + 4, area.width * 0.29, { size: tamano, align: "right" });
    y += altoFila;
  }
  return y;
}
function dibujarInformacionAdicionalSRI(doc, area, infoAdicional) {
  const info = Object.entries(infoAdicional ?? {}).filter(([, v]) => v.trim() !== "");
  const alto = Math.max(56, 18 + info.length * 12);
  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });
  texto(doc, "Informaci\xF3n Adicional", area.x + SRI_PADDING, area.y + 5, area.width - SRI_PADDING * 2, {
    size: 7,
    align: "center"
  });
  let y = area.y + 20;
  for (const [clave, valor] of info) {
    texto(doc, clave, area.x + SRI_PADDING, y, area.width * 0.32, { size: 6.5 });
    texto(doc, valor, area.x + SRI_PADDING + area.width * 0.32, y, area.width * 0.6, { size: 6.5 });
    y += 12;
  }
  return area.y + alto;
}
function dibujarFormasPagoSRI(doc, area, pagos, total) {
  const filas = pagos.length ? pagos : [{ formaPago: "", total }];
  const alto = 18 + filas.length * 14;
  caja(doc, { x: area.x, y: area.y, w: area.width, h: alto });
  doc.rect(area.x, area.y, area.width, 15).fillAndStroke(SRI_GRIS, SRI_TINTA);
  doc.moveTo(area.x + area.width * 0.7, area.y).lineTo(area.x + area.width * 0.7, area.y + alto).stroke();
  texto(doc, "Forma de pago", area.x + SRI_PADDING, area.y + 4, area.width * 0.7 - SRI_PADDING * 2, {
    bold: true,
    size: 6.5,
    align: "center"
  });
  texto(doc, "Valor", area.x + area.width * 0.72, area.y + 4, area.width * 0.26, {
    bold: true,
    size: 6.5,
    align: "right"
  });
  let y = area.y + 15;
  for (const pago of filas) {
    const etiqueta = pago.formaPago ? `${pago.formaPago} - ${formaPagoLabel(pago.formaPago)}` : "Sin utilizaci\xF3n del sistema financiero";
    texto(doc, etiqueta.toUpperCase(), area.x + SRI_PADDING, y + 4, area.width * 0.7 - SRI_PADDING * 2, { size: 6.5 });
    texto(doc, formatMonto(pago.total, 2), area.x + area.width * 0.72, y + 4, area.width * 0.26, {
      size: 6.5,
      align: "right"
    });
    doc.moveTo(area.x, y).lineTo(area.x + area.width, y).stroke();
    y += 14;
  }
  return area.y + alto;
}
function medirInformacionAdicionalSRI(infoAdicional) {
  const info = Object.entries(infoAdicional ?? {}).filter(([, v]) => v.trim() !== "");
  return Math.max(56, 18 + info.length * 12);
}
function dibujarPieSRI(doc, area, pie) {
  const anchoTotales = pie.filasTotales ? Math.floor(area.width * 0.405) : 0;
  const anchoIzq = pie.filasTotales ? area.width - anchoTotales - 8 : area.width;
  const xTotales = area.x + anchoIzq + 8;
  const altoInfo = medirInformacionAdicionalSRI(pie.infoAdicional);
  const altoPagos = pie.pagos ? 18 + Math.max(1, pie.pagos.length) * 14 : 0;
  const altoTotales = (pie.filasTotales ?? []).reduce((total, fila) => total + (fila[2] ?? 13), 0);
  let y = area.y;
  if (y + Math.max(altoInfo + (pie.pagos ? 4 + altoPagos : 0), altoTotales + 35) > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = SRI_MARGEN;
  }
  dibujarInformacionAdicionalSRI(doc, { x: area.x, y, width: anchoIzq }, pie.infoAdicional);
  if (pie.pagos) {
    dibujarFormasPagoSRI(doc, { x: area.x, y: y + altoInfo + 4, width: anchoIzq }, pie.pagos, pie.total ?? "0.00");
  }
  if (pie.filasTotales) {
    const yt = dibujarTotalesSRI(doc, { x: xTotales, y, width: anchoTotales }, pie.filasTotales);
    if (pie.qr) {
      dibujarQr(doc, pie.qr, { x: xTotales + anchoTotales - 52, y: yt + 6, size: 46 });
    }
  } else if (pie.qr) {
    dibujarQr(doc, pie.qr, { x: area.x + anchoIzq - 52, y: y + altoInfo + 6, size: 46 });
  }
}

// src/renderers/factura-sri.ts
var ESPACIADO_BLOQUE2 = 10;
function filasComprador2(documento) {
  const identificacion = documento.tipoIdentificacionComprador ? identificacionConTipoSRI(documento.identificacionComprador, documento.tipoIdentificacionComprador) : documento.identificacionComprador;
  return [
    {
      izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialComprador },
      derecha: { etiqueta: "Identificaci\xF3n:", valor: identificacion }
    },
    { izquierda: { etiqueta: "Fecha", valor: documento.fechaEmision } },
    {
      izquierda: { etiqueta: "Direccion:", valor: documento.direccionComprador ?? "" },
      derecha: { etiqueta: "Placa / Matr\xEDcula:", valor: documento.placa ?? "" }
    },
    { derecha: { etiqueta: "Gu\xEDa", valor: documento.guiaRemision ?? "" } }
  ];
}
async function generarRideFacturaSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "FACTURA",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad
  }) + ESPACIADO_BLOQUE2;
  y = dibujarBandaSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, filasComprador2(documento)) + 8;
  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    columnasDetalle(true),
    documento.detalles.map((detalle) => celdasDetalle2(detalle, true)),
    { limite: doc.page.height - SRI_MARGEN - 250 }
  ) + ESPACIADO_BLOQUE2;
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    pagos: documento.pagos,
    total: documento.importeTotal,
    filasTotales: [
      ...calcularFilasTotalesSRI({
        impuestos: documento.totalConImpuestos,
        totalSinImpuestos: documento.totalSinImpuestos,
        totalDescuento: documento.totalDescuento,
        propina: documento.propina,
        importeTotal: documento.importeTotal
      }),
      ["VALOR TOTAL SIN SUBSIDIO", formatMonto(documento.importeTotal, 2), 13, 6.5],
      ["AHORRO POR SUBSIDIO\n(Incluye IVA cuando corresponda)", "0.00", 22, 6.5]
    ],
    qr
  });
  return finalizar();
}

// src/renderers/liquidacion-compra.ts
var ESPACIADO_BLOQUE3 = 10;
var OPCIONES_DETALLE = { detallesAdicionales: 1, etiquetas: ETIQUETAS_DETALLE_COMPLETAS };
var ETIQUETAS_TOTALES = {
  subtotalCero: "SUBTOTAL 0%",
  subtotalNoObjeto: "SUBTOTAL NO OBJETO DE IVA",
  subtotalExento: "SUBTOTAL EXENTO DE IVA",
  descuento: "TOTAL DESCUENTO"
};
async function generarRideLiquidacionCompra(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE3;
  const filasProveedor = [
    { izquierda: { etiqueta: "Nombres y Apellidos:", valor: documento.razonSocialProveedor } },
    {
      izquierda: {
        etiqueta: "Identificaci\xF3n:",
        valor: identificacionConTipo(documento.identificacionProveedor, documento.tipoIdentificacionProveedor)
      }
    },
    { izquierda: { etiqueta: "Fecha Emision:", valor: documento.fechaEmision } }
  ];
  if (documento.direccionProveedor !== void 0 && documento.direccionProveedor.trim() !== "") {
    filasProveedor.push({ izquierda: { etiqueta: "Direcci\xF3n:", valor: documento.direccionProveedor } });
  }
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasProveedor, anchoUtil));
  y = drawBandaSujeto(doc, filasProveedor, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE3;
  y = drawTablaDetalles(doc, documento.detalles, { x: margenX, y, width: anchoUtil }, OPCIONES_DETALLE) + ESPACIADO_BLOQUE3;
  const totales = {
    impuestos: documento.totalConImpuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    totalDescuento: documento.totalDescuento,
    importeTotal: documento.importeTotal,
    moneda: documento.moneda,
    etiquetas: ETIQUETAS_TOTALES
  };
  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}

// src/renderers/liquidacion-compra-sri.ts
var ESPACIADO_BLOQUE4 = 10;
async function generarRideLiquidacionCompraSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "LIQUIDACI\xD3N DE COMPRA",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad
  }) + ESPACIADO_BLOQUE4;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialProveedor },
        derecha: {
          etiqueta: "Identificaci\xF3n:",
          valor: identificacionConTipoSRI(documento.identificacionProveedor, documento.tipoIdentificacionProveedor)
        }
      },
      {
        izquierda: { etiqueta: "Direcci\xF3n:", valor: documento.direccionProveedor ?? "" },
        derecha: { etiqueta: "Fecha Emisi\xF3n:", valor: documento.fechaEmision }
      }
    ],
    { titulo: "PROVEEDOR" }
  ) + ESPACIADO_BLOQUE4;
  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    columnasDetalle(true),
    documento.detalles.map((detalle) => celdasDetalle2(detalle, true)),
    { limite: doc.page.height - SRI_MARGEN - 250 }
  ) + ESPACIADO_BLOQUE4;
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    pagos: documento.pagos,
    total: documento.importeTotal,
    filasTotales: calcularFilasTotalesSRI({
      impuestos: documento.totalConImpuestos,
      totalSinImpuestos: documento.totalSinImpuestos,
      totalDescuento: documento.totalDescuento,
      importeTotal: documento.importeTotal
    }),
    qr
  });
  return finalizar();
}

// src/renderers/nota-credito.ts
var ESPACIADO_BLOQUE5 = 10;
var OPCIONES_DETALLE2 = { subsidio: false, etiquetas: ETIQUETAS_DETALLE_COMPLETAS };
async function generarRideNotaCredito(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe,
    rise: documento.rise
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE5;
  const comprador = {
    razonSocial: documento.razonSocialComprador,
    identificacion: documento.identificacionComprador,
    tipoIdentificacion: documento.tipoIdentificacionComprador,
    fechaEmision: documento.fechaEmision
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, comprador, anchoUtil));
  y = drawComprador(doc, comprador, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE5;
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasModifica(documento), anchoUtil));
  y = drawBandaSujeto(doc, filasModifica(documento), { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE5;
  y = drawTablaDetalles(doc, documento.detalles, { x: margenX, y, width: anchoUtil }, OPCIONES_DETALLE2) + ESPACIADO_BLOQUE5;
  const totales = {
    impuestos: documento.totalConImpuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    importeTotal: documento.valorModificacion,
    moneda: documento.moneda
  };
  const pie = { infoAdicional: documento.infoAdicional, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}
function filasModifica(documento) {
  return [
    {
      izquierda: {
        etiqueta: "Comprobante que se modifica",
        valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase()
      },
      derecha: { etiqueta: "", valor: documento.numDocModificado }
    },
    {
      izquierda: {
        etiqueta: "Fecha Emisi\xF3n (Comprobante a modificar)",
        valor: documento.fechaEmisionDocSustento
      }
    },
    { izquierda: { etiqueta: "Raz\xF3n de Modificaci\xF3n:", valor: documento.motivo } }
  ];
}

// src/renderers/nota-credito-sri.ts
var ESPACIADO_BLOQUE6 = 10;
async function generarRideNotaCreditoSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "NOTA DE CR\xC9DITO",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
    lineasExtra: documento.rise ? [["RISE:", documento.rise]] : void 0
  }) + ESPACIADO_BLOQUE6;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialComprador },
        derecha: {
          etiqueta: "Identificaci\xF3n:",
          valor: identificacionConTipoSRI(documento.identificacionComprador, documento.tipoIdentificacionComprador)
        }
      },
      { izquierda: { etiqueta: "Fecha Emisi\xF3n:", valor: documento.fechaEmision } }
    ],
    { titulo: "COMPRADOR" }
  ) + ESPACIADO_BLOQUE6;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: {
          etiqueta: "Comprobante que se modifica:",
          valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase()
        },
        derecha: { etiqueta: "N\xFAmero:", valor: documento.numDocModificado }
      },
      { izquierda: { etiqueta: "Fecha Emisi\xF3n:", valor: documento.fechaEmisionDocSustento } }
    ],
    { titulo: "DOCUMENTO MODIFICADO" }
  ) + ESPACIADO_BLOQUE6;
  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    columnasDetalle(false),
    documento.detalles.map((detalle) => celdasDetalle2(detalle, false)),
    { limite: doc.page.height - SRI_MARGEN - 250 }
  ) + ESPACIADO_BLOQUE6;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [{ izquierda: { etiqueta: "Raz\xF3n de Modificaci\xF3n:", valor: documento.motivo } }],
    { titulo: "MOTIVO" }
  ) + ESPACIADO_BLOQUE6;
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    filasTotales: calcularFilasTotalesSRI({
      impuestos: documento.totalConImpuestos,
      totalSinImpuestos: documento.totalSinImpuestos,
      importeTotal: documento.valorModificacion,
      opciones: { conDescuento: false, conPropina: false }
    }),
    qr
  });
  return finalizar();
}

// src/renderers/nota-debito.ts
var ESPACIADO_BLOQUE7 = 10;
var MOTIVO_COLUMN_SPECS = [
  ["RAZ\xD3N DE LA MODIFICACI\xD3N", 0.55, "left"],
  ["VALOR DE LA MODIFICACI\xD3N", 0.45, "right"]
];
async function generarRideNotaDebito(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe,
    rise: documento.rise
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE7;
  const comprador = {
    razonSocial: documento.razonSocialComprador,
    identificacion: documento.identificacionComprador,
    tipoIdentificacion: documento.tipoIdentificacionComprador,
    fechaEmision: documento.fechaEmision
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, comprador, anchoUtil));
  y = drawComprador(doc, comprador, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE7;
  const filasModifica2 = [
    {
      izquierda: {
        etiqueta: "Comprobante que se modifica",
        valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase()
      },
      derecha: { etiqueta: "", valor: documento.numDocModificado }
    },
    {
      izquierda: {
        etiqueta: "Fecha Emisi\xF3n (Comprobante a modificar)",
        valor: documento.fechaEmisionDocSustento
      }
    }
  ];
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasModifica2, anchoUtil));
  y = drawBandaSujeto(doc, filasModifica2, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE7;
  const columnasMotivos = construirColumnas(anchoUtil, MOTIVO_COLUMN_SPECS);
  const filasMotivos = documento.motivos.map((motivo) => [motivo.razon, formatMonto(motivo.valor, 2)]);
  y = drawTablaGenerica(doc, columnasMotivos, filasMotivos, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE7;
  const totales = {
    impuestos: documento.impuestos,
    totalSinImpuestos: documento.totalSinImpuestos,
    importeTotal: documento.valorTotal
  };
  const pie = { infoAdicional: documento.infoAdicional, pagos: documento.pagos, totales };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}

// src/renderers/nota-debito-sri.ts
var ESPACIADO_BLOQUE8 = 10;
async function generarRideNotaDebitoSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "NOTA DE D\xC9BITO",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
    lineasExtra: documento.rise ? [["RISE:", documento.rise]] : void 0
  }) + ESPACIADO_BLOQUE8;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialComprador },
        derecha: {
          etiqueta: "Identificaci\xF3n:",
          valor: identificacionConTipoSRI(documento.identificacionComprador, documento.tipoIdentificacionComprador)
        }
      },
      { izquierda: { etiqueta: "Fecha Emisi\xF3n:", valor: documento.fechaEmision } }
    ],
    { titulo: "COMPRADOR" }
  ) + ESPACIADO_BLOQUE8;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: {
          etiqueta: "Comprobante que se modifica:",
          valor: nombreDocumentoPorCodigo(documento.codDocModificado).toUpperCase()
        },
        derecha: { etiqueta: "N\xFAmero:", valor: documento.numDocModificado }
      },
      { izquierda: { etiqueta: "Fecha Emisi\xF3n:", valor: documento.fechaEmisionDocSustento } }
    ],
    { titulo: "DOCUMENTO MODIFICADO" }
  ) + ESPACIADO_BLOQUE8;
  y = dibujarTablaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      { titulo: "RAZ\xD3N DE LA MODIFICACI\xD3N", peso: 0.55, align: "left" },
      { titulo: "VALOR DE LA MODIFICACI\xD3N", peso: 0.45, align: "right" }
    ],
    documento.motivos.map((motivo) => [motivo.razon, formatMonto(motivo.valor, 2)]),
    { titulo: "MOTIVOS", altoFila: 16 }
  ) + ESPACIADO_BLOQUE8;
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    filasTotales: calcularFilasTotalesSRI({
      impuestos: documento.impuestos,
      totalSinImpuestos: documento.totalSinImpuestos,
      importeTotal: documento.valorTotal,
      opciones: { conDescuento: false, conPropina: false }
    }),
    qr
  });
  return finalizar();
}

// src/renderers/guia-remision.ts
var ESPACIADO_BLOQUE9 = 10;
var FRACCIONES_DOS_PARES = [0.26, 0.32, 0.19, 0.23];
var DESTINATARIO_DETALLE_COLUMN_SPECS = [
  ["Cantidad", 0.12, "right"],
  ["Descripcion", 0.48, "left"],
  ["C\xF3digo Principal", 0.2, "left"],
  ["C\xF3digo Auxiliar", 0.2, "left"]
];
function celdasDestinatarioDetalle(d) {
  const extras = d.detallesAdicionales ? `
${Object.entries(d.detallesAdicionales).map(([k, v]) => `${k}: ${v}`).join("\n")}` : "";
  return [
    formatCantidadPrecision(d.cantidad),
    `${d.descripcion}${extras}`,
    d.codigoInterno ?? "",
    d.codigoAdicional ?? ""
  ];
}
function filasDestinatario(destinatario) {
  const filas = [];
  if (destinatario.codDocSustento || destinatario.numDocSustento) {
    const tipo = destinatario.codDocSustento ? nombreDocumentoPorCodigo(destinatario.codDocSustento).toUpperCase() : "";
    const comprobante = [tipo, destinatario.numDocSustento ?? ""].filter((parte) => parte !== "").join("   ");
    filas.push(
      destinatario.fechaEmisionDocSustento ? {
        izquierda: { etiqueta: "Comprobante de Venta:", valor: comprobante },
        derecha: { etiqueta: "Fecha de Emisi\xF3n:", valor: destinatario.fechaEmisionDocSustento },
        fracciones: FRACCIONES_DOS_PARES
      } : { izquierda: { etiqueta: "Comprobante de Venta:", valor: comprobante } }
    );
  }
  const pares = [
    ["N\xFAmero de Autorizaci\xF3n:", destinatario.numAutDocSustento],
    ["Motivo Traslado:", destinatario.motivoTraslado],
    ["Destino(Punto de llegada)", destinatario.dirDestinatario],
    ["Identificaci\xF3n (Destinatario)", destinatario.identificacionDestinatario],
    ["Raz\xF3n Social/Nombres Apellidos", destinatario.razonSocialDestinatario],
    ["Documento Aduanero", destinatario.docAduaneroUnico],
    ["C\xF3digo Establecimiento Destino", destinatario.codEstabDestino],
    ["Ruta:", destinatario.ruta]
  ];
  for (const [etiqueta, valor] of pares) {
    if (valor !== void 0 && valor.trim() !== "") {
      filas.push({ izquierda: { etiqueta, valor } });
    }
  }
  return filas;
}
async function generarRideGuiaRemision(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe,
    rise: documento.rise
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE9;
  const filasTransportista = [
    {
      izquierda: {
        etiqueta: "Identificaci\xF3n (Transportista)",
        valor: identificacionConTipo(documento.rucTransportista, documento.tipoIdentificacionTransportista)
      }
    },
    { izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialTransportista } },
    { izquierda: { etiqueta: "Placa:", valor: documento.placa } },
    { izquierda: { etiqueta: "Punto de Partida:", valor: documento.dirPartida } },
    {
      izquierda: { etiqueta: "Fecha inicio Transporte", valor: documento.fechaIniTransporte },
      derecha: { etiqueta: "Fecha fin Transporte", valor: documento.fechaFinTransporte },
      fracciones: FRACCIONES_DOS_PARES
    }
  ];
  y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filasTransportista, anchoUtil));
  y = drawBandaSujeto(doc, filasTransportista, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE9;
  const columnasDetalle2 = construirColumnas(anchoUtil, DESTINATARIO_DETALLE_COLUMN_SPECS);
  for (const destinatario of documento.destinatarios) {
    const filas = filasDestinatario(destinatario);
    y = asegurarEspacio(doc, y, medirBandaSujeto(doc, filas, anchoUtil));
    y = drawBandaSujeto(doc, filas, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE9;
    const filasDetalle = destinatario.detalles.map(celdasDestinatarioDetalle);
    y = drawTablaGenerica(doc, columnasDetalle2, filasDetalle, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE9;
  }
  const pie = { infoAdicional: documento.infoAdicional };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}

// src/renderers/guia-remision-sri.ts
var ESPACIADO_BLOQUE10 = 10;
function celdasDestinatarioDetalle2(detalle) {
  const extras = detalle.detallesAdicionales ? `
${Object.entries(detalle.detallesAdicionales).map(([k, v]) => `${k}: ${v}`).join("\n")}` : "";
  return [detalle.cantidad, `${detalle.descripcion}${extras}`, detalle.codigoInterno ?? "", detalle.codigoAdicional ?? ""];
}
async function generarRideGuiaRemisionSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "GU\xCDA DE REMISI\xD3N",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad
  }) + ESPACIADO_BLOQUE10;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialTransportista },
        derecha: {
          etiqueta: "R.U.C.:",
          valor: identificacionConTipoSRI(documento.rucTransportista, documento.tipoIdentificacionTransportista)
        }
      },
      {
        izquierda: { etiqueta: "Placa:", valor: documento.placa },
        derecha: { etiqueta: "Punto de Partida:", valor: documento.dirPartida }
      },
      {
        izquierda: { etiqueta: "Fecha inicio Transporte:", valor: documento.fechaIniTransporte },
        derecha: { etiqueta: "Fecha fin Transporte:", valor: documento.fechaFinTransporte }
      }
    ],
    { titulo: "TRANSPORTISTA" }
  ) + ESPACIADO_BLOQUE10;
  for (const destinatario of documento.destinatarios) {
    y = dibujarBandaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        {
          izquierda: { etiqueta: "Identificaci\xF3n:", valor: destinatario.identificacionDestinatario },
          derecha: { etiqueta: "Motivo Traslado:", valor: destinatario.motivoTraslado }
        },
        { izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: destinatario.razonSocialDestinatario } },
        { izquierda: { etiqueta: "Direcci\xF3n:", valor: destinatario.dirDestinatario } }
      ],
      { titulo: "DESTINATARIO" }
    ) + ESPACIADO_BLOQUE10;
    y = dibujarTablaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        { titulo: "Cantidad", peso: 0.12, align: "right" },
        { titulo: "Descripci\xF3n", peso: 0.48, align: "left" },
        { titulo: "C\xF3digo Principal", peso: 0.2, align: "left" },
        { titulo: "C\xF3digo Auxiliar", peso: 0.2, align: "left" }
      ],
      destinatario.detalles.map(celdasDestinatarioDetalle2),
      { altoFila: 16 }
    ) + ESPACIADO_BLOQUE10;
  }
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    qr
  });
  return finalizar();
}

// src/renderers/retencion.ts
var ESPACIADO_BLOQUE11 = 10;
var RETENCION_COLUMN_SPECS = [
  ["Comprobante", 0.115, "left"],
  ["N\xFAmero", 0.15, "left"],
  ["Fecha Emisi\xF3n", 0.115, "center"],
  ["Ejercicio Fiscal", 0.11, "center"],
  ["Base Imponible para la Retenci\xF3n", 0.16, "right"],
  ["IMPUESTO", 0.12, "center"],
  ["Porcentaje Retenci\xF3n", 0.11, "right"],
  ["Valor Retenido", 0.12, "right"]
];
var LABEL_IMPUESTO_RETENCION = {
  "1": "RENTA",
  "2": "IVA",
  "6": "ISD"
};
function filasRetenciones(docsSustento, periodoFiscal) {
  const filas = [];
  for (const docSustento of docsSustento) {
    const identificacion = [
      nombreDocumentoPorCodigo(docSustento.codDocSustento).toUpperCase(),
      docSustento.numDocSustento,
      docSustento.fechaEmisionDocSustento,
      periodoFiscal
    ];
    if (docSustento.retenciones.length === 0) {
      filas.push([...identificacion, "", "", "", ""]);
      continue;
    }
    for (const retencion of docSustento.retenciones) {
      const impuesto = LABEL_IMPUESTO_RETENCION[retencion.codigo] ?? retencion.codigo;
      filas.push([
        ...identificacion,
        formatMonto(retencion.baseImponible, 2),
        `${impuesto} (${retencion.codigoRetencion})`,
        `${retencion.porcentajeRetener}%`,
        formatMonto(retencion.valorRetenido, 2)
      ]);
    }
  }
  return filas;
}
function totalRetenido(docsSustento) {
  let cents = 0;
  for (const docSustento of docsSustento) {
    for (const retencion of docSustento.retenciones) {
      cents += toCents(retencion.valorRetenido);
    }
  }
  return fromCents(cents);
}
var TITULO_DOC_SUSTENTO_DETALLE = "DETALLE DE DOCUMENTOS SUSTENTO";
function lineasDocumentosSustentoDetalle(documento) {
  const lineas = [
    `Total Retenido: ${totalRetenido(documento.docsSustento)}`
  ];
  if (documento.tipoSujetoRetenido) {
    lineas.push(`Tipo de Sujeto Retenido: ${documento.tipoSujetoRetenido}`);
  }
  if (documento.parteRel) {
    lineas.push(`Parte Relacionada: ${documento.parteRel}`);
  }
  for (const docSustento of documento.docsSustento) {
    lineas.push(
      `Documento Sustento: ${docSustento.codDocSustento} - ${docSustento.numDocSustento} (C\xF3digo de Sustento: ${docSustento.codSustento})`
    );
    lineas.push(`Total sin Impuestos: ${docSustento.totalSinImpuestos}`);
    lineas.push(`Importe Total: ${docSustento.importeTotal}`);
    for (const imp of docSustento.impuestosDocSustento) {
      let linea = `Impuesto: c\xF3digo ${imp.codImpuestoDocSustento}, % ${imp.codigoPorcentaje}, base imponible ${imp.baseImponible}, tarifa ${imp.tarifa}%, valor ${imp.valorImpuesto}`;
      if (imp.factorProporcionalidad) {
        linea += `, factor de proporcionalidad ${imp.factorProporcionalidad}`;
      }
      if (imp.baseImponibleModificada) {
        linea += `, base imponible modificada ${imp.baseImponibleModificada}`;
      }
      lineas.push(linea);
    }
    for (const pago of docSustento.pagos) {
      lineas.push(`Pago: ${formaPagoLabel(pago.formaPago)} - ${pago.total}`);
    }
  }
  return lineas;
}
async function generarRideRetencion(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const codigoBarras = opciones.opciones?.codigoBarras ?? true;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const margenX = doc.page.margins.left;
  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.page.margins.top;
  const emisor = {
    logo,
    razonSocial: documento.infoTributaria.razonSocial,
    nombreComercial: documento.infoTributaria.nombreComercial,
    dirMatriz: documento.infoTributaria.dirMatriz,
    dirEstablecimiento: documento.dirEstablecimiento,
    obligadoContabilidad: documento.obligadoContabilidad,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    agenteRetencion: documento.infoTributaria.agenteRetencion,
    contribuyenteRimpe: documento.infoTributaria.contribuyenteRimpe
  };
  const comprobante = {
    ruc: documento.infoTributaria.ruc,
    nombreDocumento: nombreDocumento(documento.tipo),
    numero: formatNumeroComprobante(documento.infoTributaria),
    ambiente: documento.infoTributaria.ambiente,
    tipoEmision: documento.infoTributaria.tipoEmision ?? "1",
    claveAcceso,
    autorizacion
  };
  const cabecera = { emisor, comprobante, qr, codigoBarras };
  y = asegurarEspacio(doc, y, medirCabecera(doc, cabecera, anchoUtil));
  y = drawCabecera(doc, cabecera, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE11;
  const sujetoRetenido = {
    razonSocial: documento.razonSocialSujetoRetenido,
    identificacion: documento.identificacionSujetoRetenido,
    tipoIdentificacion: documento.tipoIdentificacionSujetoRetenido,
    fechaEmision: documento.fechaEmision
  };
  y = asegurarEspacio(doc, y, medirComprador(doc, sujetoRetenido, anchoUtil));
  y = drawComprador(doc, sujetoRetenido, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE11;
  const columnas = construirColumnas(anchoUtil, RETENCION_COLUMN_SPECS);
  const filas = filasRetenciones(documento.docsSustento, documento.periodoFiscal);
  y = drawTablaGenerica(doc, columnas, filas, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE11;
  const lineasDetalleSustento = lineasDocumentosSustentoDetalle(documento);
  y = asegurarEspacio(doc, y, medirBloqueTexto(doc, TITULO_DOC_SUSTENTO_DETALLE, lineasDetalleSustento, anchoUtil));
  y = drawBloqueTexto(doc, TITULO_DOC_SUSTENTO_DETALLE, lineasDetalleSustento, { x: margenX, y, width: anchoUtil }) + ESPACIADO_BLOQUE11;
  const pie = { infoAdicional: documento.infoAdicional };
  y = asegurarEspacio(doc, y, medirPie(doc, pie, anchoUtil));
  drawPie(doc, pie, { x: margenX, y, width: anchoUtil });
  return finalizar();
}

// src/renderers/retencion-sri.ts
var ESPACIADO_BLOQUE12 = 10;
var LABEL_IMPUESTO_RETENCION2 = {
  "1": "RENTA",
  "2": "IVA",
  "6": "ISD"
};
function totalRetenido2(docsSustento) {
  let cents = 0;
  for (const docSustento of docsSustento) {
    for (const retencion of docSustento.retenciones) {
      cents += toCents(retencion.valorRetenido);
    }
  }
  return fromCents(cents);
}
async function generarRideRetencionSri(opciones) {
  const { documento, claveAcceso, autorizacion, logo } = opciones;
  const incluirQr = opciones.opciones?.incluirQr ?? false;
  const tamano = opciones.opciones?.tamano ?? "A4";
  const { doc, finalizar } = await crearDocumentoRide(tamano);
  const qr = incluirQr ? await crearQrMatrix(claveAcceso) : void 0;
  const anchoUtil = doc.page.width - SRI_MARGEN * 2;
  let y = dibujarCabeceraDocumentoSRI(doc, {
    infoTributaria: documento.infoTributaria,
    titulo: "COMPROBANTE DE RETENCI\xD3N",
    claveAcceso,
    autorizacion,
    logo,
    dirEstablecimiento: documento.dirEstablecimiento,
    contribuyenteEspecial: documento.contribuyenteEspecial,
    obligadoContabilidad: documento.obligadoContabilidad,
    lineasExtra: documento.infoTributaria.agenteRetencion ? [["Agente de Retenci\xF3n:", documento.infoTributaria.agenteRetencion]] : void 0
  }) + ESPACIADO_BLOQUE12;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [
      {
        izquierda: { etiqueta: "Raz\xF3n Social / Nombres y Apellidos:", valor: documento.razonSocialSujetoRetenido },
        derecha: {
          etiqueta: "Identificaci\xF3n:",
          valor: identificacionConTipoSRI(
            documento.identificacionSujetoRetenido,
            documento.tipoIdentificacionSujetoRetenido
          )
        }
      }
    ],
    { titulo: "SUJETO RETENIDO" }
  ) + ESPACIADO_BLOQUE12;
  y = dibujarBandaSRI(
    doc,
    { x: SRI_MARGEN, y, width: anchoUtil },
    [{ izquierda: { etiqueta: "Per\xEDodo Fiscal:", valor: documento.periodoFiscal } }],
    { titulo: "PER\xCDODO FISCAL" }
  ) + ESPACIADO_BLOQUE12;
  for (const docSustento of documento.docsSustento) {
    y = dibujarBandaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        {
          izquierda: {
            etiqueta: "Comprobante:",
            valor: nombreDocumentoPorCodigo(docSustento.codDocSustento).toUpperCase()
          },
          derecha: { etiqueta: "N\xFAmero:", valor: docSustento.numDocSustento }
        },
        {
          izquierda: { etiqueta: "Fecha Emisi\xF3n:", valor: docSustento.fechaEmisionDocSustento },
          derecha: { etiqueta: "N\xFAmero de Autorizaci\xF3n:", valor: docSustento.numAutDocSustento ?? "" }
        }
      ],
      { titulo: "DOCUMENTO SUSTENTO" }
    ) + ESPACIADO_BLOQUE12;
    y = dibujarTablaSRI(
      doc,
      { x: SRI_MARGEN, y, width: anchoUtil },
      [
        { titulo: "IMPUESTO", peso: 0.2, align: "left" },
        { titulo: "C\xD3DIGO", peso: 0.15, align: "left" },
        { titulo: "BASE IMPONIBLE", peso: 0.25, align: "right" },
        { titulo: "%", peso: 0.12, align: "right" },
        { titulo: "VALOR RETENIDO", peso: 0.28, align: "right" }
      ],
      docSustento.retenciones.map((retencion) => [
        LABEL_IMPUESTO_RETENCION2[retencion.codigo] ?? retencion.codigo,
        retencion.codigoRetencion,
        formatMonto(retencion.baseImponible, 2),
        `${retencion.porcentajeRetener}%`,
        formatMonto(retencion.valorRetenido, 2)
      ]),
      { titulo: "RETENCIONES", altoFila: 16 }
    ) + ESPACIADO_BLOQUE12;
  }
  dibujarPieSRI(doc, { x: SRI_MARGEN, y, width: anchoUtil }, {
    infoAdicional: documento.infoAdicional,
    filasTotales: [["TOTAL RETENIDO", formatMonto(totalRetenido2(documento.docsSustento), 2)]],
    qr
  });
  return finalizar();
}

// src/index.ts
async function generarRide(opciones) {
  try {
    const plantillaSri = opciones.opciones?.plantilla === "sri";
    switch (opciones.documento.tipo) {
      case "01":
        return plantillaSri ? await generarRideFacturaSri(opciones) : await generarRideFactura(opciones);
      case "03":
        return plantillaSri ? await generarRideLiquidacionCompraSri(opciones) : await generarRideLiquidacionCompra(opciones);
      case "04":
        return plantillaSri ? await generarRideNotaCreditoSri(opciones) : await generarRideNotaCredito(opciones);
      case "05":
        return plantillaSri ? await generarRideNotaDebitoSri(opciones) : await generarRideNotaDebito(opciones);
      case "06":
        return plantillaSri ? await generarRideGuiaRemisionSri(opciones) : await generarRideGuiaRemision(opciones);
      case "07":
        return plantillaSri ? await generarRideRetencionSri(opciones) : await generarRideRetencion(opciones);
      default:
        throw new RideError("Tipo de comprobante no soportado por el RIDE.", "RIDE_UNSUPPORTED_DOCUMENT");
    }
  } catch (error) {
    if (error instanceof RideError) {
      throw error;
    }
    throw new RideError("No se pudo renderizar el RIDE.", "RIDE_RENDER_FAILED", { cause: error });
  }
}
export {
  RideError,
  generarRide,
  generarRideFactura,
  generarRideFacturaSri,
  generarRideGuiaRemision,
  generarRideGuiaRemisionSri,
  generarRideLiquidacionCompra,
  generarRideLiquidacionCompraSri,
  generarRideNotaCredito,
  generarRideNotaCreditoSri,
  generarRideNotaDebito,
  generarRideNotaDebitoSri,
  generarRideRetencion,
  generarRideRetencionSri
};
//# sourceMappingURL=index.js.map