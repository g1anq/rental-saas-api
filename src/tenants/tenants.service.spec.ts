import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantsService } from './tenants.service.js';

describe('TenantsService', () => {
  let service: TenantsService;
  const mockPrisma = {
    contract: {
      findFirst: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  it('scopes tenant details to the requesting landlord', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'landlord-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1', landlordId: 'landlord-2' },
      }),
    );
  });

  it('does not update a tenant owned by another landlord', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    await expect(
      service.update('tenant-1', 'landlord-2', { fullName: 'Updated name' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('does not delete a tenant owned by another landlord', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    await expect(service.remove('tenant-1', 'landlord-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.tenant.delete).not.toHaveBeenCalled();
  });

  it('ignores attempts to transfer a tenant to another landlord', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      landlordId: 'landlord-1',
      contracts: [],
      roommateOfContract: null,
    });
    mockPrisma.tenant.update.mockResolvedValue({});

    await service.update('tenant-1', 'landlord-1', {
      fullName: 'Updated name',
      landlordId: 'landlord-2',
    });

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { fullName: 'Updated name' },
      }),
    );
  });

  it('does not assign a roommate from another landlord contract', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      landlordId: 'landlord-1',
      contracts: [],
      roommateOfContract: null,
    });
    mockPrisma.contract.findFirst.mockResolvedValue(null);

    await expect(
      service.update('tenant-1', 'landlord-1', {
        roommateOfContractId: 'contract-from-another-landlord',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });
});
