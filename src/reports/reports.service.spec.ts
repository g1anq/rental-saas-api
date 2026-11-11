import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

const mockPrisma = {
  invoice: {
    findMany: vi.fn(),
  },
  property: {
    findMany: vi.fn(),
  },
  room: {
    findMany: vi.fn(),
  },
};

const LANDLORD_ID = 'landlord-uuid-001';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('nên throw BadRequestException nếu định dạng tháng không hợp lệ', async () => {
    await expect(
      service.exportMonthlyReport(LANDLORD_ID, 'invalid-month'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.exportMonthlyReport(LANDLORD_ID, '2026-13'),
    ).rejects.toThrow(BadRequestException);
  });

  it('nên tạo file Excel Buffer thành công với dữ liệu hợp lệ', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceCode: 'HD1026',
        month: 10,
        year: 2026,
        rentAmount: 3000000,
        electricityAmount: 200000,
        waterAmount: 100000,
        otherAmount: 50000,
        totalAmount: 3350000,
        status: 'PAID',
        paidAt: new Date('2026-10-15T10:00:00.000Z'),
        customServices: [],
        contract: {
          room: {
            name: 'Phòng 101',
            propertyId: 'prop-1',
            property: { name: 'Khu A' },
          },
          tenant: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
        },
      },
    ]);

    mockPrisma.property.findMany.mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Khu A',
        address: '123 Đường ABC',
        rooms: [{ id: 'room-1' }],
      },
    ]);

    mockPrisma.room.findMany.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Phòng 101',
        price: 3000000,
        status: 'RENTED',
        property: { name: 'Khu A' },
        contracts: [
          {
            deposit: 3000000,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            tenant: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
          },
        ],
      },
      {
        id: 'room-2',
        name: 'Phòng 102',
        price: 2500000,
        status: 'AVAILABLE',
        property: { name: 'Khu A' },
        contracts: [],
      },
    ]);

    const result = await service.exportMonthlyReport(LANDLORD_ID, '2026-10');

    expect(result).toBeDefined();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PAID',
          paidAt: {
            gte: new Date(2026, 9, 1),
            lt: new Date(2026, 10, 1),
          },
          contract: { room: { landlordId: LANDLORD_ID } },
        },
      }),
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result as Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Thu tiền',
      'Doanh thu theo khu',
      'Thống kê phòng',
    ]);
    expect(workbook.getWorksheet('Thu tiền')?.getCell('A1').value).toContain(
      'THÁNG 10/2026',
    );
    expect(workbook.getWorksheet('Thu tiền')?.getCell('A2').value).toBe('STT');
    expect(workbook.getWorksheet('Thu tiền')?.getCell('G3').value).toBe(3350000);
    expect(workbook.getWorksheet('Doanh thu theo khu')?.getCell('F3').value).toBe(
      3350000,
    );
    expect(workbook.getWorksheet('Thống kê phòng')?.getCell('B4').value).toBe(1);
    expect(workbook.getWorksheet('Thống kê phòng')?.getCell('C3').value).toBe('50%');
  });
});
