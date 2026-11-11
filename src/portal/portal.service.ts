import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MaintenancePriority } from '@prisma/client';

@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) { }

  async getInvoices(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        contract: {
          tenantId: tenantId,
        },
      },
      include: {
        contract: {
          include: {
            room: {
              include: {
                landlord: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    bankName: true,
                    bankAccount: true,
                    bankAccountName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => {
      let paymentLink = inv.paymentLink;
      const landlord = inv.contract?.room?.landlord;

      if (!paymentLink && landlord?.bankName && landlord?.bankAccount) {
        const invoiceCode = inv.invoiceCode || `HD${inv.month}${inv.year}`;
        const addInfo = `RT ${invoiceCode}`;
        paymentLink = `https://img.vietqr.io/image/${landlord.bankName}-${landlord.bankAccount}-compact2.png?amount=${inv.totalAmount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(landlord.bankAccountName || landlord.name)}`;
      }

      return {
        ...inv,
        paymentLink,
      };
    });
  }

  async getNotices(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new UnauthorizedException();

    const contract = await this.getActiveContract(tenantId);

    return this.prisma.notice.findMany({
      where: {
        landlordId: tenant.landlordId,
        OR: [
          { roomId: null },
          contract ? { roomId: contract.roomId } : {}
        ]
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMaintenanceRequests(tenantId: string) {
    return this.prisma.maintenanceRequest.findMany({
      where: { tenantId },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUtilityReadings(tenantId: string) {
    const contract = await this.getActiveContract(tenantId);
    if (!contract) return [];

    return this.prisma.utilityReading.findMany({
      where: { contractId: contract.id },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
    });
  }

  async getActiveContract(tenantId: string) {
    return this.prisma.contract.findFirst({
      where: { tenantId, isActive: true },
      include: { room: true, roommates: true },
    });
  }

  async updateProfile(tenantId: string, data: { phone?: string, email?: string, idCardFront?: string, idCardBack?: string, avatar?: string }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data
    });
  }

  async requestRoommateChange(tenantId: string, data: { type: 'ADD' | 'REMOVE', fullName: string, cccd?: string, phone?: string }) {
    const contract = await this.getActiveContract(tenantId);
    if (!contract) throw new BadRequestException("Không tìm thấy hợp đồng đang thuê");

    const title = data.type === 'ADD'
      ? `Yêu cầu thêm thành viên ở ghép`
      : `Yêu cầu xóa thành viên ở ghép`;

    const description = `Họ tên: ${data.fullName}\nCCCD: ${data.cccd || 'Không có'}\nSĐT: ${data.phone || 'Không có'}\nLoại: ${data.type === 'ADD' ? 'Thêm mới' : 'Xóa bỏ'}`;

    return this.prisma.maintenanceRequest.create({
      data: {
        tenantId,
        roomId: contract.roomId,
        title,
        description,
        priority: MaintenancePriority.MEDIUM,
      }
    });
  }

  async createMaintenanceRequest(tenantId: string, data: { title: string, description: string, priority: MaintenancePriority, imageUrl?: string }) {
    const contract = await this.getActiveContract(tenantId);
    if (!contract) throw new BadRequestException("Không tìm thấy hợp đồng đang thuê");
    return this.prisma.maintenanceRequest.create({
      data: {
        tenantId,
        roomId: contract.roomId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        imageUrl: data.imageUrl,
      }
    });
  }

  async submitUtilityReading(tenantId: string, data: { month: number, year: number, electricityCurr: number, waterCurr: number, imageUrl?: string }) {
    const contract = await this.getActiveContract(tenantId);
    if (!contract) throw new BadRequestException("Không tìm thấy hợp đồng đang thuê");

    let prevMonth = data.month - 1;
    let prevYear = data.year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const prevReading = await this.prisma.utilityReading.findUnique({
      where: {
        contractId_month_year: {
          contractId: contract.id,
          month: prevMonth,
          year: prevYear
        }
      }
    });

    return this.prisma.utilityReading.create({
      data: {
        contractId: contract.id,
        month: data.month,
        year: data.year,
        electricityPrev: prevReading ? prevReading.electricityCurr : 0,
        electricityCurr: data.electricityCurr,
        waterPrev: prevReading ? prevReading.waterCurr : 0,
        waterCurr: data.waterCurr,
        imageUrl: data.imageUrl
      }
    });
  }
}
