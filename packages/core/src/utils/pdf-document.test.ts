import _ from 'lodash';
import { describe, expect, it } from 'vitest';

import { buildPdfDocument } from './pdf-document';

describe('buildPdfDocument', () => {
  it('opens with the pdf header and closes with the end marker', () => {
    const document = buildPdfDocument([{ text: 'Invoice IN-0001', isTitle: true }]);
    const text = document.toString('latin1');

    expect(_.startsWith(text, '%PDF-1.4')).toBe(true);
    expect(_.endsWith(_.trimEnd(text), '%%EOF')).toBe(true);
  });

  it('points every xref offset at the object it describes', () => {
    const document = buildPdfDocument([{ text: 'One line' }]);
    const text = document.toString('latin1');
    const offsets = _.map([...text.matchAll(/^(\d{10}) 00000 n $/gm)], (match) => {
      return Number(match[1]);
    });

    const [firstOffset = -1, , , , lastOffset = -1] = offsets;

    expect(offsets).toHaveLength(5);
    expect(text.slice(firstOffset, firstOffset + 5)).toBe('1 0 o');
    expect(text.slice(lastOffset, lastOffset + 5)).toBe('5 0 o');
  });

  it('escapes the characters that would break a pdf string', () => {
    const document = buildPdfDocument([{ text: 'Gói (Pro) 50% \\ rẻ' }]);
    const text = document.toString('latin1');

    expect(text).toContain('G?i \\(Pro\\) 50% \\\\ r?');
  });

  it('renders every line it is given', () => {
    const document = buildPdfDocument([{ text: 'First' }, { text: 'Second' }, { text: 'Third' }]);
    const text = document.toString('latin1');

    expect(text).toContain('(First) Tj');
    expect(text).toContain('(Second) Tj');
    expect(text).toContain('(Third) Tj');
  });
});
