import _ from 'lodash';

const NAPAS_GUID = 'A000000727';
const TRANSFER_TO_ACCOUNT_SERVICE = 'QRIBFTTA';
const VND_NUMERIC_CODE = '704';
const COUNTRY_CODE = 'VN';
const CRC_FIELD_PREFIX = '6304';
const TRANSFER_CONTENT_LIMIT = 25;

export interface VietQrTransfer {
  bankBin: string;
  accountNumber: string;
  amount: number;
  content: string;
}

function buildField(id: string, value: string): string {
  return `${id}${_.padStart(String(value.length), 2, '0')}${value}`;
}

export function computeCrc16(payload: string): string {
  const POLYNOMIAL = 0x1021;

  let crc = 0xffff;

  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;

    for (const _bit of _.range(8)) {
      crc = crc & 0x8000 ? ((crc << 1) ^ POLYNOMIAL) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return _.padStart(crc.toString(16).toUpperCase(), 4, '0');
}

export function buildTransferContent(reference: string): string {
  return _.truncate(_.toUpper(reference.replace(/[^0-9A-Za-z]/g, '')), {
    length: TRANSFER_CONTENT_LIMIT,
    omission: '',
  });
}

export function buildVietQrPayload(transfer: VietQrTransfer): string {
  const beneficiary = buildField('00', transfer.bankBin) + buildField('01', transfer.accountNumber);
  const merchantAccount =
    buildField('00', NAPAS_GUID) +
    buildField('01', beneficiary) +
    buildField('02', TRANSFER_TO_ACCOUNT_SERVICE);
  const payloadWithoutCrc =
    buildField('00', '01') +
    buildField('01', '12') +
    buildField('38', merchantAccount) +
    buildField('53', VND_NUMERIC_CODE) +
    buildField('54', String(transfer.amount)) +
    buildField('58', COUNTRY_CODE) +
    buildField('62', buildField('08', transfer.content)) +
    CRC_FIELD_PREFIX;

  return `${payloadWithoutCrc}${computeCrc16(payloadWithoutCrc)}`;
}
