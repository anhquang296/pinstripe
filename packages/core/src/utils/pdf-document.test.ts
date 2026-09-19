import _ from 'lodash';
import { describe, expect, it } from 'vitest';

import { renderPdfDocument } from './pdf-document';

describe('renderPdfDocument', () => {
  it('opens with the pdf header and closes with the end marker', async () => {
    const document = await renderPdfDocument([{ text: 'Hóa đơn INV-0001', isTitle: true }]);
    const text = document.toString('latin1');

    expect(_.startsWith(text, '%PDF-')).toBe(true);
    expect(_.endsWith(_.trimEnd(text), '%%EOF')).toBe(true);
  });

  it('embeds a unicode font so Vietnamese text is drawn rather than replaced', async () => {
    const document = await renderPdfDocument([{ text: 'Nhà xe Phương Trang — phí duy trì' }]);
    const text = document.toString('latin1');

    expect(text).toContain('NotoSans');
    expect(text).toContain('/FontFile2');
  });

  it('uses the bold face for titles and bold lines', async () => {
    const document = await renderPdfDocument([
      { text: 'Hóa đơn', isTitle: true },
      { text: 'Tổng cộng', amount: '500.000 ₫', isBold: true },
    ]);
    const text = document.toString('latin1');

    expect(text).toContain('NotoSans-Bold');
  });

  it('draws a document long enough to need a second page', async () => {
    const lines = _.map(_.range(120), (index) => {
      return { text: `Dòng ${index}`, amount: `${index}.000 ₫` };
    });

    const document = await renderPdfDocument(lines);
    const pageCount = document.toString('latin1').match(/\/Type \/Page\b/g);

    expect(_.size(pageCount)).toBeGreaterThan(1);
  });
});
