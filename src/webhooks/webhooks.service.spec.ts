import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction, InvoiceStatus } from '@prisma/client';
import { WebhooksService } from './webhooks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Test, TestingModule } from '@nestjs/testing';

describe('WebhooksService payment notifications', () => {
  const invoice = {
    id: 'invoice-1',
    invoiceCode: 'ABC123',
    month: 10,
    year: 2026,
    totalAmount: 1000,
    status: InvoiceStatus.UNPAID,
    contract: {
      roomId: 'room-1',
      tenantId: 'tenant-1',
      room: {
        id: 'room-1',
        name: 'Phòng 101',
        landlordId: 'landlord-1',
      },
    },
  };
  const tx = {
    invoice: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    invoice: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const notificationsService = {
    notifyTenantInvoicePaid: vi.fn(),
  };
  let service: WebhooksService;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get<WebhooksService>(WebhooksService);
  });

  it('records a payment audit log for a successful webhook payment', async () => {
    tx.invoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processSepayTransaction({
      transferAmount: 1000,
      content: 'RT ABC123',
    });

    expect(result.success).toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        landlordId: 'landlord-1',
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
    expect(notificationsService.notifyTenantInvoicePaid).toHaveBeenCalledWith(
      'tenant-1',
      {
        invoiceId: invoice.id,
        invoiceCode: invoice.invoiceCode,
        month: invoice.month,
        year: invoice.year,
        amount: invoice.totalAmount,
        roomName: invoice.contract.room.name,
      },
    );
  });

  it('does not log payments rejected as partial', async () => {
    const result = await service.processSepayTransaction({
      transferAmount: 500,
      content: 'RT ABC123',
    });

    expect(result.success).toBe(false);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(notificationsService.notifyTenantInvoicePaid).not.toHaveBeenCalled();
  });
});
