import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { AuditAction, InvoiceStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
  ) {}

  // Tạo hóa đơn tháng — tự động tính tiền điện/nước từ chỉ số đã ghi
  async create(dto: CreateInvoiceDto, landlordId: string) {
    // Lấy hợp đồng kèm giá điện/nước và thông tin ngân hàng của chủ nhà
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId, room: { landlordId } },
      include: { room: { include: { landlord: true } }, roommates: true },
    });
    if (!contract) throw new NotFoundException(`Không tìm thấy hợp đồng ID: ${dto.contractId}`);
    if (!contract.isActive) throw new BadRequestException('Hợp đồng đã kết thúc, không thể tạo hóa đơn');

    // Kiểm tra hóa đơn tháng này đã tồn tại chưa
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        contractId: dto.contractId,
        month: dto.month,
        year: dto.year,
      },
    });
    if (existingInvoice) {
      throw new ConflictException(`Hóa đơn tháng ${dto.month}/${dto.year} cho hợp đồng này đã tồn tại`);
    }

    // Lấy chỉ số điện/nước của tháng đó (nếu có)
    const utilityReading = await this.prisma.utilityReading.findFirst({
      where: {
        contractId: dto.contractId,
        month: dto.month,
        year: dto.year,
      },
    });

    // Tính tiền điện/nước
    let electricityAmount = 0;
    let waterAmount = 0;

    const customServices = Array.isArray(contract.customServices) ? contract.customServices : [];

    // Tách riêng cấu hình bậc thang nếu có
    const elecTierConfig = customServices.find((s: any) => s.type === 'ELECTRICITY_TIERED');
    const waterTierConfig = customServices.find((s: any) => s.type === 'WATER_TIERED');

    if (utilityReading) {
      const elecUsed = utilityReading.electricityCurr - utilityReading.electricityPrev;
      const waterUsed = utilityReading.waterCurr - utilityReading.waterPrev;

      // Tính tiền điện
      if (elecTierConfig && (elecTierConfig as any).tiers && (elecTierConfig as any).tiers.length > 0) {
        let remaining = elecUsed;
        electricityAmount = 0;
        let prevLimit = 0;
        for (const tier of (elecTierConfig as any).tiers) {
          const tierVolume = tier.limit - prevLimit;
          if (remaining > tierVolume) {
            electricityAmount += tierVolume * tier.price;
            remaining -= tierVolume;
            prevLimit = tier.limit;
          } else {
            electricityAmount += remaining * tier.price;
            remaining = 0;
            break;
          }
        }
        if (remaining > 0) {
          // Bậc cuối cùng (vượt mức cao nhất)
          const highestTier = (elecTierConfig as any).tiers[(elecTierConfig as any).tiers.length - 1];
          electricityAmount += remaining * highestTier.price;
        }
      } else {
        electricityAmount = elecUsed * contract.electricityRate;
      }

      // Tính tiền nước
      if (waterTierConfig && (waterTierConfig as any).tiers && (waterTierConfig as any).tiers.length > 0) {
        let remaining = waterUsed;
        waterAmount = 0;
        let prevLimit = 0;
        for (const tier of (waterTierConfig as any).tiers) {
          const tierVolume = tier.limit - prevLimit;
          if (remaining > tierVolume) {
            waterAmount += tierVolume * tier.price;
            remaining -= tierVolume;
            prevLimit = tier.limit;
          } else {
            waterAmount += remaining * tier.price;
            remaining = 0;
            break;
          }
        }
        if (remaining > 0) {
          const highestTier = (waterTierConfig as any).tiers[(waterTierConfig as any).tiers.length - 1];
          waterAmount += remaining * highestTier.price;
        }
      } else {
        waterAmount = waterUsed * contract.waterRate;
      }
    }

    const rentAmount = contract.room.price;
    const otherAmount = dto.otherAmount ?? 0;

    let customServicesAmount = 0;
    const numPeople = 1 + (contract.roommates?.length || 0);

    if (customServices.length > 0) {
      customServicesAmount = customServices.reduce((sum: number, s: any) => {
        if (s.type === 'ELECTRICITY_TIERED' || s.type === 'WATER_TIERED') return sum;
        const amount = Number(s.amount) || 0;
        if (s.type === 'PER_PERSON') {
          return sum + (amount * numPeople);
        }
        return sum + amount; // Mặc định là PER_ROOM
      }, 0);
    }

    const totalAmount = rentAmount + electricityAmount + waterAmount + customServicesAmount + otherAmount;

    // Tạo VietQR Payment Link
    let paymentLink = null;
    const landlord: any = contract.room.landlord;
    const invoiceCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (landlord.bankName && landlord.bankAccount) {
      const addInfo = `RT ${invoiceCode}`;
      // Format: https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-compact2.png?amount=<AMOUNT>&addInfo=<DESCRIPTION>&accountName=<ACCOUNT_NAME>
      paymentLink = `https://img.vietqr.io/image/${landlord.bankName}-${landlord.bankAccount}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(landlord.bankAccountName || landlord.name)}`;
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        contractId: dto.contractId,
        invoiceCode,
        month: dto.month,
        year: dto.year,
        rentAmount,
        electricityAmount,
        waterAmount,
        customServices,
        otherAmount,
        totalAmount,
        paymentLink,
        notes: dto.notes,
      },
      include: {
        contract: { include: { room: true, tenant: true } },
      },
    });

    // Tự động gửi email hóa đơn cho khách thuê nếu có email
    if (invoice.contract.tenant?.email) {
      // Gọi không await để không làm chậm response API
      this.mailService.sendNewInvoiceEmail(
        invoice.contract.tenant.email,
        invoice.contract.tenant.fullName,
        invoice.contract.room.name,
        invoice.month,
        invoice.year,
        invoice.totalAmount,
        invoice.paymentLink || undefined,
      ).catch(err => console.error("Lỗi gửi email nền:", err));
    }

    return invoice;
  }

  // Tạo hóa đơn hàng loạt cho tất cả các phòng đang thuê
  async createBulk(dto: { month: number; year: number; otherAmount?: number; notes?: string }, landlordId: string) {
    // 1. Lấy tất cả hợp đồng đang hiệu lực của landlord
    const activeContracts = await this.prisma.contract.findMany({
      where: {
        room: { landlordId },
        isActive: true,
      },
      select: { id: true },
    });

    if (activeContracts.length === 0) {
      throw new BadRequestException('Không có hợp đồng nào đang hiệu lực để tạo hóa đơn');
    }

    let createdCount = 0;
    let skippedCount = 0;

    // 2. Duyệt qua từng hợp đồng và gọi hàm create (hoặc tự xử lý để tối ưu hơn)
    for (const contract of activeContracts) {
      try {
        await this.create({
          contractId: contract.id,
          month: dto.month,
          year: dto.year,
          otherAmount: dto.otherAmount,
          notes: dto.notes,
        }, landlordId);
        createdCount++;
      } catch (error) {
        // Bỏ qua lỗi ConflictException (hóa đơn đã tồn tại)
        if (error instanceof ConflictException) {
          skippedCount++;
        } else {
          console.error(`Lỗi tạo hóa đơn cho hợp đồng ${contract.id}:`, error);
        }
      }
    }

    return {
      success: true,
      message: `Tạo thành công ${createdCount} hóa đơn. Bỏ qua ${skippedCount} hóa đơn đã tồn tại.`,
      createdCount,
      skippedCount,
    };
  }

  // Lấy tất cả hóa đơn (có thể lọc theo tháng/năm/trạng thái/phân trang)
  async findAll(landlordId: string, filters?: { month?: number; year?: number; status?: InvoiceStatus; propertyId?: string; page?: number; limit?: number }) {
    const where = {
      contract: {
        room: {
          landlordId,
          ...(filters?.propertyId ? { propertyId: filters.propertyId } : {})
        }
      },
      month: filters?.month,
      year: filters?.year,
      status: filters?.status,
    };

    const include = {
      contract: { include: { room: { include: { landlord: true } }, tenant: true } },
    };
    const orderBy: any = [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }];

    // Hàm tiện ích format paymentLink cho hóa đơn
    const mapInvoice = (inv: any) => {
      let paymentLink = inv.paymentLink;
      const landlord = (inv.contract?.room as any)?.landlord;

      if (!paymentLink && landlord?.bankName && landlord?.bankAccount) {
        const invoiceCode = inv.invoiceCode || `HD${inv.month}${inv.year}`;
        const addInfo = `RT ${invoiceCode}`;
        paymentLink = `https://img.vietqr.io/image/${landlord.bankName}-${landlord.bankAccount}-compact2.png?amount=${inv.totalAmount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(landlord.bankAccountName || landlord.name)}`;
      }

      return {
        ...inv,
        paymentLink,
      };
    };

    // Nếu có yêu cầu phân trang
    if (filters?.page !== undefined || filters?.limit !== undefined) {
      const pageNum = Math.max(1, Number(filters.page) || 1);
      const limitNum = Math.max(1, Number(filters.limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      const [invoices, total] = await Promise.all([
        this.prisma.invoice.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limitNum,
        }),
        this.prisma.invoice.count({ where }),
      ]);

      return {
        data: invoices.map(mapInvoice),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include,
      orderBy,
    });

    return invoices.map(mapInvoice);
  }

  // Lấy chi tiết một hóa đơn
  async findOne(id: string, landlordId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, contract: { room: { landlordId } } },
      include: {
        contract: { include: { room: { include: { landlord: true } }, tenant: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    return invoice;
  }

  // Cập nhật hóa đơn (trạng thái, ghi chú, link QR...)
  async update(id: string, dto: UpdateInvoiceDto, landlordId: string) {
    const invoice = await this.findOne(id, landlordId);

    const updateData: any = { ...dto };

    // Nếu cập nhật otherAmount thì tính lại totalAmount
    if (dto.otherAmount !== undefined) {
      const rent = (invoice as any).rentAmount ?? 0;
      const elec = (invoice as any).electricityAmount ?? 0;
      const water = (invoice as any).waterAmount ?? 0;
      updateData.totalAmount = rent + elec + water + dto.otherAmount;

      const landlord = (invoice as any).contract.room.landlord;
      if (landlord.bankName && landlord.bankAccount) {
        const addInfo = `Thanh toan tien phong ${invoice.contract.room.name} thang ${invoice.month}`;
        updateData.paymentLink = `https://img.vietqr.io/image/${landlord.bankName}-${landlord.bankAccount}-compact2.png?amount=${updateData.totalAmount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(landlord.bankAccountName || landlord.name)}`;
      }
    }

    // Nếu đánh dấu PAID thì tự động ghi thời gian thanh toán và tạo Lịch sử giao dịch (Transaction)
    if (dto.status === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID) {
      updateData.paidAt = new Date();

      // Thực hiện Transaction của database để đảm bảo tính toàn vẹn
      const updated = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.invoice.update({
          where: { id },
          data: updateData,
          include: { contract: { include: { room: { include: { landlord: true } }, tenant: true } } },
        });

        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: updated.totalAmount,
            description: `Thu tiền phòng ${updated.contract.room.name} tháng ${updated.month}/${updated.year}`,
            date: new Date(),
            landlordId: landlordId,
            roomId: updated.contract.roomId,
            invoiceId: updated.id,
          }
        });

        await tx.auditLog.create({
          data: {
            landlordId,
            action: AuditAction.INVOICE_PAID,
            entityType: 'Invoice',
            entityId: updated.id,
            details: {
              invoiceCode: updated.invoiceCode,
              roomId: updated.contract.roomId,
              roomName: updated.contract.room.name,
              amount: updated.totalAmount,
              paymentMethod: 'manual',
            },
          },
        });

        // Gửi thông báo Telegram cho chủ trọ
        const landlord = updated.contract.room.landlord;
        if (landlord.telegramChatId) {
          const msg = `💰 <b>Thanh toán thành công!</b>\n\nPhòng: <b>${updated.contract.room.name}</b>\nTháng: ${updated.month}/${updated.year}\nSố tiền: ${new Intl.NumberFormat('vi-VN').format(updated.totalAmount)}đ\n\n<i>${updated.contract.tenant.fullName} đã thanh toán hóa đơn.</i>`;
          this.notificationsService.sendTelegramMessage(landlord.telegramChatId, msg).catch(err => console.error("Lỗi gửi Telegram:", err));
        }

        return updated;
      });

      this.notificationsService.notifyTenantInvoicePaid(
        updated.contract.tenant.id,
        {
          invoiceId: updated.id,
          invoiceCode: updated.invoiceCode,
          month: updated.month,
          year: updated.year,
          amount: updated.totalAmount,
          roomName: updated.contract.room.name,
        },
      );

      return updated;
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { contract: { include: { room: true, tenant: true } } },
    });
  }

  // Đánh dấu thanh toán nhanh
  async markAsPaid(id: string, landlordId: string) {
    return this.update(id, { status: InvoiceStatus.PAID }, landlordId);
  }

  // Hàm tự động đánh dấu OVERDUE các hóa đơn quá hạn (gọi bằng cron job sau)
  async markOverdueInvoices(landlordId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Do updateMany không hỗ trợ filter quá sâu với relation,
    // chúng ta sẽ lấy danh sách ID hóa đơn thỏa mãn trước
    const invoices = await this.prisma.invoice.findMany({
      where: {
        contract: { room: { landlordId } },
        status: InvoiceStatus.UNPAID,
        OR: [
          { year: { lt: currentYear } },
          { year: currentYear, month: { lt: currentMonth } },
        ],
      },
      select: { id: true }
    });

    if (invoices.length === 0) return { markedOverdue: 0 };

    const result = await this.prisma.invoice.updateMany({
      where: {
        id: { in: invoices.map(inv => inv.id) }
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    return { markedOverdue: result.count };
  }

  // Thống kê doanh thu theo tháng/năm
  async getRevenueStats(year: number, landlordId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { year, status: InvoiceStatus.PAID, contract: { room: { landlordId } } },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthInvoices = invoices.filter((inv) => inv.month === month);
      const totalRevenue = monthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const rentRevenue = monthInvoices.reduce((sum, inv) => sum + inv.rentAmount, 0);
      const electricityRevenue = monthInvoices.reduce((sum, inv) => sum + inv.electricityAmount, 0);
      const waterRevenue = monthInvoices.reduce((sum, inv) => sum + inv.waterAmount, 0);

      return {
        month,
        totalRevenue,
        rentRevenue,
        electricityRevenue,
        waterRevenue,
        servicesRevenue: totalRevenue - rentRevenue - electricityRevenue - waterRevenue,
        invoiceCount: monthInvoices.length,
      };
    });

    return {
      year,
      totalRevenue: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalRent: invoices.reduce((sum, inv) => sum + inv.rentAmount, 0),
      totalElectricity: invoices.reduce((sum, inv) => sum + inv.electricityAmount, 0),
      totalWater: invoices.reduce((sum, inv) => sum + inv.waterAmount, 0),
      monthly,
    };
  }

  // Gửi email nhắc nợ cho một hóa đơn
  async sendReminder(id: string, landlordId: string) {
    const invoice = await this.findOne(id, landlordId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Hóa đơn này đã được thanh toán, không cần nhắc nợ.');
    }

    const tenant = invoice.contract.tenant;
    const room = invoice.contract.room;

    if (!tenant.email) {
      throw new BadRequestException('Khách thuê này chưa cập nhật địa chỉ email.');
    }

    const success = await this.mailService.sendInvoiceReminder(
      tenant.email,
      tenant.fullName,
      room.name,
      invoice.month,
      invoice.year,
      invoice.totalAmount,
      invoice.paymentLink || undefined,
    );

    if (!success) {
      throw new BadRequestException('Gửi email thất bại. Vui lòng kiểm tra lại cấu hình SMTP.');
    }

    return { success: true, message: 'Đã gửi email nhắc nợ thành công.' };
  }

  // Gửi email nhắc nợ hàng loạt cho tất cả các hóa đơn chưa thanh toán của tháng/năm chỉ định
  async sendBulkReminders(month: number, year: number, landlordId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        contract: { room: { landlordId } },
        month,
        year,
        status: InvoiceStatus.UNPAID,
      },
      include: {
        contract: { include: { room: true, tenant: true } },
      },
    });

    if (invoices.length === 0) {
      throw new BadRequestException(`Không có hóa đơn nào chưa thanh toán trong tháng ${month}/${year} để nhắc nợ.`);
    }

    let successCount = 0;
    let failCount = 0;

    for (const invoice of invoices) {
      const tenant = invoice.contract.tenant;
      const room = invoice.contract.room;

      if (!tenant.email) {
        failCount++;
        continue;
      }

      try {
        const success = await this.mailService.sendInvoiceReminder(
          tenant.email,
          tenant.fullName,
          room.name,
          invoice.month,
          invoice.year,
          invoice.totalAmount,
          invoice.paymentLink || undefined,
        );
        if (success) successCount++;
        else failCount++;
      } catch (error) {
        failCount++;
      }
    }

    return {
      success: true,
      message: `Đã gửi thành công ${successCount} email. Thất bại hoặc không có email: ${failCount}.`,
      successCount,
      failCount,
    };
  }
}
