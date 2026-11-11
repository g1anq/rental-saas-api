import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

type TenantToken = {
  sub: string;
  role: string;
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL?.split(',') ?? true,
    credentials: true,
  },
})
export class TenantNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(TenantNotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect(true);
      return;
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<TenantToken>(token);
      if (payload.role !== 'tenant' || !payload.sub) {
        client.disconnect(true);
        return;
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!tenant) {
        client.disconnect(true);
        return;
      }

      await client.join(this.tenantRoom(tenant.id));
    } catch (error) {
      this.logger.debug(
        `Rejected unauthenticated WebSocket connection: ${
          error instanceof Error ? error.message : 'Invalid token'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WebSocket client disconnected: ${client.id}`);
  }

  notifyInvoicePaid(
    tenantId: string,
    notification: {
      invoiceId: string;
      invoiceCode: string | null;
      month: number;
      year: number;
      amount: number;
      roomName: string;
    },
  ) {
    this.server
      .to(this.tenantRoom(tenantId))
      .emit('invoice:paid', notification);
  }

  private tenantRoom(tenantId: string) {
    return `tenant:${tenantId}`;
  }
}
