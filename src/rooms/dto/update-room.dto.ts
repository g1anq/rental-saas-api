import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create-room.dto.js';

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  @ApiProperty({ enum: RoomStatus, required: false })
  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;
}
