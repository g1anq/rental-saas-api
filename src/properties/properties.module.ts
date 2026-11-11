import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service.js';
import { PropertiesController } from './properties.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
