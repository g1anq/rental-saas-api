import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

describe('PortalController', () => {
  let controller: PortalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        {
          provide: PortalService,
          useValue: {
            getInvoices: vi.fn(),
            getContracts: vi.fn(),
            getMaintenanceRequests: vi.fn(),
            createMaintenanceRequest: vi.fn(),
            getNotices: vi.fn(),
            getProfile: vi.fn(),
            updateProfile: vi.fn(),
            getRoommates: vi.fn(),
            addRoommateRequest: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PortalController>(PortalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
