import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto, landlordId: string) {
    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room || room.landlordId !== landlordId) {
        throw new BadRequestException('Phòng không hợp lệ');
      }
    }

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: dto.invoiceId },
        include: { contract: { include: { room: true } } }
      });
      if (!invoice || invoice.contract.room.landlordId !== landlordId) {
        throw new BadRequestException('Hóa đơn không hợp lệ');
      }
    }

    return this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
        roomId: dto.roomId,
        invoiceId: dto.invoiceId,
        landlordId,
      },
    });
  }

  async findAll(landlordId: string, filters: { type?: 'INCOME' | 'EXPENSE', roomId?: string, month?: number, year?: number }) {
    const whereClause: any = { landlordId };

    if (filters.type) whereClause.type = filters.type;
    if (filters.roomId) whereClause.roomId = filters.roomId;

    if (filters.month || filters.year) {
      const now = new Date();
      const year = filters.year || now.getFullYear();
      if (filters.month) {
        const startDate = new Date(year, filters.month - 1, 1);
        const endDate = new Date(year, filters.month, 1);
        whereClause.date = { gte: startDate, lt: endDate };
      } else {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);
        whereClause.date = { gte: startDate, lt: endDate };
      }
    }

    return this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        room: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, landlordId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, landlordId },
      include: { room: true },
    });
    if (!transaction) throw new NotFoundException('Không tìm thấy giao dịch');
    return transaction;
  }

  async remove(id: string, landlordId: string) {
    const transaction = await this.findOne(id, landlordId);
    if (transaction.invoiceId) {
      throw new BadRequestException('Không thể xóa giao dịch được sinh ra tự động từ hóa đơn. Vui lòng hủy thanh toán hóa đơn thay thế.');
    }
    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
