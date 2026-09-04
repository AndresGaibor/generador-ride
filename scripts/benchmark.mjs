#!/usr/bin/env bun
import { fork } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, '.tmp', 'benchmark.json');
const CLAVE = '12345678901234567890123456789012345678901234567';

const common = {
  ambiente: '1', razonSocial: 'EMPRESA TEST CIA. LTDA.', ruc: '1234567890001',
  estab: '001', ptoEmi: '001', secuencial: '000000001', dirMatriz: 'Av. Principal 123, Quito',
};
const detail = (i) => ({ descripcion: `Producto de prueba ${i + 1}`, cantidad: '1.000000', precioUnitario: '100.00', descuento: '10.00', precioTotalSinImpuesto: '100.00', impuestos: [{ codigo: '2', codigoPorcentaje: '2', tarifa: '12', baseImponible: '100.00', valor: '12.00' }] });
function factura(lines) {
  return { tipo: '01', infoTributaria: common, fechaEmision: '01/01/2024', tipoIdentificacionComprador: '04', razonSocialComprador: 'CLIENTE TEST S.A.', identificacionComprador: common.ruc, totalSinImpuestos: `${lines * 100}.00`, totalDescuento: `${lines * 10}.00`, importeTotal: `${lines * 112}.00`, totalConImpuestos: [{ codigo: '2', codigoPorcentaje: '2', baseImponible: `${lines * 100}.00`, valor: `${lines * 12}.00` }], detalles: Array.from({ length: lines }, (_, i) => detail(i)), pagos: [{ formaPago: '01', total: `${lines * 112}.00` }] };
}
const guia = { tipo: '06', infoTributaria: common, dirEstablecimiento: common.dirMatriz, dirPartida: common.dirMatriz, razonSocialTransportista: 'TRANSPORTISTA TEST S.A.', tipoIdentificacionTransportista: '04', rucTransportista: common.ruc, fechaIniTransporte: '01/01/2024', fechaFinTransporte: '02/01/2024', placa: 'ABC-1234', destinatarios: [{ identificacionDestinatario: common.ruc, razonSocialDestinatario: 'DESTINATARIO TEST', dirDestinatario: 'Calle Secundaria 456, Guayaquil', motivoTraslado: 'Venta', detalles: [{ descripcion: 'Mercaderia', cantidad: '10', codigoInterno: 'SKU001' }] }] };
const retencion = { tipo: '07', infoTributaria: common, fechaEmision: '01/01/2024', dirEstablecimiento: common.dirMatriz, tipoIdentificacionSujetoRetenido: '04', razonSocialSujetoRetenido: 'SUJETO RETENIDO TEST', identificacionSujetoRetenido: common.ruc, periodoFiscal: '012024', docsSustento: [{ codSustento: '1', codDocSustento: '01', numDocSustento: '001-001-000000001', fechaEmisionDocSustento: '01/01/2024', totalSinImpuestos: '1000.00', importeTotal: '1120.00', impuestosDocSustento: [{ codImpuestoDocSustento: '2', codigoPorcentaje: '2', baseImponible: '1000.00', tarifa: '12', valorImpuesto: '120.00' }], retenciones: [{ codigo: '2', codigoRetencion: '22', baseImponible: '1000.00', porcentajeRetener: '10', valorRetenido: '120.00' }], pagos: [{ formaPago: '01', total: '1120.00' }] }] };
const cases = [['factura-1-linea', factura(1)], ['factura-40-lineas', factura(40)], ['factura-100-lineas', factura(100)], ['retencion', retencion], ['guia', guia]];

if (process.argv[2] === '--child') {
  const { generarRide } = await import('../src/index.ts');
  const input = JSON.parse(process.argv[3]);
  const start = performance.now();
  const pdf = await generarRide({ documento: input, claveAcceso: CLAVE, autorizacion: { numero: CLAVE, fecha: '01/01/2024 12:00:00' }, opciones: { codigoBarras: true } });
  process.stdout.write(JSON.stringify({ durationMs: performance.now() - start, pdfBytes: pdf.byteLength }));
  process.exit(0);
}
if (process.argv[2] === '--warm-child') {
  const { generarRide } = await import('../src/index.ts');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const documento = JSON.parse(input);
  const results = [];
  for (let i = 0; i < 3; i += 1) {
    const start = performance.now();
    const pdf = await generarRide({ documento, claveAcceso: CLAVE, autorizacion: { numero: CLAVE, fecha: '01/01/2024 12:00:00' }, opciones: { codigoBarras: true } });
    results.push({ durationMs: performance.now() - start, pdfBytes: pdf.byteLength });
  }
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}

function run(documento) {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--child', JSON.stringify(documento)], { cwd: ROOT, execPath: process.execPath, silent: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(`benchmark child exited ${code}`)));
  });
}

const measurements = [];
for (const [name, documento] of cases) {
  const cold = [];
  for (let i = 0; i < 3; i += 1) cold.push(await run(documento));
  const warm = [];
  const warmChild = fork(fileURLToPath(import.meta.url), ['--warm-child'], { cwd: ROOT, execPath: process.execPath, silent: true });
  let output = '';
  warmChild.stdout.on('data', (chunk) => { output += chunk; });
  warmChild.stdin.end(JSON.stringify(documento) + '\n');
  await new Promise((resolve, reject) => { warmChild.on('error', reject); warmChild.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`warm benchmark child exited ${code}`))); });
  // The warm child emits one JSON array after repeated generations.
  warm.push(...JSON.parse(output));
  measurements.push({ name, cold, warm, pdfBytes: cold[0].pdfBytes });
}
const result = { generatedAt: new Date().toISOString(), bun: process.versions.bun, node: process.version, cases: measurements };
mkdirSync(join(ROOT, '.tmp'), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
