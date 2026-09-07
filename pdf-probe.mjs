import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const data = new Uint8Array(fs.readFileSync('C:/Users/Abrahams/Documents/Proyectos Personales/AFMI/baremos/BAREMOS RISLAB.pdf'));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
console.log('pages', doc.numPages);
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1 });
console.log('viewport', vp.width, vp.height);
const tc = await page.getTextContent();
for (const it of tc.items.slice(0, 12)) {
  console.log(JSON.stringify({ str: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), w: Math.round(it.width) }));
}
