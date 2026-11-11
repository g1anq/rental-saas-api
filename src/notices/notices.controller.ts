import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { NoticesService } from './notices.service.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { UpdateNoticeDto } from './dto/update-notice.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@ApiTags('Notices - Thông báo')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo thông báo mới' })
  create(@Body() dto: CreateNoticeDto, @GetUser() landlord: any) {
    return this.noticesService.create(dto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo' })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  findAll(@Query('propertyId') propertyId: string | undefined, @GetUser() landlord: any) {
    return this.noticesService.findAll(landlord.id, propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết thông báo' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.noticesService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông báo' })
  update(@Param('id') id: string, @Body() dto: UpdateNoticeDto, @GetUser() landlord: any) {
    return this.noticesService.update(id, dto, landlord.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thông báo' })
  remove(@Param('id') id: string, @GetUser() landlord: any) {
    return this.noticesService.remove(id, landlord.id);
  }
}
