import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PropertiesService } from './properties.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo khu trọ mới' })
  create(@Body() createPropertyDto: CreatePropertyDto, @GetUser() landlord: any) {
    return this.propertiesService.create(createPropertyDto, landlord.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách khu trọ của chủ' })
  findAll(@GetUser() landlord: any) {
    return this.propertiesService.findAll(landlord.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết khu trọ' })
  findOne(@Param('id') id: string, @GetUser() landlord: any) {
    return this.propertiesService.findOne(id, landlord.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật khu trọ' })
  update(@Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto, @GetUser() landlord: any) {
    return this.propertiesService.update(id, updatePropertyDto, landlord.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khu trọ' })
  remove(@Param('id') id: string, @GetUser() landlord: any) {
    return this.propertiesService.remove(id, landlord.id);
  }
}
