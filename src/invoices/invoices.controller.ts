import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { InvoicesService } from './invoices.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { BulkCreateInvoiceDto } from './dto/bulk-create-invoice.dto.js';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Invoices - Hóa đơn')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('bulk')
  @ApiOperation({ summary: 'Tạo hóa đơn hàng loạt cho tất cả các phòng đang thuê' })
  createBulk(@Body() dto: BulkCreateInvoiceDto, @GetUser() landlord: any) {
    return this.invoicesService.createBulk(dto, landlord.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hóa đơn tháng (tự động tính tiền điện/nước từ chỉ số)' })
  create(@Body() dto: CreateInvoiceDto, @GetUser() landlord: any) {
    return this.invoicesService.create(dto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn (có thể lọc theo tháng/năm/trạng thái/phân trang)' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (bắt đầu từ 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng hóa đơn trên mỗi trang' })
  findAll(
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
    @Query('status') status: InvoiceStatus | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @GetUser() landlord: any,
  ) {
    return this.invoicesService.findAll(landlord.id, {
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      status,
      propertyId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats/revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu theo năm' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Năm cần thống kê (mặc định năm hiện tại)' })
  getRevenueStats(@Query('year') year: string | undefined, @GetUser() landlord: any) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.invoicesService.getRevenueStats(targetYear, landlord.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một hóa đơn' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.invoicesService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hóa đơn (trạng thái, ghi chú, link QR)' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @GetUser() landlord: any) {
    return this.invoicesService.update(id, dto, landlord.id);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Đánh dấu hóa đơn đã thanh toán (ghi nhận thời gian)' })
  markAsPaid(@Param('id') id: string, @GetUser() landlord: any) {
    return this.invoicesService.markAsPaid(id, landlord.id);
  }

  @Patch('mark-overdue/run')
  @ApiOperation({ summary: 'Quét & đánh dấu OVERDUE tất cả hóa đơn quá hạn của chủ nhà' })
  markOverdue(@GetUser() landlord: any) {
    return this.invoicesService.markOverdueInvoices(landlord.id);
  }

  @Post(':id/send-reminder')
  @ApiOperation({ summary: 'Gửi email nhắc nợ cho hóa đơn' })
  sendReminder(@Param('id') id: string, @GetUser() landlord: any) {
    return this.invoicesService.sendReminder(id, landlord.id);
  }

  @Post('send-reminders/bulk')
  @ApiOperation({ summary: 'Gửi email nhắc nợ hàng loạt' })
  sendBulkReminders(@Body() dto: import('./dto/bulk-send-reminders.dto.js').BulkSendRemindersDto, @GetUser() landlord: any) {
    return this.invoicesService.sendBulkReminders(dto.month, dto.year, landlord.id);
  }
}
