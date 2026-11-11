import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateTransactionDto {
  @IsEnum(['INCOME', 'EXPENSE'])
  type: 'INCOME' | 'EXPENSE';

  @IsNumber()
  amount: number;

  @IsString()
  description: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  invoiceId?: string;
}
