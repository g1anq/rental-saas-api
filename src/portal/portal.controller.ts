import { Controller, Get, Post, Patch, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PortalService } from './portal.service.js';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@ApiTags('Tenant Portal')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('tenant')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  private checkTenantRole(user: any) {
    if (user.role !== 'tenant') {
      throw new UnauthorizedException('Bạn không phải là khách thuê!');
    }
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Lấy hóa đơn của khách thuê' })
  getInvoices(@GetUser() tenant: any) {
    this.checkTenantRole(tenant);
    return this.portalService.getInvoices(tenant.id);
  }

  @Get('notices')
  @ApiOperation({ summary: 'Lấy thông báo cho khách thuê' })
  getNotices(@GetUser() tenant: any) {
    this.checkTenantRole(tenant);
    return this.portalService.getNotices(tenant.id);
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Lấy lịch sử bảo trì của khách thuê' })
  getMaintenance(@GetUser() tenant: any) {
    this.checkTenantRole(tenant);
    return this.portalService.getMaintenanceRequests(tenant.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin cá nhân và hợp đồng' })
  async getProfile(@GetUser() tenant: any) {
    this.checkTenantRole(tenant);
    const contract = await this.portalService.getActiveContract(tenant.id);
    return { ...tenant, contract };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân' })
  @ApiBody({ schema: { example: { phone: '0988', email: 'test@g.com' } } })
  updateProfile(@GetUser() tenant: any, @Body() body: any) {
    this.checkTenantRole(tenant);
    return this.portalService.updateProfile(tenant.id, body);
  }

  @Post('roommates/request')
  @ApiOperation({ summary: 'Gửi yêu cầu thay đổi người ở ghép' })
  @ApiBody({ schema: { example: { type: 'ADD', fullName: 'Nguyen B', cccd: '0792', phone: '0912' } } })
  requestRoommateChange(@GetUser() tenant: any, @Body() body: any) {
    this.checkTenantRole(tenant);
    return this.portalService.requestRoommateChange(tenant.id, body);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Khách thuê tự tạo yêu cầu bảo trì' })
  @ApiBody({ schema: { example: { title: 'Bóng đèn hỏng', description: 'Bóng đèn nhà tắm bị nhấp nháy', priority: 'MEDIUM' } } })
  createMaintenance(@GetUser() tenant: any, @Body() body: any) {
    this.checkTenantRole(tenant);
    return this.portalService.createMaintenanceRequest(tenant.id, body);
  }

  @Get('utility-readings')
  @ApiOperation({ summary: 'Lấy lịch sử ghi chỉ số điện nước' })
  getUtilityReadings(@GetUser() tenant: any) {
    this.checkTenantRole(tenant);
    return this.portalService.getUtilityReadings(tenant.id);
  }

  @Post('utility-readings')
  @ApiOperation({ summary: 'Khách thuê tự ghi số điện nước' })
  @ApiBody({ schema: { example: { month: 10, year: 2026, electricityCurr: 120, waterCurr: 15 } } })
  submitUtilityReading(@GetUser() tenant: any, @Body() body: any) {
    this.checkTenantRole(tenant);
    return this.portalService.submitUtilityReading(tenant.id, body);
  }
}
