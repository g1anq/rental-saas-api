import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'test@email.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn Chủ Trọ' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'test@email.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class TenantLoginDto {
  @ApiProperty({ example: '012345678912', description: 'Căn cước công dân của khách thuê' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  cccd: string;

  @ApiProperty({ example: '0987654321', description: 'Số điện thoại của khách thuê' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  phone: string;
}
