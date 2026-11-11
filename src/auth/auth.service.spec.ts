import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// ─── Mock toàn bộ PrismaService ───────────────────────────────────────────────
const mockPrisma = {
  landlord: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findFirst: vi.fn(),
  },
};

// ─── Mock JwtService ──────────────────────────────────────────────────────────
const mockJwtService = {
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
};

// ─── Dữ liệu mẫu ─────────────────────────────────────────────────────────────
const mockLandlord = {
  id: 'landlord-uuid-001',
  email: 'giangvuonghuy@gmail.com',
  password: '$2a$10$hashedPasswordMock',
  name: 'Giang Vương Huy',
  phone: '0912345678',
};

const mockTenant = {
  id: 'tenant-uuid-001',
  fullName: 'Phạm Thị Mai',
  cccd: '001200004567',
  phone: '0945678901',
  landlordId: 'landlord-uuid-001',
};

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────────────────────────────────
  describe('register()', () => {
    it('nên đăng ký thành công và trả về access_token', async () => {
      mockPrisma.landlord.findUnique.mockResolvedValue(null); // Email chưa tồn tại
      mockPrisma.landlord.create.mockResolvedValue(mockLandlord);

      const result = await service.register({
        email: 'new@test.com',
        password: 'password123',
        name: 'New User',
        phone: '0900000000',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user.role).toBe('landlord');
      expect(mockPrisma.landlord.create).toHaveBeenCalledOnce();
    });

    it('nên throw ConflictException nếu email đã tồn tại', async () => {
      mockPrisma.landlord.findUnique.mockResolvedValue(mockLandlord); // Email đã tồn tại

      await expect(
        service.register({
          email: 'giangvuonghuy@gmail.com',
          password: 'password123',
          name: 'Duplicate',
          phone: '0900000001',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.landlord.create).not.toHaveBeenCalled();
    });

    it('mật khẩu lưu vào DB phải được hash (không lưu plain text)', async () => {
      mockPrisma.landlord.findUnique.mockResolvedValue(null);
      mockPrisma.landlord.create.mockResolvedValue(mockLandlord);

      await service.register({
        email: 'hash@test.com',
        password: 'plainPassword',
        name: 'Hash Test',
        phone: '0900000002',
      });

      // Kiểm tra tham số truyền vào create — password phải khác plain text
      const createCallArgs = mockPrisma.landlord.create.mock.calls[0][0];
      expect(createCallArgs.data.password).not.toBe('plainPassword');
      expect(createCallArgs.data.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LOGIN (Chủ trọ)
  // ──────────────────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('nên đăng nhập thành công với email và mật khẩu đúng', async () => {
      const hashedPassword = await bcrypt.hash('123456', 10);
      mockPrisma.landlord.findFirst.mockResolvedValue({
        ...mockLandlord,
        password: hashedPassword,
      });

      const result = await service.login({
        email: 'giangvuonghuy@gmail.com',
        password: '123456',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user.email).toBe('giangvuonghuy@gmail.com');
      expect(result.user.role).toBe('landlord');
    });

    it('nên throw UnauthorizedException nếu email không tồn tại', async () => {
      mockPrisma.landlord.findFirst.mockResolvedValue(null); // Không tìm thấy

      await expect(
        service.login({ email: 'notexist@test.com', password: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('nên throw UnauthorizedException nếu mật khẩu sai', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      mockPrisma.landlord.findFirst.mockResolvedValue({
        ...mockLandlord,
        password: hashedPassword,
      });

      await expect(
        service.login({
          email: 'giangvuonghuy@gmail.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('thông báo lỗi không được tiết lộ lý do cụ thể (bảo mật)', async () => {
      mockPrisma.landlord.findFirst.mockResolvedValue(null);

      try {
        await service.login({ email: 'x@x.com', password: 'pass' });
        expect.fail('Phải throw exception');
      } catch (err: any) {
        // Thông báo lỗi không phân biệt email/password để tránh user enumeration attack
        expect(err.message).toBe('Email hoặc mật khẩu không đúng');
      }
    });

    it('JWT payload phải chứa role=landlord và sub=id của landlord', async () => {
      const hashedPassword = await bcrypt.hash('123456', 10);
      mockPrisma.landlord.findFirst.mockResolvedValue({
        ...mockLandlord,
        password: hashedPassword,
      });

      await service.login({ email: 'giangvuonghuy@gmail.com', password: '123456' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockLandlord.id,
          role: 'landlord',
          email: mockLandlord.email,
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TENANT LOGIN (Khách thuê)
  // ──────────────────────────────────────────────────────────────────────────
  describe('tenantLogin()', () => {
    it('nên đăng nhập thành công với CCCD và SĐT đúng', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      const result = await service.tenantLogin({
        cccd: '001200004567',
        phone: '0945678901',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user.role).toBe('tenant');
      expect(result.user.name).toBe('Phạm Thị Mai');
    });

    it('nên throw UnauthorizedException nếu CCCD hoặc SĐT không đúng', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.tenantLogin({ cccd: '000000000000', phone: '0000000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('response phải chứa landlordId để frontend biết khu trọ', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      const result = await service.tenantLogin({
        cccd: '001200004567',
        phone: '0945678901',
      });

      expect(result.user.landlordId).toBe('landlord-uuid-001');
    });

    it('JWT payload của tenant phải có role=tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      await service.tenantLogin({ cccd: '001200004567', phone: '0945678901' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'tenant', sub: mockTenant.id }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE SETTINGS
  // ──────────────────────────────────────────────────────────────────────────
  describe('updateSettings()', () => {
    it('nên cập nhật thông tin ngân hàng và trả về dữ liệu mới', async () => {
      const updatedLandlord = {
        ...mockLandlord,
        bankName: 'MB',
        bankAccount: '0988889999',
        bankAccountName: 'NGUYEN VAN CHU TRO',
      };
      mockPrisma.landlord.update.mockResolvedValue(updatedLandlord);

      const result = await service.updateSettings('landlord-uuid-001', {
        bankName: 'MB',
        bankAccount: '0988889999',
        bankAccountName: 'NGUYEN VAN CHU TRO',
      });

      expect(result.bankName).toBe('MB');
      expect(result.bankAccount).toBe('0988889999');
      expect(mockPrisma.landlord.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'landlord-uuid-001' } }),
      );
    });
  });
});
