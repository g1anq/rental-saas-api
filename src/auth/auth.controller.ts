import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, TenantLoginDto } from './dto/auth.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './get-user.decorator.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản chủ trọ mới' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('tenant/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập dành cho khách thuê (Bằng CCCD và SĐT)' })
  tenantLogin(@Body() dto: TenantLoginDto) {
    return this.authService.tenantLogin(dto);
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
