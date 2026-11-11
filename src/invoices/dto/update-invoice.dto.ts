import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Trạng thái thanh toán' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 100000, description: 'Các khoản phụ thu khác (VNĐ)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherAmount?: number;

  @ApiPropertyOptional({ example: 'Đã thanh toán chuyển khoản', description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'https://vietqr.io/...', description: 'Link QR thanh toán' })
  @IsOptional()
  @IsString()
  paymentLink?: string;
}
