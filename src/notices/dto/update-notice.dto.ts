import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateNoticeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  propertyId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  roomId?: string | null;
}
