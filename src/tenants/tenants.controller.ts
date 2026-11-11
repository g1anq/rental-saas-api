import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { TenantsService } from './tenants.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';

@ApiTags('Tenants - Khách thuê')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Thêm khách thuê mới' })
  create(@Body() dto: CreateTenantDto, @GetUser() landlord: any) {
    return this.tenantsService.create(dto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả khách thuê (kèm hợp đồng đang active, hỗ trợ phân trang)' })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (bắt đầu từ 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng khách trên mỗi trang' })
  findAll(
    @GetUser() landlord: any,
    @Query('propertyId') propertyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.tenantsService.findAll(landlord.id, propertyId, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một khách thuê' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.tenantsService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin khách thuê' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @GetUser() landlord: any,
  ) {
    return this.tenantsService.update(id, landlord.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khách thuê (chỉ xóa được nếu không có hợp đồng active)' })
  remove(@Param('id') id: string, @GetUser() landlord: any) {
    return this.tenantsService.remove(id, landlord.id);
  }
}
