import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, TenantLoginDto } from './dto/auth.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './get-user.decorator.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from './auth-cookie.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản chủ trọ mới' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookie(response, result.access_token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.access_token);
    return { user: result.user };
  }

  @Post('tenant/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập dành cho khách thuê (Bằng CCCD và SĐT)' })
  async tenantLogin(@Body() dto: TenantLoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.tenantLogin(dto);
    this.setAuthCookie(response, result.access_token);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất và xóa cookie phiên' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...getAuthCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('landlord')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin tài khoản đang đăng nhập' })
  getProfile(@GetUser() user: any) {
    return user;
  }

  @Patch('me/settings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('landlord')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật cài đặt hệ thống và ngân hàng' })
  updateSettings(@GetUser() user: any, @Body() dto: UpdateSettingsDto) {
    return this.authService.updateSettings(user.id, dto);
  }
}
