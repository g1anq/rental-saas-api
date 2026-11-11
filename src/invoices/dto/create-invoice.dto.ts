import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'uuid-cua-contract', description: 'ID hợp đồng' })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ example: 10, description: 'Tháng hóa đơn (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ example: 2026, description: 'Năm hóa đơn' })
  @IsInt()
  @Min(2020)
  @Type(() => Number)
  year: number;

  @ApiPropertyOptional({ example: 0, description: 'Các khoản phụ thu khác (VNĐ)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherAmount?: number;

  @ApiPropertyOptional({ example: 'Phụ thu vệ sinh tháng 10', description: 'Ghi chú hóa đơn' })
  @IsOptional()
  @IsString()
  notes?: string;
}
