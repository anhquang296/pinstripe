import { NodeEnvEnum } from '@pinstripe/core/config';
import { corePlugin } from '@pinstripe/core/plugins';
import Fastify from 'fastify';

import { seedCatalog } from './seed-catalog';
import { seedIntegrations } from './seed-integrations';
import { seedInvoices } from './seed-invoices';
import { seedOperators } from './seed-operators';
import { seedSubscriptions } from './seed-subscriptions';
import { seedUsage } from './seed-usage';
import { shiftHistory } from './shift-history';

function reportStep(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function runScript(): Promise<void> {
  const fastify = Fastify({ logger: { level: 'warn' } });

  await fastify.register(corePlugin);
  await fastify.ready();

  if (fastify.config.NODE_ENV === NodeEnvEnum.PRODUCTION) {
    await fastify.close();

    throw new Error('runScript() refusing to seed a production environment');
  }

  try {
    const catalog = await seedCatalog(fastify);

    reportStep('catalog: 3 sản phẩm, 4 bảng giá, 2 meter, VAT 10%, mã NHAXEMOI');

    const customers = await seedOperators(fastify);

    reportStep(`nhà xe: ${customers.length} khách hàng kèm mã số thuế và tài khoản portal`);

    const operators = await seedSubscriptions(fastify, catalog, customers);

    reportStep(`thuê bao: ${operators.length} subscription, tính tiền cuối kỳ`);

    const acceptedUsage = await seedUsage(fastify, operators);

    reportStep(`lượng dùng: ${acceptedUsage} meter event của kỳ hiện tại`);

    const invoices = await seedInvoices(fastify, catalog, operators);

    reportStep(
      `hoá đơn: ${invoices.paidCount} đã thu, ${invoices.draftCount} bản nháp chờ phát hành trên sân khấu`,
    );

    await seedIntegrations(fastify);

    reportStep('tích hợp: 1 webhook endpoint, 1 cấu hình billing portal');

    const shifted = await shiftHistory(fastify, invoices.backdated);

    reportStep(`lịch sử: lùi ngày ${shifted} hoá đơn về các kỳ trước`);

    reportStep('seed-demo hoàn tất');
  } finally {
    await fastify.close();
  }
}

try {
  await runScript();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
