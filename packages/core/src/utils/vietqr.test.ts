import { buildTransferContent, buildVietQrPayload, computeCrc16 } from '@utils/vietqr';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

interface TlvField {
  id: string;
  value: string;
}

function parseTlv(payload: string): TlvField[] {
  const fields: TlvField[] = [];

  let cursor = 0;

  while (cursor < payload.length) {
    const id = payload.slice(cursor, cursor + 2);
    const length = Number(payload.slice(cursor + 2, cursor + 4));
    const value = payload.slice(cursor + 4, cursor + 4 + length);

    fields.push({ id, value });
    cursor += 4 + length;
  }

  return fields;
}

const TRANSFER = {
  bankBin: '970436',
  accountNumber: '0011001234567',
  amount: 1_500_000,
  content: 'INV000005',
};

describe('computeCrc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(computeCrc16('123456789')).toBe('29B1');
  });

  it('pads a short checksum to four hex digits', () => {
    expect(computeCrc16('')).toBe('FFFF');
  });
});

describe('buildVietQrPayload', () => {
  it('encodes the beneficiary bank, account, amount and content as EMVCo fields', () => {
    const payload = buildVietQrPayload(TRANSFER);
    const fields = parseTlv(payload);
    const merchantAccount = _.get(fields, '2.value', '');

    expect(_.map(fields, 'id')).toEqual(['00', '01', '38', '53', '54', '58', '62', '63']);
    expect(parseTlv(merchantAccount)).toEqual([
      { id: '00', value: 'A000000727' },
      { id: '01', value: '00069704360113' + '0011001234567' },
      { id: '02', value: 'QRIBFTTA' },
    ]);
    expect(fields[4]).toEqual({ id: '54', value: '1500000' });
    expect(fields[6]).toEqual({ id: '62', value: '0809INV000005' });
  });

  it('ends with the checksum of everything before it', () => {
    const payload = buildVietQrPayload(TRANSFER);

    expect(payload.slice(-4)).toBe(computeCrc16(payload.slice(0, -4)));
  });
});

describe('buildTransferContent', () => {
  it('keeps only letters and digits so every bank passes it through', () => {
    expect(buildTransferContent('INV-000005')).toBe('INV000005');
  });

  it('caps the content at 25 characters', () => {
    expect(buildTransferContent('inv-0000000000000000000000000000001')).toHaveLength(25);
  });
});
