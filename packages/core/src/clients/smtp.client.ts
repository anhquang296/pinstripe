import type { FastifyBaseLogger } from 'fastify';
import { createTransport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

const DEFAULT_FROM_EMAIL = 'billing@pinstripe.test';

export type SmtpConfig = {
  smtpTransportOptions: SMTPTransport.Options;
  fromName?: string;
  fromEmail?: string;
};

export interface SendMailPayload {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}

export interface SendMailResult {
  messageId: string;
}

export class SmtpNotConfiguredError extends Error {
  constructor(message = 'Outbound mail is not configured') {
    super(message);
    this.name = 'SmtpNotConfiguredError';
  }
}

export class SmtpClient {
  private _transport: Mail;
  private _fromAddress: string;
  private _logger: FastifyBaseLogger;

  constructor(smtpConfig: SmtpConfig, logger: FastifyBaseLogger) {
    const { smtpTransportOptions, fromName, fromEmail } = smtpConfig;

    this._transport = createTransport(smtpTransportOptions);
    this._fromAddress = SmtpClient.buildFromAddress(fromName, fromEmail);
    this._logger = logger;
  }

  static isConfigured(smtpConfig: SmtpConfig): boolean {
    return Boolean(smtpConfig.smtpTransportOptions.host);
  }

  async sendMail(payload: SendMailPayload): Promise<SendMailResult> {
    try {
      const sent = await this._transport.sendMail({
        from: this._fromAddress,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      this._logger.info({ messageId: sent.messageId }, '[SmtpClient] sendMail() success');

      return { messageId: sent.messageId };
    } catch (error) {
      this._logger.error({ error }, '[SmtpClient] sendMail() error');

      throw error;
    }
  }

  destroy(): void {
    this._transport.close();
  }

  private static buildFromAddress(fromName?: string, fromEmail?: string): string {
    const address = fromEmail ?? DEFAULT_FROM_EMAIL;

    if (fromName) {
      return `"${fromName}" <${address}>`;
    }

    return address;
  }
}
