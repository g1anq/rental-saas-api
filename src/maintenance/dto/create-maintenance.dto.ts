import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { MaintenancePriority } from '@prisma/client';

export class CreateMaintenanceDto {
  @ApiProperty({ example: 'Thay bóng đèn phòng khách', description: 'Tiêu đề yêu cầu' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Bóng đèn bị cháy lúc sáng nay', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-room-id', description: 'ID phòng' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ example: 'uuid-tenant-id', required: false, description: 'ID khách thuê (nếu có)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ enum: MaintenancePriority, required: false, default: MaintenancePriority.MEDIUM })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;
}
