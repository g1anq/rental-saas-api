import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NoticesService } from './notices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('NoticesService', () => {
  let service: NoticesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        {
          provide: PrismaService,
          useValue: {
            notice: {
              create: vi.fn(),
              findMany: vi.fn(),
              findFirst: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
