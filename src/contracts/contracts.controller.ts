import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ContractsService } from './contracts.service.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { CreateUtilityReadingDto } from './dto/create-utility-reading.dto.js';
import { RenewContractDto } from './dto/renew-contract.dto.js';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Contracts - Hợp đồng')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo hợp đồng mới (tự động đổi phòng → RENTED)' })
  create(@Body() dto: CreateContractDto, @GetUser() landlord: any) {
    return this.contractsService.create(dto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hợp đồng (hỗ trợ phân trang)' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Lọc chỉ lấy hợp đồng đang hiệu lực' })
  @ApiQuery({ name: 'propertyId', required: false, type: String, description: 'Lọc theo khu trọ' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (bắt đầu từ 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng hợp đồng trên mỗi trang' })
  findAll(
    @Query('active') active: string | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @GetUser() landlord: any
  ) {
    const onlyActive = active === 'true';
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.contractsService.findAll(landlord.id, propertyId, onlyActive, pageNum, limitNum);
  }

  @Get('renewal-suggestions')
  @ApiOperation({ summary: 'Đề xuất hợp đồng sắp hết hạn cần gia hạn' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Số ngày tới hạn để đề xuất (mặc định 30, tối đa 90)',
  })
  findRenewalSuggestions(
    @GetUser() landlord: any,
    @Query('days') daysParam?: string,
  ) {
    let days = 30;
    if (daysParam !== undefined) {
      if (!/^\d+$/.test(daysParam)) {
        throw new BadRequestException('days phải là số nguyên từ 1 đến 90');
      }
      days = Number(daysParam);
    }
    return this.contractsService.findRenewalSuggestions(landlord.id, days);
  }

  @Patch(':id/renew')
  @ApiOperation({ summary: 'Gia hạn hợp đồng đang hiệu lực' })
  renew(
    @Param('id') id: string,
    @Body() dto: RenewContractDto,
    @GetUser() landlord: any,
  ) {
    return this.contractsService.renew(id, dto.endDate, landlord.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hợp đồng (kèm hóa đơn và chỉ số điện nước)' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.contractsService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin hợp đồng' })
  update(@Param('id') id: string, @Body() dto: UpdateContractDto, @GetUser() landlord: any) {
    return this.contractsService.update(id, dto, landlord.id);
  }

  @Patch(':id/terminate')
  @ApiOperation({ summary: 'Kết thúc hợp đồng (tự động đổi phòng → AVAILABLE)' })
  terminate(@Param('id') id: string, @GetUser() landlord: any) {
    return this.contractsService.terminate(id, landlord.id);
  }

  // --- Người ở ghép ---
  @Post(':id/roommates')
  @ApiOperation({ summary: 'Thêm người ở ghép vào hợp đồng' })
  addRoommate(@Param('id') contractId: string, @Body() dto: any, @GetUser() landlord: any) {
    return this.contractsService.addRoommate(contractId, landlord.id, dto);
  }

  @Delete(':id/roommates/:tenantId')
  @ApiOperation({ summary: 'Xóa người ở ghép khỏi hợp đồng' })
  removeRoommate(@Param('id') contractId: string, @Param('tenantId') tenantId: string, @GetUser() landlord: any) {
    return this.contractsService.removeRoommate(contractId, tenantId, landlord.id);
  }

  @Get(':id/roommate-requests')
  @ApiOperation({ summary: 'Lấy các yêu cầu thêm/xóa người ở ghép của hợp đồng này' })
  getRoommateRequests(@Param('id') contractId: string, @GetUser() landlord: any) {
    return this.contractsService.getRoommateRequests(contractId, landlord.id);
  }

  // --- Chỉ số điện/nước ---

  @Post('utility-readings')
  @ApiOperation({ summary: 'Ghi chỉ số điện/nước tháng' })
  recordUtilityReading(@Body() dto: CreateUtilityReadingDto, @GetUser() landlord: any) {
    return this.contractsService.recordUtilityReading(dto, landlord.id);
  }

  @Get(':id/utility-readings')
  @ApiOperation({ summary: 'Lấy lịch sử chỉ số điện/nước của hợp đồng' })
  getUtilityReadings(@Param('id') id: string, @GetUser() landlord: any) {
    return this.contractsService.getUtilityReadings(id, landlord.id);
  }
}
