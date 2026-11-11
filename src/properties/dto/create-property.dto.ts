import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Khu trọ Sinh viên A' })
  @IsString()
  name: string;

  @ApiProperty({ example: '123 Đường B, Quận C, TP D' })
  @IsString()
  address: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
