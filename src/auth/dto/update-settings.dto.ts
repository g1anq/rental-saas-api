import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'MB', description: 'Tên ngân hàng (VD: MB, VCB, Techcombank)' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: '123456789', description: 'Số tài khoản' })
  @IsString()
  @IsOptional()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'NGUYEN VAN A', description: 'Tên chủ tài khoản (không dấu)' })
  @IsString()
  @IsOptional()
  bankAccountName?: string;

  @ApiPropertyOptional({ example: 3500 })
  @IsNumber()
  @IsOptional()
  defaultElectricityPrice?: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsNumber()
  @IsOptional()
  defaultWaterPrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @Min(1)
  @Max(28)
  @IsOptional()
  invoiceCreationDay?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  paymentDeadlineDays?: number;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  telegramChatId?: string;
}
