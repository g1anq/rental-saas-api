import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Phòng 101', description: 'Tên phòng' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 3500000, description: 'Giá thuê (VNĐ/tháng)' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({ example: 20, description: 'Diện tích (m2)', required: false })
  @IsNumber()
  @IsOptional()
  area?: number;

  @ApiProperty({ example: 3, description: 'Sức chứa tối đa (người)', required: false })
  @IsNumber()
  @IsOptional()
  maxCapacity?: number;

  @ApiProperty({ example: 'uuid-cua-landlord', description: 'ID chủ nhà' })
  @IsString()
  @IsOptional()
  landlordId?: string;

  @ApiProperty({ example: '[{"name":"Máy lạnh","status":"Tốt"}]', description: 'Tài sản trong phòng' })
  @IsOptional()
  assets?: any;

  @ApiProperty({ example: 'uuid-cua-property', description: 'ID của khu nhà trọ' })
  @IsString()
  @IsOptional()
  propertyId?: string;
}
