import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantNotificationsGateway } from './tenant-notifications.gateway.js';

describe('TenantNotificationsGateway', () => {
  const jwtService = { verifyAsync: vi.fn() };
  const prisma = { tenant: { findUnique: vi.fn() } };
  let gateway: TenantNotificationsGateway;
  const client = {
    handshake: { auth: { token: 'valid-token' } },
    disconnect: vi.fn(),
    join: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new TenantNotificationsGateway(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'tenant-1',
      role: 'tenant',
    });
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
  });

  it('authenticates tenants and joins their private room', async () => {
    await gateway.handleConnection(client as never);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { id: true },
    });
    expect(client.join).toHaveBeenCalledWith('tenant:tenant-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects clients without a token', async () => {
    const unauthenticatedClient = {
      ...client,
      handshake: { auth: {} },
    };

    await gateway.handleConnection(unauthenticatedClient as never);

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(unauthenticatedClient.disconnect).toHaveBeenCalledWith(true);
    expect(unauthenticatedClient.join).not.toHaveBeenCalled();
  });

  it('disconnects landlord tokens and never joins a tenant room', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'landlord-1',
      role: 'landlord',
    });

    await gateway.handleConnection(client as never);

    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('emits payment notifications only to the tenant room', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    Object.defineProperty(gateway, 'server', { value: { to } });
    const notification = {
      invoiceId: 'invoice-1',
      invoiceCode: 'INV-1',
      month: 10,
      year: 2026,
      amount: 1000,
      roomName: 'Phòng 101',
    };

    gateway.notifyInvoicePaid('tenant-1', notification);

    expect(to).toHaveBeenCalledWith('tenant:tenant-1');
    expect(emit).toHaveBeenCalledWith('invoice:paid', notification);
  });
});
