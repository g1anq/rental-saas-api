import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phòng mới' })
  create(@Body() createRoomDto: CreateRoomDto, @GetUser() landlord: any) {
    createRoomDto.landlordId = landlord.id;
    return this.roomsService.create(createRoomDto as any);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả phòng của chủ (có hỗ trợ phân trang)' })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (bắt đầu từ 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng phòng trên mỗi trang' })
  findAll(
    @GetUser() landlord: any,
    @Query('propertyId') propertyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.roomsService.findAll(landlord.id, propertyId, pageNum, limitNum);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng' })
  update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @GetUser() landlord: any,
  ) {
    const { landlordId: _landlordId, ...roomData } = updateRoomDto;
    return this.roomsService.update(id, landlord.id, roomData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phòng' })
  remove(@Param('id') id: string, @GetUser() landlord: any) {
    return this.roomsService.remove(id, landlord.id);
  }
}
