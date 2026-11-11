import { describe, it, expect } from 'vitest';
import { beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  const mockPrisma = {
    property: { findFirst: vi.fn(), findMany: vi.fn() },
    room: { count: vi.fn() },
    tenant: { count: vi.fn() },
    contract: { count: vi.fn(), findMany: vi.fn() },
    invoice: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  };
  let controller: AppController;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.property.findFirst.mockResolvedValue({ id: 'property-1' });
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.tenant.count.mockResolvedValue(0);
    mockPrisma.contract.count.mockResolvedValue(0);
    mockPrisma.invoice.count.mockResolvedValue(0);
    mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.contract.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('filters every dashboard statistic by the selected property', async () => {
    await controller.getStats({ id: 'landlord-1' }, 'property-1');

    expect(mockPrisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: 'property-1', landlordId: 'landlord-1' },
      select: { id: true },
    });
    expect(mockPrisma.room.count).toHaveBeenCalledTimes(4);
    expect(mockPrisma.room.count).toHaveBeenCalledWith({
      where: { landlordId: 'landlord-1', propertyId: 'property-1' },
    });
    expect(mockPrisma.tenant.count).toHaveBeenCalledWith({
      where: {
        landlordId: 'landlord-1',
        contracts: {
          some: {
            room: { landlordId: 'landlord-1', propertyId: 'property-1' },
          },
        },
      },
    });
    expect(mockPrisma.contract.count).toHaveBeenCalledWith({
      where: {
        room: { landlordId: 'landlord-1', propertyId: 'property-1' },
        isActive: true,
      },
    });
    expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
      where: {
        contract: {
          room: { landlordId: 'landlord-1', propertyId: 'property-1' },
        },
        status: 'UNPAID',
      },
    });
    expect(mockPrisma.contract.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          room: { landlordId: 'landlord-1', propertyId: 'property-1' },
          isActive: false,
        },
      }),
    );
  });

  it('rejects a property that does not belong to the landlord', async () => {
    mockPrisma.property.findFirst.mockResolvedValue(null);

    await expect(
      controller.getStats({ id: 'landlord-1' }, 'other-property'),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.room.count).not.toHaveBeenCalled();
  });

  it('returns a 12-month revenue trend, occupancy rate, and three-month forecast', async () => {
    const now = new Date();
    const transactions = [100, 200, 300].map((amount, index) => ({
      amount,
      type: 'INCOME',
      date: new Date(now.getFullYear(), now.getMonth() - index - 1, 15),
      room: { propertyId: 'property-1' },
    }));
    mockPrisma.transaction.findMany.mockResolvedValue(transactions);
    mockPrisma.property.findMany.mockResolvedValue([
      { id: 'property-1', name: 'Khu A' },
    ]);
    mockPrisma.room.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const result = await controller.getAdvancedStats(
      { id: 'landlord-1' },
      'property-1',
    );

    expect(result.monthly).toHaveLength(12);
    expect(result.monthly.at(-1)).toMatchObject({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    expect(result.forecast).toEqual({
      revenue: 200,
      basedOnMonths: 3,
      method: 'average_of_previous_3_completed_months',
    });
    expect(result.occupancy).toEqual({
      total: 10,
      rented: 7,
      available: 2,
      maintenance: 1,
      rate: 70,
    });
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledTimes(2);
    for (const [query] of mockPrisma.transaction.findMany.mock.calls) {
      expect(query.where).toMatchObject({
        landlordId: 'landlord-1',
        room: { propertyId: 'property-1' },
      });
    }
  });

  it('rejects advanced analytics for a property owned by another landlord', async () => {
    mockPrisma.property.findFirst.mockResolvedValue(null);

    await expect(
      controller.getAdvancedStats({ id: 'landlord-1' }, 'other-property'),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('filters unpaid dashboard invoices by the selected property', async () => {
    await controller.getUnpaidInvoices(
      { id: 'landlord-1' },
      'property-1',
    );

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contract: {
            room: { landlordId: 'landlord-1', propertyId: 'property-1' },
          },
          status: { in: ['UNPAID', 'OVERDUE'] },
        },
      }),
    );
  });
});
