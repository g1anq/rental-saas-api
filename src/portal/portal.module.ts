import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PortalController],
  providers: [PortalService]
})
export class PortalModule {}
