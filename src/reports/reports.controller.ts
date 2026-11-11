import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { GetUser } from '../auth/get-user.decorator.js';
import { ReportsService } from './reports.service.js';
import type { Response } from 'express';

@ApiTags('Reports - Báo cáo & Thống kê')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @ApiOperation({
    summary: 'Xuất file Excel báo cáo tổng hợp tháng',
    description:
      'Trả về file Excel (.xlsx) gồm 3 sheets: Danh sách thu tiền tháng, Doanh thu theo khu trọ, và Thống kê phòng trống/đang thuê.',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    description: 'Tháng cần xuất báo cáo (Định dạng YYYY-MM, ví dụ: 2026-10)',
    example: '2026-10',
  })
  @ApiResponse({
    status: 200,
    description: 'Tải về file Excel thành công',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
    },
  })
  async exportMonthly(
    @Query('month') month: string | undefined,
    @GetUser() landlord: any,
    @Res() res: Response,
  ) {
    return this.reportsService.exportMonthlyReport(landlord.id, month, res);
  }
}
