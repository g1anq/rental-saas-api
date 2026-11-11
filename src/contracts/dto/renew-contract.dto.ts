import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RenewContractDto {
  @ApiProperty({
    example: '2027-10-31T17:00:00.000Z',
    description: 'Ngày kết thúc mới; phải sau ngày kết thúc hiện tại',
  })
  @IsDateString()
  endDate: string;
}
