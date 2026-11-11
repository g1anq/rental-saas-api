import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto, RegisterDto, TenantLoginDto } from './dto/auth.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingLandlord = await this.prisma.landlord.findUnique({
      where: { email: dto.email },
    });

    if (existingLandlord) {
      throw new ConflictException('Email này đã được đăng ký!');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const landlord = await this.prisma.landlord.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
      },
    });

    return this.generateToken(landlord);
  }

  async login(dto: LoginDto) {
    const landlord = await this.prisma.landlord.findFirst({
      where: {
        email: {
          equals: dto.email,
          mode: 'insensitive',
        },
      },
    });

    if (!landlord) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, landlord.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.generateToken(landlord);
  }

  private generateToken(landlord: any) {
    const payload = { email: landlord.email, sub: landlord.id, role: 'landlord' };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: landlord.id,
        email: landlord.email,
        name: landlord.name,
        role: 'landlord'
      }
    };
  }

  async tenantLogin(dto: TenantLoginDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        cccd: dto.cccd,
        phone: dto.phone,
      }
    });

    if (!tenant) {
      throw new UnauthorizedException('CCCD hoặc Số điện thoại không đúng');
    }

    const payload = { sub: tenant.id, role: 'tenant' };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: tenant.id,
        name: tenant.fullName,
        role: 'tenant',
        landlordId: tenant.landlordId
      }
    };
  }

  async updateSettings(landlordId: string, dto: UpdateSettingsDto) {
    const landlord = await this.prisma.landlord.update({
      where: { id: landlordId },
      data: {
        bankName: dto.bankName,
        bankAccount: dto.bankAccount,
        bankAccountName: dto.bankAccountName,
        defaultElectricityPrice: dto.defaultElectricityPrice,
        defaultWaterPrice: dto.defaultWaterPrice,
        invoiceCreationDay: dto.invoiceCreationDay,
        paymentDeadlineDays: dto.paymentDeadlineDays,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        bankName: true,
        bankAccount: true,
        bankAccountName: true,
        defaultElectricityPrice: true,
        defaultWaterPrice: true,
        invoiceCreationDay: true,
        paymentDeadlineDays: true,
      }
    });

    return landlord;
  }
}
