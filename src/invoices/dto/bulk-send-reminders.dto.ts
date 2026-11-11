import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkSendRemindersDto {
  @ApiProperty({ example: 10, description: 'Tháng (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ example: 2026, description: 'Năm' })
  @IsInt()
  @Min(2020)
  @Type(() => Number)
  year: number;
}
