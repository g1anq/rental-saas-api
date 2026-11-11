import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, Length } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Trần Thị B', description: 'Họ tên đầy đủ' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '079201234567', description: 'Số CCCD (12 số)' })
  @IsString()
  @IsNotEmpty()
  @Length(9, 12)
  cccd: string;

  @ApiProperty({ example: '0912345678', description: 'Số điện thoại' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'tranthi@email.com', description: 'Email (không bắt buộc)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'uuid-landlord', description: 'ID chủ nhà' })
  @IsOptional()
  @IsString()
  landlordId?: string;

  @ApiPropertyOptional({ description: 'Ảnh CCCD mặt trước (Base64)' })
  @IsOptional()
  @IsString()
  idCardFront?: string;

  @ApiPropertyOptional({ description: 'Ảnh CCCD mặt sau (Base64)' })
  @IsOptional()
  @IsString()
  idCardBack?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ thường trú' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Ngày sinh (ISO 8601)' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({ description: 'Giới tính' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'ID của hợp đồng nếu người này là người ở ghép' })
  @IsOptional()
  @IsString()
  roommateOfContractId?: string;
}
