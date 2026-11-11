import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction, RoomStatus } from '@prisma/client';
import { ContractsService } from './contracts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';

describe('ContractsService audit logging', () => {
  const room = {
    id: 'room-1',
    name: 'Phòng 101',
    status: RoomStatus.AVAILABLE,
  };
  const tenant = { id: 'tenant-1', fullName: 'Nguyễn Văn A' };
  const contract = {
    id: 'contract-1',
    roomId: room.id,
    tenantId: tenant.id,
    isActive: true,
    endDate: new Date('2026-11-20T00:00:00.000Z'),
    room,
    tenant,
  };
  const tx = {
    contract: { create: vi.fn(), update: vi.fn() },
    room: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    room: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
    contract: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  let service: ContractsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<ContractsService>(ContractsService);
  });

  it('records contract creation in the same transaction', async () => {
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    tx.contract.create.mockResolvedValue(contract);
    tx.room.update.mockResolvedValue({ ...room, status: RoomStatus.RENTED });

    await service.create(
      {
        roomId: room.id,
        tenantId: tenant.id,
        startDate: '2026-10-01',
        deposit: 1000,
      },
      'landlord-1',
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        landlordId: 'landlord-1',
        action: AuditAction.CONTRACT_CREATED,
        entityType: 'Contract',
        entityId: contract.id,
        details: {
          roomId: room.id,
          roomName: room.name,
          tenantId: tenant.id,
          tenantName: tenant.fullName,
        },
      },
    });
  });

  it('records contract termination in the same transaction', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract);
    tx.contract.update.mockResolvedValue({ ...contract, isActive: false });
    tx.room.update.mockResolvedValue({ ...room, status: RoomStatus.AVAILABLE });

    await service.terminate(contract.id, 'landlord-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        landlordId: 'landlord-1',
        action: AuditAction.CONTRACT_TERMINATED,
        entityType: 'Contract',
        entityId: contract.id,
        details: {
          roomId: room.id,
          roomName: room.name,
          tenantId: tenant.id,
          tenantName: tenant.fullName,
        },
      },
    });
  });

  it('suggests active contracts ending within the selected number of days', async () => {
    const now = new Date();
    const expiring = {
      ...contract,
      endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    };
    prisma.contract.findMany.mockResolvedValue([expiring]);

    const result = await service.findRenewalSuggestions('landlord-1', 30);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const lastEligibleDate = new Date(today);
    lastEligibleDate.setUTCDate(lastEligibleDate.getUTCDate() + 31);
    lastEligibleDate.setUTCMilliseconds(
      lastEligibleDate.getUTCMilliseconds() - 1,
    );

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          endDate: { gte: today, lte: lastEligibleDate },
          room: { landlordId: 'landlord-1' },
        },
      }),
    );
    expect(result[0].daysUntilExpiration).toBe(10);
  });

  it('rejects invalid suggestion windows', async () => {
    await expect(
      service.findRenewalSuggestions('landlord-1', 0),
    ).rejects.toThrow('Khoảng thời gian đề xuất phải từ 1 đến 90 ngày');
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });

  it('renews a contract and audits the old and new end dates atomically', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract);
    const newEndDate = new Date('2027-11-20T00:00:00.000Z');
    tx.contract.update.mockResolvedValue({
      ...contract,
      endDate: newEndDate,
    });

    await service.renew(contract.id, newEndDate.toISOString(), 'landlord-1');

    expect(tx.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: contract.id },
        data: { endDate: newEndDate },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        landlordId: 'landlord-1',
        action: AuditAction.CONTRACT_RENEWED,
        entityType: 'Contract',
        entityId: contract.id,
        details: {
          roomId: room.id,
          roomName: room.name,
          tenantId: tenant.id,
          tenantName: tenant.fullName,
          previousEndDate: contract.endDate,
          newEndDate,
        },
      },
    });
  });

  it('rejects renewal dates that do not extend the current contract', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract);

    await expect(
      service.renew(
        contract.id,
        new Date('2026-11-19T00:00:00.000Z').toISOString(),
        'landlord-1',
      ),
    ).rejects.toThrow(
      'Ngày kết thúc mới phải trong tương lai và sau ngày kết thúc hiện tại',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a renewal request that keeps the current end date', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract);

    await expect(
      service.renew(
        contract.id,
        contract.endDate!.toISOString(),
        'landlord-1',
      ),
    ).rejects.toThrow(
      'Ngày kết thúc mới phải trong tương lai và sau ngày kết thúc hiện tại',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not renew a contract that has already ended', async () => {
    prisma.contract.findFirst.mockResolvedValue({
      ...contract,
      isActive: false,
    });

    await expect(
      service.renew(
        contract.id,
        new Date('2027-11-20T00:00:00.000Z').toISOString(),
        'landlord-1',
      ),
    ).rejects.toThrow('Không thể gia hạn hợp đồng đã kết thúc');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
