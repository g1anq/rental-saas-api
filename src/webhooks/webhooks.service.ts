import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditAction, InvoiceStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processSepayTransaction(payload: any) {
    try {
      this.logger.log(`Received SePay Webhook: ${JSON.stringify(payload)}`);

      // 1. Extract info from payload
      // Assuming SePay payload structure has: transferAmount, content
      const transferAmount = payload.transferAmount || payload.amountIn;
      const content = payload.content || payload.description || '';

      if (!content || !transferAmount) {
        this.logger.warn('Webhook missing content or transferAmount');
        return { success: false, message: 'Missing fields' };
      }

      // 2. Parse Invoice Code
      // We expect the user to transfer with content like "RT A8F1B9"
      // Let's extract words and look for a 6-character alphanumeric string following RT
      const match = content.match(/RT\s*([a-zA-Z0-9]{6})/i);
      if (!match) {
        this.logger.warn(`No valid invoice code found in content: ${content}`);
        return { success: false, message: 'No invoice code found' };
      }

      const invoiceCode = match[1].toUpperCase();

      // 3. Find Invoice
      const invoice = await this.prisma.invoice.findUnique({
        where: { invoiceCode },
        include: { contract: { include: { room: true } } },
      });

      if (!invoice) {
        this.logger.warn(`Invoice not found for code: ${invoiceCode}`);
        return { success: false, message: 'Invoice not found' };
      }

      if (invoice.status === InvoiceStatus.PAID) {
        this.logger.log(`Invoice ${invoiceCode} is already paid`);
        return { success: true, message: 'Already paid' };
      }

      // 4. Verify Amount
      // Usually, users should pay exactly the totalAmount or more.
      if (transferAmount >= invoice.totalAmount) {
        const markedPaid = await this.prisma.$transaction(async (tx) => {
          const result = await tx.invoice.updateMany({
            where: { id: invoice.id, status: { not: InvoiceStatus.PAID } },
            data: {
              status: InvoiceStatus.PAID,
              paidAt: new Date(),
            },
          });
          if (result.count === 0) {
            return false;
          }

          await tx.auditLog.create({
            data: {
              landlordId: invoice.contract.room.landlordId,
              action: AuditAction.INVOICE_PAID,
              entityType: 'Invoice',
              entityId: invoice.id,
              details: {
                invoiceCode: invoice.invoiceCode,
                roomId: invoice.contract.roomId,
                roomName: invoice.contract.room.name,
                amount: invoice.totalAmount,
                paymentMethod: 'webhook',
              },
            },
          });
          return true;
        });
        if (!markedPaid) {
          this.logger.log(`Invoice ${invoiceCode} is already paid`);
          return { success: true, message: 'Already paid' };
        }

        this.notificationsService.notifyTenantInvoicePaid(
          invoice.contract.tenantId,
          {
            invoiceId: invoice.id,
            invoiceCode: invoice.invoiceCode,
            month: invoice.month,
            year: invoice.year,
            amount: invoice.totalAmount,
            roomName: invoice.contract.room.name,
          },
        );

        this.logger.log(`Invoice ${invoiceCode} marked as PAID successfully via SePay`);
        return { success: true, message: 'Invoice marked as PAID' };
      } else {
        this.logger.warn(`Partial payment received for ${invoiceCode}: Expected ${invoice.totalAmount}, got ${transferAmount}`);
        return { success: false, message: 'Partial payment received, invoice not marked as paid' };
      }
    } catch (error) {
      this.logger.error('Error processing SePay webhook', error);
      return { success: false, message: 'Internal error processing webhook' };
    }
  }
}
