import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NoticesController } from './notices.controller.js';
import { NoticesService } from './notices.service.js';

describe('NoticesController', () => {
  let controller: NoticesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NoticesController],
      providers: [
        {
          provide: NoticesService,
          useValue: {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NoticesController>(NoticesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
