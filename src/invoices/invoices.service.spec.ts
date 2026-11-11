import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { AuditAction } from '@prisma/client';
import { InvoicesService } from './invoices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

// ─── Mock PrismaService ───────────────────────────────────────────────────────
const mockPrisma = {
  contract: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  invoice: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  utilityReading: {
    findFirst: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

// ─── Mock MailService ────────────────────────────────────────────────────────
const mockMailService = {
  sendNewInvoiceEmail: vi.fn().mockResolvedValue(true),
  sendInvoiceReminder: vi.fn().mockResolvedValue(true),
};

// ─── Mock NotificationsService ────────────────────────────────────────────────
const mockNotificationsService = {
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  notifyTenantInvoicePaid: vi.fn(),
};

// ─── Dữ liệu mẫu ─────────────────────────────────────────────────────────────
const LANDLORD_ID = 'landlord-uuid-001';

const mockLandlord = {
  id: LANDLORD_ID,
  name: 'Giang Vương Huy',
  bankName: 'MB',
  bankAccount: '0988889999',
  bankAccountName: 'NGUYEN VAN CHU TRO',
  telegramChatId: null,
};

const mockRoom = {
  id: 'room-uuid-001',
  name: 'Phòng 101',
  price: 3000000,
  landlordId: LANDLORD_ID,
  landlord: mockLandlord,
};

const mockTenant = {
  id: 'tenant-uuid-001',
  fullName: 'Phạm Thị Mai',
  email: 'mai@test.com',
};

const mockContract = {
  id: 'contract-uuid-001',
  roomId: mockRoom.id,
  isActive: true,
  electricityRate: 3500,
  waterRate: 15000,
  customServices: [],
  roommates: [],
  room: mockRoom,
  tenant: mockTenant,
};

const mockInvoice = {
  id: 'invoice-uuid-001',
  invoiceCode: 'ABC123',
  contractId: 'contract-uuid-001',
  month: 10,
  year: 2026,
  rentAmount: 3000000,
  electricityAmount: 175000,
  waterAmount: 75000,
  customServicesAmount: 0,
  otherAmount: 0,
  totalAmount: 3250000,
  status: InvoiceStatus.UNPAID,
  paymentLink: null,
  notes: null,
  paidAt: null,
  contract: {
    ...mockContract,
    room: mockRoom,
    tenant: mockTenant,
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mặc định $transaction thực thi callback luôn
    mockPrisma.$transaction.mockImplementation((cb: any) =>
      typeof cb === 'function'
        ? cb(mockPrisma)
        : Promise.all(cb),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────────────────────
  describe('create()', () => {
    const createDto = {
      contractId: 'contract-uuid-001',
      month: 10,
      year: 2026,
      otherAmount: 0,
    };

    it('nên tạo hóa đơn thành công với chỉ số điện/nước hợp lệ', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(null); // Chưa tồn tại
      mockPrisma.utilityReading.findFirst.mockResolvedValue({
        electricityPrev: 100,
        electricityCurr: 150, // 50 kWh
        waterPrev: 10,
        waterCurr: 15,        // 5 m³
      });
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(createDto, LANDLORD_ID);

      expect(result).toBeDefined();
      expect(mockPrisma.invoice.create).toHaveBeenCalledOnce();

      // Kiểm tra tiền điện = 50 kWh × 3500 = 175,000
      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createArgs.data.electricityAmount).toBe(50 * 3500);

      // Kiểm tra tiền nước = 5 m³ × 15000 = 75,000
      expect(createArgs.data.waterAmount).toBe(5 * 15000);
    });

    it('tổng tiền = tiền phòng + điện + nước + phụ phí', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue({
        electricityPrev: 200,
        electricityCurr: 260, // 60 kWh × 3500 = 210,000
        waterPrev: 20,
        waterCurr: 28,        // 8 m³ × 15000 = 120,000
      });
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.create({ ...createDto, otherAmount: 50000 }, LANDLORD_ID);

      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      const expectedTotal = 3000000 + (60 * 3500) + (8 * 15000) + 50000; // 3,440,000
      expect(createArgs.data.totalAmount).toBe(expectedTotal);
    });

    it('nếu không có chỉ số điện/nước thì tiền điện/nước = 0', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue(null); // Không có chỉ số
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto, LANDLORD_ID);

      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createArgs.data.electricityAmount).toBe(0);
      expect(createArgs.data.waterAmount).toBe(0);
      expect(createArgs.data.totalAmount).toBe(3000000); // Chỉ tiền phòng
    });

    it('nên throw NotFoundException nếu hợp đồng không thuộc về landlord', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null); // Không tìm thấy

      await expect(service.create(createDto, LANDLORD_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('nên throw BadRequestException nếu hợp đồng đã kết thúc', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...mockContract,
        isActive: false, // Hợp đồng đã kết thúc
      });

      await expect(service.create(createDto, LANDLORD_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('nên throw ConflictException nếu hóa đơn tháng này đã tồn tại', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice); // Đã tồn tại!

      await expect(service.create(createDto, LANDLORD_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('nên tạo VietQR paymentLink nếu landlord có thông tin ngân hàng', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract); // mockLandlord có bankName/bankAccount
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto, LANDLORD_ID);

      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      expect(createArgs.data.paymentLink).toContain('img.vietqr.io');
      expect(createArgs.data.paymentLink).toContain('MB-0988889999');
    });

    it('nên gửi email thông báo cho khách thuê sau khi tạo hóa đơn', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue({
        ...mockInvoice,
        contract: { ...mockInvoice.contract, tenant: { ...mockTenant, email: 'mai@test.com' } },
      });

      await service.create(createDto, LANDLORD_ID);

      // Email được gửi async (không await) — cần đợi event loop
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockMailService.sendNewInvoiceEmail).toHaveBeenCalledOnce();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TINH TOAN DIEN BẬC THANG (Tiered Electricity)
  // ──────────────────────────────────────────────────────────────────────────
  describe('create() — tính tiền điện bậc thang', () => {
    it('tính đúng tiền điện theo bậc thang: 50kWh bậc 1 (2000đ) + 20kWh bậc 2 (3000đ)', async () => {
      const tieredContract = {
        ...mockContract,
        electricityRate: 0, // Không dùng đơn giá flat
        customServices: [
          {
            type: 'ELECTRICITY_TIERED',
            tiers: [
              { limit: 50, price: 2000 },  // 0–50 kWh: 2000đ/kWh
              { limit: 100, price: 3000 }, // 51–100 kWh: 3000đ/kWh
            ],
          },
        ],
      };

      mockPrisma.contract.findUnique.mockResolvedValue(tieredContract);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue({
        electricityPrev: 0,
        electricityCurr: 70, // 70 kWh tổng
        waterPrev: 0,
        waterCurr: 0,
      });
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.create({ contractId: 'contract-uuid-001', month: 10, year: 2026 }, LANDLORD_ID);

      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      // 50 kWh × 2000 + 20 kWh × 3000 = 100,000 + 60,000 = 160,000
      expect(createArgs.data.electricityAmount).toBe(50 * 2000 + 20 * 3000);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TINH TOAN DICH VU PER_PERSON
  // ──────────────────────────────────────────────────────────────────────────
  describe('create() — dịch vụ tính theo người', () => {
    it('dịch vụ PER_PERSON tính nhân với số người trong phòng', async () => {
      const contractWithRoommates = {
        ...mockContract,
        roommates: [{ id: 'rm1' }, { id: 'rm2' }], // 2 người thêm → tổng 3 người
        customServices: [
          { type: 'PER_PERSON', name: 'Dịch vụ wifi', amount: 50000 },
        ],
      };

      mockPrisma.contract.findUnique.mockResolvedValue(contractWithRoommates);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.utilityReading.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      await service.create({ contractId: 'contract-uuid-001', month: 10, year: 2026 }, LANDLORD_ID);

      const createArgs = mockPrisma.invoice.create.mock.calls[0][0];
      // 1 khách chính + 2 người ở cùng = 3 người × 50,000 = 150,000
      const expectedCustom = 3 * 50000;
      // totalAmount = tiền phòng (3,000,000) + dịch vụ (150,000)
      expect(createArgs.data.totalAmount).toBe(3000000 + expectedCustom);
    });
  });

  describe('update() — audit log thanh toán', () => {
    it('records an audit log when an invoice is marked paid', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        contract: {
          ...mockInvoice.contract,
          room: mockRoom,
          tenant: mockTenant,
        },
      };
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(paidInvoice);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.update(
        mockInvoice.id,
        { status: InvoiceStatus.PAID },
        LANDLORD_ID,
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          landlordId: LANDLORD_ID,
          action: AuditAction.INVOICE_PAID,
          entityType: 'Invoice',
          entityId: mockInvoice.id,
          details: {
            invoiceCode: mockInvoice.invoiceCode,
            roomId: mockRoom.id,
            roomName: mockRoom.name,
            amount: mockInvoice.totalAmount,
            paymentMethod: 'manual',
          },
        },
      });
      expect(
        mockNotificationsService.notifyTenantInvoicePaid,
      ).toHaveBeenCalledWith(mockTenant.id, {
        invoiceId: mockInvoice.id,
        invoiceCode: mockInvoice.invoiceCode,
        month: mockInvoice.month,
        year: mockInvoice.year,
        amount: mockInvoice.totalAmount,
        roomName: mockRoom.name,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE BULK
  // ──────────────────────────────────────────────────────────────────────────
  describe('createBulk()', () => {
    it('nên throw BadRequestException nếu không có hợp đồng nào đang hiệu lực', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]); // Không có hợp đồng

      await expect(
        service.createBulk({ month: 10, year: 2026 }, LANDLORD_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên bỏ qua hóa đơn đã tồn tại (ConflictException) và tiếp tục', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 'contract-1' },
        { id: 'contract-2' },
      ]);

      // Contract 1: thành công
      // Contract 2: đã có hóa đơn
      mockPrisma.contract.findUnique
        .mockResolvedValueOnce(mockContract) // contract-1 found
        .mockResolvedValueOnce(mockContract); // contract-2 found

      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(null)       // contract-1: chưa có HĐ
        .mockResolvedValueOnce(mockInvoice); // contract-2: đã có HĐ

      mockPrisma.utilityReading.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.createBulk({ month: 10, year: 2026 }, LANDLORD_ID);

      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FIND ALL
  // ──────────────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('nên tự động tạo paymentLink cho hóa đơn chưa có link', async () => {
      const invoiceWithoutLink = {
        ...mockInvoice,
        paymentLink: null, // Chưa có link
        contract: { ...mockInvoice.contract, room: { ...mockRoom, landlord: mockLandlord } },
      };
      mockPrisma.invoice.findMany.mockResolvedValue([invoiceWithoutLink]);

      const result: any = await service.findAll(LANDLORD_ID);

      expect(result[0].paymentLink).toContain('img.vietqr.io');
      expect(result[0].paymentLink).toContain('MB-0988889999');
    });

    it('nên giữ nguyên paymentLink nếu đã có sẵn trong DB', async () => {
      const existingLink = 'https://img.vietqr.io/existing-link';
      const invoiceWithLink = {
        ...mockInvoice,
        paymentLink: existingLink,
        contract: { ...mockInvoice.contract, room: { ...mockRoom, landlord: mockLandlord } },
      };
      mockPrisma.invoice.findMany.mockResolvedValue([invoiceWithLink]);

      const result: any = await service.findAll(LANDLORD_ID);

      expect(result[0].paymentLink).toBe(existingLink); // Không bị ghi đè
    });

    it('nên trả về cấu trúc phân trang khi có tham số page/limit', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([mockInvoice]);
      mockPrisma.invoice.count = vi.fn().mockResolvedValue(15);

      const result: any = await service.findAll(LANDLORD_ID, { page: 2, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 15);
      expect(result).toHaveProperty('page', 2);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('totalPages', 2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('nên trả về hóa đơn nếu tìm thấy và thuộc về landlord', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.findOne('invoice-uuid-001', LANDLORD_ID);

      expect(result.id).toBe('invoice-uuid-001');
    });

    it('nên throw NotFoundException nếu hóa đơn không tồn tại', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('invalid-id', LANDLORD_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // MARK OVERDUE
  // ──────────────────────────────────────────────────────────────────────────
  describe('markOverdueInvoices()', () => {
    it('nên đánh dấu OVERDUE cho tất cả hóa đơn UNPAID của tháng trước', async () => {
      const overdueInvoice = { id: 'overdue-invoice-1' };
      mockPrisma.invoice.findMany.mockResolvedValue([overdueInvoice]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markOverdueInvoices(LANDLORD_ID);

      expect(result.markedOverdue).toBe(1);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: InvoiceStatus.OVERDUE },
        }),
      );
    });

    it('nên trả về 0 nếu không có hóa đơn quá hạn', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]); // Không có hóa đơn quá hạn

      const result = await service.markOverdueInvoices(LANDLORD_ID);

      expect(result.markedOverdue).toBe(0);
      expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET REVENUE STATS
  // ──────────────────────────────────────────────────────────────────────────
  describe('getRevenueStats()', () => {
    it('nên trả về thống kê doanh thu 12 tháng trong năm', async () => {
      const paidInvoices = [
        { month: 1, totalAmount: 3000000, rentAmount: 2500000, electricityAmount: 300000, waterAmount: 200000 },
        { month: 3, totalAmount: 4000000, rentAmount: 3500000, electricityAmount: 300000, waterAmount: 200000 },
      ];
      mockPrisma.invoice.findMany.mockResolvedValue(paidInvoices);

      const result = await service.getRevenueStats(2026, LANDLORD_ID);

      expect(result.year).toBe(2026);
      expect(result.monthly).toHaveLength(12); // Đủ 12 tháng
      expect(result.monthly[0].totalRevenue).toBe(3000000); // Tháng 1
      expect(result.monthly[1].totalRevenue).toBe(0);       // Tháng 2 không có HĐ
      expect(result.monthly[2].totalRevenue).toBe(4000000); // Tháng 3
      expect(result.totalRevenue).toBe(7000000); // Tổng cả năm
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SEND REMINDER
  // ──────────────────────────────────────────────────────────────────────────
  describe('sendReminder()', () => {
    it('nên throw BadRequestException nếu hóa đơn đã thanh toán', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        contract: { room: mockRoom, tenant: mockTenant },
      });

      await expect(
        service.sendReminder('invoice-uuid-001', LANDLORD_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên throw BadRequestException nếu khách thuê chưa có email', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.UNPAID,
        contract: {
          room: mockRoom,
          tenant: { ...mockTenant, email: null }, // Không có email
        },
      });

      await expect(
        service.sendReminder('invoice-uuid-001', LANDLORD_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên gửi email nhắc nợ thành công', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.UNPAID,
        contract: { room: mockRoom, tenant: mockTenant },
      });
      mockMailService.sendInvoiceReminder.mockResolvedValue(true);

      const result = await service.sendReminder('invoice-uuid-001', LANDLORD_ID);

      expect(result.success).toBe(true);
      expect(mockMailService.sendInvoiceReminder).toHaveBeenCalledOnce();
    });
  });
});
