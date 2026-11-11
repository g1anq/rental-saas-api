import { Controller, Get, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './auth/get-user.decorator.js';
import { Roles } from './auth/roles.decorator.js';
import { RolesGuard } from './auth/roles.guard.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RoomStatus, InvoiceStatus } from '@prisma/client';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('landlord')
@Controller('dashboard')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan cho dashboard' })
  @ApiQuery({
    name: 'propertyId',
    required: false,
    type: String,
    description: 'Lọc thống kê theo khu trọ thuộc chủ trọ hiện tại',
  })
  async getStats(
    @GetUser() landlord: any,
    @Query('propertyId') propertyId?: string,
  ) {
    const landlordId = landlord.id;
    if (propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, landlordId },
        select: { id: true },
      });
      if (!property) {
        throw new NotFoundException('Không tìm thấy khu trọ');
      }
    }

    const roomFilter = { landlordId, ...(propertyId ? { propertyId } : {}) };
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [
      totalRooms,
      availableRooms,
      rentedRooms,
      maintenanceRooms,
      totalTenants,
      activeContracts,
      unpaidInvoices,
      overdueInvoices,
      currentMonthRevenue,
      totalInvoices,
      unpaidAmountAggregate,
      inactiveContracts,
      expiringContracts,
    ] = await Promise.all([
      this.prisma.room.count({ where: roomFilter }),
      this.prisma.room.count({ where: { ...roomFilter, status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { ...roomFilter, status: RoomStatus.RENTED } }),
      this.prisma.room.count({ where: { ...roomFilter, status: RoomStatus.MAINTENANCE } }),
      this.prisma.tenant.count({
        where: {
          landlordId,
          ...(propertyId
            ? { contracts: { some: { room: roomFilter } } }
            : {}),
        },
      }),
      this.prisma.contract.count({ where: { room: roomFilter, isActive: true } }),
      this.prisma.invoice.count({ where: { contract: { room: roomFilter }, status: InvoiceStatus.UNPAID } }),
      this.prisma.invoice.count({ where: { contract: { room: roomFilter }, status: InvoiceStatus.OVERDUE } }),
      this.prisma.invoice.aggregate({
        where: { contract: { room: roomFilter }, month: currentMonth, year: currentYear, status: InvoiceStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.count({ where: { contract: { room: roomFilter } } }),
      this.prisma.invoice.aggregate({
        where: { contract: { room: roomFilter }, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.contract.findMany({
        where: {
          room: roomFilter,
          isActive: false, // Liquidated/Terminated contracts
        },
        select: { deposit: true, room: { select: { name: true } }, tenant: { select: { fullName: true } } },
      }),
      this.prisma.contract.findMany({
        where: {
          room: roomFilter,
          isActive: true,
          endDate: {
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Expiring within 30 days
          },
        },
        select: { deposit: true, endDate: true, room: { select: { name: true } } },
      }),
    ]);

    return {
      rooms: {
        total: totalRooms,
        available: availableRooms,
        rented: rentedRooms,
        maintenance: maintenanceRooms,
        occupancyRate: totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 100) : 0,
      },
      tenants: {
        total: totalTenants,
        activeContracts,
      },
      invoices: {
        unpaid: unpaidInvoices,
        overdue: overdueInvoices,
        total: totalInvoices,
        unpaidAmount: unpaidAmountAggregate._sum.totalAmount ?? 0,
      },
      revenue: {
        currentMonth: currentMonthRevenue._sum.totalAmount ?? 0,
        month: currentMonth,
        year: currentYear,
      },
      vulnerabilities: {
        unpaidRate: totalInvoices > 0 ? Math.round(((unpaidInvoices + overdueInvoices) / totalInvoices) * 100) : 0,
        depositsToRefund: inactiveContracts.reduce((sum, c) => sum + c.deposit, 0),
        inactiveContractsDetails: inactiveContracts,
        expiringContractsDetails: expiringContracts,
      },
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm toàn cục (Rooms, Tenants, Properties, Contracts, Invoices)' })
  async globalSearch(@GetUser() landlord: any, @Query('q') query: string) {
    if (!query || query.trim().length === 0) return { rooms: [], tenants: [], properties: [], contracts: [], invoices: [] };
    const landlordId = landlord.id;
    const q = query.trim();

    const [rooms, tenants, properties, contracts, invoices] = await Promise.all([
      this.prisma.room.findMany({
        where: { landlordId, name: { contains: q, mode: 'insensitive' } },
        take: 5,
        select: { id: true, name: true, status: true }
      }),
      this.prisma.tenant.findMany({
        where: { landlordId, OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { cccd: { contains: q } }] },
        take: 5,
        select: { id: true, fullName: true, phone: true }
      }),
      this.prisma.property.findMany({
        where: { landlordId, name: { contains: q, mode: 'insensitive' } },
        take: 5,
        select: { id: true, name: true }
      }),
      this.prisma.contract.findMany({
        where: {
          room: { landlordId },
          OR: [
            { tenant: { fullName: { contains: q, mode: 'insensitive' } } },
            { room: { name: { contains: q, mode: 'insensitive' } } }
          ]
        },
        take: 5,
        select: { id: true, room: { select: { name: true } }, tenant: { select: { fullName: true } }, isActive: true }
      }),
      this.prisma.invoice.findMany({
        where: {
          contract: { room: { landlordId } },
          OR: [
            { invoiceCode: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 5,
        select: { id: true, invoiceCode: true, month: true, year: true, totalAmount: true, status: true, contract: { select: { room: { select: { name: true } } } } }
      })
    ]);
    return { rooms, tenants, properties, contracts, invoices };
  }

  @Get('unpaid-invoices')
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn chưa thu (10 gần nhất)' })
  @ApiQuery({
    name: 'propertyId',
    required: false,
    type: String,
    description: 'Lọc hóa đơn theo khu trọ thuộc chủ trọ hiện tại',
  })
  async getUnpaidInvoices(
    @GetUser() landlord: any,
    @Query('propertyId') propertyId?: string,
  ) {
    const landlordId = landlord.id;
    if (propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, landlordId },
        select: { id: true },
      });
      if (!property) {
        throw new NotFoundException('Không tìm thấy khu trọ');
      }
    }

    return this.prisma.invoice.findMany({
      where: {
        contract: {
          room: { landlordId, ...(propertyId ? { propertyId } : {}) },
        },
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] },
      },
      include: {
        contract: {
          include: {
            room: { select: { name: true } },
            tenant: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ status: 'desc' }, { year: 'desc' }, { month: 'desc' }],
      take: 10,
    });
  }

  @Get('advanced-stats')
  @ApiOperation({ summary: 'Lấy phân tích dashboard (doanh thu, lấp đầy, dự báo)' })
  @ApiQuery({
    name: 'propertyId',
    required: false,
    type: String,
    description: 'Lọc phân tích theo khu trọ thuộc chủ trọ hiện tại',
  })
  async getAdvancedStats(
    @GetUser() landlord: any,
    @Query('propertyId') propertyId?: string,
  ) {
    const landlordId = landlord.id;
    if (propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, landlordId },
        select: { id: true },
      });
      if (!property) {
        throw new NotFoundException('Không tìm thấy khu trọ');
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstTrendMonth = new Date(currentYear, currentMonth - 11, 1);
    const nextMonth = new Date(currentYear, currentMonth + 1, 1);
    const trendTransactions = await this.prisma.transaction.findMany({
      where: {
        landlordId,
        date: {
          gte: firstTrendMonth,
          lt: nextMonth,
        },
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        room: { select: { propertyId: true } },
      },
    });

    const yearTransactions = await this.prisma.transaction.findMany({
      where: {
        landlordId,
        date: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1),
        },
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        room: { select: { propertyId: true } },
      },
    });

    const propertyWhere = {
      landlordId,
      ...(propertyId ? { id: propertyId } : {}),
    };
    const [properties, totalRooms, rentedRooms, availableRooms, maintenanceRooms] =
      await Promise.all([
        this.prisma.property.findMany({
          where: propertyWhere,
          select: { id: true, name: true },
        }),
        this.prisma.room.count({
          where: { landlordId, ...(propertyId ? { propertyId } : {}) },
        }),
        this.prisma.room.count({
          where: {
            landlordId,
            ...(propertyId ? { propertyId } : {}),
            status: RoomStatus.RENTED,
          },
        }),
        this.prisma.room.count({
          where: {
            landlordId,
            ...(propertyId ? { propertyId } : {}),
            status: RoomStatus.AVAILABLE,
          },
        }),
        this.prisma.room.count({
          where: {
            landlordId,
            ...(propertyId ? { propertyId } : {}),
            status: RoomStatus.MAINTENANCE,
          },
        }),
      ]);

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(currentYear, currentMonth - 11 + index, 1);
      const monthTx = trendTransactions.filter(
        (transaction) =>
          transaction.date.getFullYear() === date.getFullYear() &&
          transaction.date.getMonth() === date.getMonth(),
      );
      const income = monthTx
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const expense = monthTx
        .filter((transaction) => transaction.type === 'EXPENSE')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      return {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        name: `T${date.getMonth() + 1}/${date.getFullYear()}`,
        income,
        expense,
        net: income - expense,
      };
    });

    const quarterly = Array.from({ length: 4 }, (_, i) => {
      const startMonth = i * 3;
      const endMonth = startMonth + 2;
      const quarterTx = yearTransactions.filter(
        (transaction) =>
          transaction.date.getMonth() >= startMonth &&
          transaction.date.getMonth() <= endMonth,
      );
      const income = quarterTx
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const expense = quarterTx
        .filter((transaction) => transaction.type === 'EXPENSE')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      return {
        quarter: i + 1,
        name: `Quý ${i + 1}`,
        income,
        expense,
        net: income - expense,
      };
    });

    const propertyPerformance = properties.map((property) => {
      const propTx = yearTransactions.filter(
        (transaction) =>
          transaction.room?.propertyId === property.id &&
          transaction.type === 'INCOME',
      );
      return {
        propertyId: property.id,
        name: property.name,
        revenue: propTx.reduce((sum, transaction) => sum + transaction.amount, 0),
      };
    });

    const completedMonths = monthly.filter((entry) => {
      const entryDate = new Date(entry.year, entry.month - 1, 1);
      return entryDate < new Date(currentYear, currentMonth, 1);
    });
    const forecastMonths = completedMonths.slice(-3);
    const forecastRevenue = forecastMonths.length
      ? Math.round(
          forecastMonths.reduce((sum, entry) => sum + entry.income, 0) /
            forecastMonths.length,
        )
      : 0;

    return {
      monthly,
      quarterly,
      propertyPerformance,
      occupancy: {
        total: totalRooms,
        rented: rentedRooms,
        available: availableRooms,
        maintenance: maintenanceRooms,
        rate:
          totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 100) : 0,
      },
      forecast: {
        revenue: forecastRevenue,
        basedOnMonths: forecastMonths.length,
        method: 'average_of_previous_3_completed_months',
      },
    };
  }
}
