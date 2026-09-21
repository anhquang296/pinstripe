import type { SmtpConfig } from '@clients/smtp.client';
import { SmtpClient } from '@clients/smtp.client';
import fp from 'fastify-plugin';

export const notificationPlugin = fp(async (fastify) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = fastify.config;

  const smtpConfig: SmtpConfig = {
    smtpTransportOptions: { host: SMTP_HOST, port: SMTP_PORT, secure: false },
    fromName: SMTP_FROM_NAME,
    fromEmail: SMTP_FROM_EMAIL,
  };

  if (!SmtpClient.isConfigured(smtpConfig)) {
    fastify.log.warn('notificationPlugin() no SMTP host configured, mail will be skipped');
    fastify.decorate('mailer', null);

    return;
  }

  const mailer = new SmtpClient(smtpConfig, fastify.log);

  fastify.decorate('mailer', mailer);

  fastify.addHook('onClose', async () => {
    mailer.destroy();
  });
});
