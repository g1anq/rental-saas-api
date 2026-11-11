import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter?: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  private getTransporter(): nodemailer.Transporter | undefined {
    if (this.transporter) {
      return this.transporter;
    }

    this.logger.warn('Không gửi được email vì SMTP_USER/SMTP_PASS chưa được cấu hình.');
    return undefined;
  }

  async sendInvoiceReminder(
    tenantEmail: string,
    tenantName: string,
    roomName: string,
    month: number,
    year: number,
    totalAmount: number,
    paymentLink?: string,
  ) {
    if (!tenantEmail) {
      this.logger.warn(`Không thể gửi email nhắc nợ cho ${tenantName} vì chưa có địa chỉ email.`);
      return false;
    }
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
    const formattedAmount = formatter.format(totalAmount);

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-md: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">Thông báo nhắc nợ tiền phòng</h2>
        <p>Xin chào <strong>${tenantName}</strong>,</p>
        <p>Đây là lời nhắc thanh toán tiền phòng <strong>${roomName}</strong> cho kỳ <strong>Tháng ${month}/${year}</strong>.</p>

        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">Tổng số tiền cần thanh toán:</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #dc2626;">${formattedAmount}</p>
        </div>
    `;

    if (paymentLink) {
      htmlContent += `
        <p style="text-align: center;">Bạn có thể quét mã QR dưới đây để thanh toán tự động:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${paymentLink}" alt="Mã thanh toán VietQR" style="max-width: 250px; border: 1px solid #ccc; border-radius: 10px; padding: 10px;" />
        </div>
      `;
    }

    htmlContent += `
        <p>Vui lòng thanh toán sớm để tránh bị cộng thêm phí phạt trễ hạn.</p>
        <p>Trân trọng,<br/>Quản lý nhà trọ</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: '"Rental SaaS" <noreply@rentalsaas.com>',
        to: tenantEmail,
        subject: `[Nhắc nhở] Thanh toán tiền phòng ${roomName} - Tháng ${month}/${year}`,
        html: htmlContent,
      });

      this.logger.log(`Email nhắc nợ đã được gửi tới ${tenantEmail} - MessageId: ${info.messageId}`);

      // Nếu dùng Ethereal (thử nghiệm), có thể xem nội dung email bằng link
      if (info.messageId && process.env.SMTP_HOST !== 'smtp.gmail.com') {
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          this.logger.log(`Preview URL: ${testUrl}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi email nhắc nợ cho ${tenantEmail}:`, error);
      return false;
    }
  }

  async sendNewInvoiceEmail(
    tenantEmail: string,
    tenantName: string,
    roomName: string,
    month: number,
    year: number,
    totalAmount: number,
    paymentLink?: string,
  ) {
    if (!tenantEmail) return false;
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
    const formattedAmount = formatter.format(totalAmount);

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-md: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #059669; text-align: center;">Thông báo Hóa đơn mới</h2>
        <p>Xin chào <strong>${tenantName}</strong>,</p>
        <p>Hóa đơn tiền phòng <strong>${roomName}</strong> cho kỳ <strong>Tháng ${month}/${year}</strong> đã được tạo.</p>

        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">Tổng số tiền thanh toán:</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #059669;">${formattedAmount}</p>
        </div>
    `;

    if (paymentLink) {
      htmlContent += `
        <p style="text-align: center;">Bạn có thể quét mã QR dưới đây để thanh toán tự động:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${paymentLink}" alt="Mã thanh toán VietQR" style="max-width: 250px; border: 1px solid #ccc; border-radius: 10px; padding: 10px;" />
        </div>
      `;
    }

    htmlContent += `
        <p>Vui lòng thanh toán sớm theo quy định của nhà trọ.</p>
        <p>Trân trọng,<br/>Quản lý nhà trọ</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: '"Rental SaaS" <noreply@rentalsaas.com>',
        to: tenantEmail,
        subject: `[Hóa đơn mới] Tiền phòng ${roomName} - Tháng ${month}/${year}`,
        html: htmlContent,
      });

      this.logger.log(`Email hóa đơn mới đã gửi tới ${tenantEmail} - MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi gửi email hóa đơn mới cho ${tenantEmail}:`, error);
      return false;
    }
  }
}
