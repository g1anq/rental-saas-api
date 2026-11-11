import { Module } from '@nestjs/common';
import { NoticesService } from './notices.service.js';
import { NoticesController } from './notices.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [NoticesService],
  controllers: [NoticesController]
})
export class NoticesModule {}
