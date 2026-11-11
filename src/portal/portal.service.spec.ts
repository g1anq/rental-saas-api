import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PortalService } from './portal.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PortalService', () => {
  let service: PortalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        {
          provide: PrismaService,
          useValue: {
            invoice: {
              findMany: vi.fn(),
            },
            contract: {
              findMany: vi.fn(),
              findFirst: vi.fn(),
            },
            maintenanceRequest: {
              findMany: vi.fn(),
              create: vi.fn(),
            },
            notice: {
              findMany: vi.fn(),
            },
            tenant: {
              findUnique: vi.fn(),
              update: vi.fn(),
            },
            roommate: {
              findMany: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
