import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: vi.fn(),
            login: vi.fn(),
            tenantLogin: vi.fn(),
            updateSettings: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('sets an HttpOnly cookie and omits the token from the login response', async () => {
    const result = {
      access_token: 'signed-jwt',
      user: {
        id: 'landlord-id',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'landlord',
      },
    };
    vi.spyOn(authService, 'login').mockResolvedValue(result);
    const response = {
      cookie: vi.fn(),
    } as unknown as Response;

    await expect(controller.login({ email: 'owner@example.com', password: 'secret' }, response))
      .resolves.toEqual({ user: result.user });
    expect(response.cookie).toHaveBeenCalledWith(
      'rental_session',
      result.access_token,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('clears the session cookie on logout', () => {
    const response = {
      clearCookie: vi.fn(),
    } as unknown as Response;

    controller.logout(response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'rental_session',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });
});
