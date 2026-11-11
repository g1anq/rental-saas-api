import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, IsPositive, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CustomServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateContractDto {
  @ApiProperty({ example: 'uuid-cua-room', description: 'ID phòng thuê' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ example: 'uuid-cua-tenant', description: 'ID khách thuê' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ example: '2026-01-01', description: 'Ngày bắt đầu hợp đồng (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Ngày kết thúc (để trống nếu chưa xác định)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: 5000000, description: 'Tiền cọc (VNĐ)' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  deposit: number;

  @ApiPropertyOptional({ example: 1, description: 'Chu kỳ đóng tiền (tháng) — mặc định 1' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  paymentCycle?: number;

  @ApiPropertyOptional({ example: 3500, description: 'Giá điện (VNĐ/kWh) — mặc định 3500' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  electricityRate?: number;

  @ApiPropertyOptional({ example: 15000, description: 'Giá nước (VNĐ/m3) — mặc định 15000' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  waterRate?: number;

  @ApiPropertyOptional({ example: 'Phòng có điều hòa, không nuôi thú cưng', description: 'Ghi chú hợp đồng' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Các dịch vụ thêm (Rác, Internet, Gửi xe...)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomServiceDto)
  customServices?: CustomServiceDto[];
}
