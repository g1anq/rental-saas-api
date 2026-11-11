import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service.js';
import { TenantNotificationsGateway } from './tenant-notifications.gateway.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly tenantNotificationsGateway: TenantNotificationsGateway,
  ) {}

  notifyTenantInvoicePaid(
    tenantId: string,
    notification: {
      invoiceId: string;
      invoiceCode: string | null;
      month: number;
      year: number;
      amount: number;
      roomName: string;
    },
  ) {
    this.tenantNotificationsGateway.notifyInvoicePaid(tenantId, notification);
  }

  /**
   * Gửi thông báo đến Bot Telegram của chủ trọ
   */
  async sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || !chatId) {
      this.logger.warn('Missing TELEGRAM_BOT_TOKEN or chatId');
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Telegram API error: ${error}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to send Telegram message', error);
      return false;
    }
  }

  /**
   * Mock Gửi SMS
   */
  async sendSms(phone: string, message: string): Promise<boolean> {
    this.logger.log(`[SMS MOCK] Sending SMS to ${phone}: ${message}`);
    // Thực tế sẽ dùng Twilio, eSMS, VHT, VietGuys...
    return true;
  }

  /**
   * Mock Gửi Zalo ZNS
   */
  async sendZaloZNS(phone: string, templateData: any): Promise<boolean> {
    this.logger.log(`[ZALO ZNS MOCK] Sending ZNS to ${phone} with data: ${JSON.stringify(templateData)}`);
    // Thực tế sẽ gọi Zalo for Business API
    return true;
  }

  /**
   * Tự động chọn kênh liên lạc để nhắc khách thuê
   */
  async notifyTenant(tenant: any, invoice: any, overdueDays: number) {
    const msg = `⚠️ Thông báo: Hóa đơn phòng ${invoice.contract.room.name} tháng ${invoice.month}/${invoice.year} đã quá hạn ${overdueDays} ngày. Tổng tiền: ${new Intl.NumberFormat('vi-VN').format(invoice.totalAmount)}đ. Vui lòng thanh toán sớm.`;

    // Luôn gửi SMS và Zalo (mock)
    if (tenant.phone) {
      await this.sendSms(tenant.phone, msg);
      await this.sendZaloZNS(tenant.phone, { invoiceId: invoice.id, overdueDays });
    }

    // Gửi Email nếu có
    if (tenant.email) {
      await this.mailService.sendInvoiceReminder(
        tenant.email,
        tenant.fullName,
        invoice.contract.room.name,
        invoice.month,
        invoice.year,
        invoice.totalAmount,
        invoice.paymentLink || undefined
      );
    }
  }
}
