import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Chạy vào 8h sáng mỗi ngày để kiểm tra hóa đơn quá hạn
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleOverdueInvoices() {
    this.logger.log('Bắt đầu kiểm tra hóa đơn quá hạn...');
    const now = new Date();

    // Lấy tất cả hóa đơn UNPAID hoặc OVERDUE
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] },
      },
      include: {
        contract: {
          include: {
            room: { include: { landlord: true } },
            tenant: true,
          },
        },
      },
    });

    for (const invoice of invoices) {
      const landlord = invoice.contract.room.landlord;
      // Ngày xuất hóa đơn (mặc định mùng 1, hoặc theo landlord)
      const issueDate = new Date(invoice.year, invoice.month - 1, landlord.invoiceCreationDay || 1);
      // Hạn thanh toán
      const deadline = new Date(issueDate);
      deadline.setDate(deadline.getDate() + (landlord.paymentDeadlineDays || 5));

      const diffTime = now.getTime() - deadline.getTime();
      const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Cập nhật trạng thái nếu vừa quá hạn
      if (overdueDays > 0 && invoice.status === InvoiceStatus.UNPAID) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
        this.logger.log(`Đánh dấu hóa đơn ${invoice.id} quá hạn.`);
      }

      // Nhắc nhở nếu quá hạn 3 ngày hoặc 7 ngày
      if (overdueDays === 3 || overdueDays === 7) {
        this.logger.log(`Hóa đơn ${invoice.id} quá hạn ${overdueDays} ngày. Gửi thông báo cho khách...`);
        await this.notificationsService.notifyTenant(invoice.contract.tenant, invoice, overdueDays);
      }
    }
  }
}
