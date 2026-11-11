import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCreateInvoiceDto {
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

  @ApiPropertyOptional({ example: 0, description: 'Các khoản phụ thu khác (VNĐ) áp dụng cho tất cả' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherAmount?: number;

  @ApiPropertyOptional({ example: 'Phụ thu vệ sinh tháng 10', description: 'Ghi chú hóa đơn chung' })
  @IsOptional()
  @IsString()
  notes?: string;
}
