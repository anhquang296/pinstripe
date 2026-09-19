import { createRequire } from 'node:module';

import _ from 'lodash';
import PDFDocument from 'pdfkit';

const PAGE_MARGIN = 56;
const DEFAULT_FONT_SIZE = 10;
const TITLE_FONT_SIZE = 18;
const ROW_GAP = 4;
const AMOUNT_COLUMN_WIDTH = 140;

const REGULAR_FONT = 'noto-sans-regular';
const BOLD_FONT = 'noto-sans-bold';

export interface PdfLine {
  text: string;
  amount?: string;
  isTitle?: boolean;
  isBold?: boolean;
}

function resolveFontPaths(): Record<string, string> {
  const require = createRequire(import.meta.url);

  return {
    [REGULAR_FONT]:
      require.resolve('@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf'),
    [BOLD_FONT]: require.resolve('@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf'),
  };
}

function writeLine(document: PDFKit.PDFDocument, line: PdfLine): void {
  const { text, amount, isTitle = false, isBold = false } = line;
  const font = isTitle || isBold ? BOLD_FONT : REGULAR_FONT;
  const fontSize = isTitle ? TITLE_FONT_SIZE : DEFAULT_FONT_SIZE;
  const contentWidth = document.page.width - PAGE_MARGIN * 2;
  const textWidth = amount ? contentWidth - AMOUNT_COLUMN_WIDTH : contentWidth;
  const top = document.y;

  document.font(font).fontSize(fontSize);
  document.text(text || ' ', PAGE_MARGIN, top, { width: textWidth });

  const bottom = document.y;

  if (amount) {
    document.text(amount, PAGE_MARGIN + textWidth, top, {
      width: AMOUNT_COLUMN_WIDTH,
      align: 'right',
    });
  }

  document.y = Math.max(bottom, document.y) + ROW_GAP;
}

export async function renderPdfDocument(lines: readonly PdfLine[]): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];

  _.forEach(resolveFontPaths(), (fontPath, fontName) => {
    document.registerFont(fontName, fontPath);
  });

  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    document.on('error', reject);
  });

  _.forEach(lines, (line) => {
    writeLine(document, line);
  });

  document.end();

  return finished;
}
