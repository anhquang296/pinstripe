import _ from 'lodash';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const TOP_Y = 780;
const LINE_HEIGHT = 18;
const DEFAULT_FONT_SIZE = 11;
const TITLE_FONT_SIZE = 18;
const PDF_HEADER = '%PDF-1.4\n';

export interface PdfLine {
  text: string;
  isTitle?: boolean;
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
}

function buildContentStream(lines: readonly PdfLine[]): string {
  return _(lines)
    .map((line, index) => {
      const { isTitle = false } = line;
      const size = isTitle ? TITLE_FONT_SIZE : DEFAULT_FONT_SIZE;
      const y = TOP_Y - index * LINE_HEIGHT;

      return `BT /F1 ${size} Tf ${MARGIN_X} ${y} Td (${escapePdfText(line.text)}) Tj ET`;
    })
    .join('\n');
}

export function buildPdfDocument(lines: readonly PdfLine[]): Buffer {
  const content = buildContentStream(lines);
  const bodies = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  const offsets: number[] = [];

  let document = PDF_HEADER;

  for (const body of bodies) {
    offsets.push(Buffer.byteLength(document, 'latin1'));
    document += body;
  }

  const xrefOffset = Buffer.byteLength(document, 'latin1');
  const entries = _(offsets)
    .map((offset) => {
      return `${_.padStart(String(offset), 10, '0')} 00000 n \n`;
    })
    .join('');

  document += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${entries}`;
  document += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(document, 'latin1');
}
