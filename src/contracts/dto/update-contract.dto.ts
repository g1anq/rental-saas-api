import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateContractDto {
  @ApiPropertyOptional({ example: '2026-12-31', description: 'Ngày kết thúc hợp đồng' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 5000000, description: 'Tiền cọc (VNĐ)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit?: number;

  @ApiPropertyOptional({ example: 4000, description: 'Giá điện (VNĐ/kWh)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  electricityRate?: number;

  @ApiPropertyOptional({ example: 20000, description: 'Giá nước (VNĐ/m3)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  waterRate?: number;

  @ApiPropertyOptional({ example: 'Ghi chú cập nhật', description: 'Ghi chú hợp đồng' })
  @IsOptional()
  @IsString()
  notes?: string;
}
