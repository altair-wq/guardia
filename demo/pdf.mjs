// Minimal dependency-free PDF writer (one A4 page, Helvetica, WinAnsi so ç/ã/é render).
// Supports one optional hidden line drawn in white at 1pt: invisible to a human,
// but extracted by pdf-parse / pdftotext, which is exactly the injection attack.
import { writeFileSync } from "node:fs";

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function writePdf(path, title, lines, hidden) {
  const ops = [];
  ops.push("BT /F2 14 Tf 50 790 Td (" + esc(title) + ") Tj ET");
  let y = 760;
  for (const line of lines) {
    const bold = /^TOTAL|^URGENTE/.test(line);
    // Runs of 3+ spaces separate columns (used by the item table and the header row).
    const cols = line.split(/ {3,}/);
    const xs = [50, 330, 460];
    cols.forEach((c, i) => ops.push(`BT /${bold ? "F2" : "F1"} 10 Tf ${xs[i] ?? 50} ${y} Td (${esc(i < cols.length - 1 ? c + " " : c)}) Tj ET`));
    y -= 15;
  }
  if (hidden) ops.push(`1 1 1 rg BT /F1 1 Tf 50 40 Td (${esc(hidden)}) Tj ET 0 0 0 rg`);
  const content = Buffer.from(ops.join("\n"), "latin1");

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    null, // content stream
  ];
  // Pad past 8 KB with comment lines: pdf-parse 1.x (pdf.js 1.10) reads buf.buffer and ignores
  // byteOffset, and Node serves files under 4 KB from a shared pool, so tiny PDFs fail to parse.
  const pad = ("%" + " ".repeat(78) + "\n").repeat(110);
  const chunks = [Buffer.from("%PDF-1.4\n" + pad)];
  const offsets = [];
  let len = chunks[0].length;
  objs.forEach((o, i) => {
    const body =
      o === null
        ? Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")])
        : Buffer.from(o, "latin1");
    const buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    offsets.push(len);
    chunks.push(buf);
    len += buf.length;
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  writeFileSync(path, Buffer.concat(chunks));
}
