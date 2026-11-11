import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber } from 'class-validator';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';

export class UpdateMaintenanceDto {
  @ApiProperty({ enum: MaintenanceStatus, required: false })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiProperty({ enum: MaintenancePriority, required: false })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;

  @ApiProperty({ example: 150000, required: false, description: 'Chi phí sửa chữa (VNĐ)' })
  @IsOptional()
  @IsNumber()
  cost?: number;
}
