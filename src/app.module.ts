import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { ContractsModule } from './contracts/contracts.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { NoticesModule } from './notices/notices.module.js';
import { PortalModule } from './portal/portal.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module.js';
import { AiModule } from './ai/ai.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RoomsModule,
    TenantsModule,
    ContractsModule,
    InvoicesModule,
    MailModule,
    AuthModule,
    MaintenanceModule,
    NoticesModule,
    PortalModule,
    WebhooksModule,
    PropertiesModule,
    TransactionsModule,
    NotificationsModule,
    CronModule,
    AiModule,
    ReportsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
