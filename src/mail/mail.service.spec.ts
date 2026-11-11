import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';

describe('MailService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not make network requests or send mail without SMTP configuration', async () => {
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', '');
    const service = new MailService();

    await expect(
      service.sendNewInvoiceEmail(
        'tenant@example.com',
        'Tenant',
        'Room 1',
        1,
        2026,
        1000,
      ),
    ).resolves.toBe(false);
  });
});
