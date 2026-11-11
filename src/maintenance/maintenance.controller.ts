import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@ApiTags('Maintenance - Bảo trì / Sửa chữa')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller(['maintenance', 'maintenance-requests'])
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo yêu cầu bảo trì / sửa chữa mới' })
  create(@Body() dto: CreateMaintenanceDto, @GetUser() landlord: any) {
    return this.maintenanceService.create(dto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu bảo trì (hỗ trợ phân trang)' })
  @ApiQuery({ name: 'status', required: false, enum: MaintenanceStatus })
  @ApiQuery({ name: 'priority', required: false, enum: MaintenancePriority })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (bắt đầu từ 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng yêu cầu trên mỗi trang' })
  findAll(
    @Query('status') status: MaintenanceStatus | undefined,
    @Query('priority') priority: MaintenancePriority | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @GetUser() landlord: any,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.maintenanceService.findAll(landlord.id, propertyId, status, priority, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết yêu cầu bảo trì' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.maintenanceService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật trạng thái / chi phí bảo trì' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto, @GetUser() landlord: any) {
    return this.maintenanceService.update(id, dto, landlord.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa yêu cầu bảo trì' })
  remove(@Param('id') id: string, @GetUser() landlord: any) {
    return this.maintenanceService.remove(id, landlord.id);
  }
}
