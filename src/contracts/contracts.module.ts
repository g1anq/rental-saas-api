import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ContractsService } from './contracts.service.js';
import { ContractsController } from './contracts.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
