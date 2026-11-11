import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateNoticeDto {
  @ApiProperty({ example: 'Cắt nước chủ nhật tuần này', description: 'Tiêu đề thông báo' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Sẽ cắt nước từ 8h sáng đến 12h trưa để bảo trì bể nước.', description: 'Nội dung thông báo' })
  @IsString()
  content: string;

  @ApiProperty({ example: true, required: false, description: 'Đánh dấu thông báo quan trọng (ví dụ: in đậm đỏ)' })
  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @ApiProperty({ example: 'room-id-123', required: false, description: 'Gửi riêng cho một phòng. Nếu null thì gửi toàn nhà trọ.' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
