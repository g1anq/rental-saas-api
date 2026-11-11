import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUtilityReadingDto {
  @ApiProperty({ example: 'uuid-cua-contract', description: 'ID hợp đồng' })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ example: 10, description: 'Tháng ghi chỉ số (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ example: 2026, description: 'Năm ghi chỉ số' })
  @IsInt()
  @Min(2020)
  @Type(() => Number)
  year: number;

  @ApiProperty({ example: 1200, description: 'Chỉ số điện đầu kỳ (kWh)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  electricityPrev: number;

  @ApiProperty({ example: 1350, description: 'Chỉ số điện cuối kỳ (kWh)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  electricityCurr: number;

  @ApiProperty({ example: 50, description: 'Chỉ số nước đầu kỳ (m3)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  waterPrev: number;

  @ApiProperty({ example: 54, description: 'Chỉ số nước cuối kỳ (m3)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  waterCurr: number;
}
