import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

describe('RoomsService', () => {
  let service: RoomsService;
  const mockRoom = {
    id: 'room-1',
    landlordId: 'landlord-1',
    price: 1000,
  };
  const transactionClient = {
    room: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  const mockPrisma = {
    room: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('records old and new prices when a landlord changes a room price', async () => {
    transactionClient.room.findFirst.mockResolvedValue(mockRoom);
    transactionClient.room.update.mockResolvedValue({
      ...mockRoom,
      price: 1200,
    });

    await service.update('room-1', 'landlord-1', { price: 1200 });

    expect(transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        landlordId: 'landlord-1',
        action: AuditAction.ROOM_PRICE_CHANGED,
        entityType: 'Room',
        entityId: 'room-1',
        details: { oldPrice: 1000, newPrice: 1200 },
      },
    });
  });

  it('does not log a price change when the price is unchanged', async () => {
    transactionClient.room.findFirst.mockResolvedValue(mockRoom);
    transactionClient.room.update.mockResolvedValue(mockRoom);

    await service.update('room-1', 'landlord-1', { price: 1000 });

    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not update rooms owned by another landlord', async () => {
    transactionClient.room.findFirst.mockResolvedValue(null);

    await expect(
      service.update('room-1', 'landlord-2', { price: 1200 }),
    ).rejects.toThrow(NotFoundException);
    expect(transactionClient.room.update).not.toHaveBeenCalled();
  });

  it('does not delete rooms owned by another landlord', async () => {
    mockPrisma.room.findFirst.mockResolvedValue(null);

    await expect(service.remove('room-1', 'landlord-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.room.delete).not.toHaveBeenCalled();
  });

  it('deletes a room owned by the requesting landlord', async () => {
    mockPrisma.room.findFirst.mockResolvedValue(mockRoom);

    await service.remove('room-1', 'landlord-1');

    expect(mockPrisma.room.delete).toHaveBeenCalledWith({
      where: { id: 'room-1' },
    });
  });
});
