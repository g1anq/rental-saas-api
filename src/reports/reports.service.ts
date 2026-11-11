import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportMonthlyReport(
    landlordId: string,
    monthParam?: string,
    res?: Response,
  ) {
    let year: number;
    let month: number;

    if (monthParam === undefined) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    } else {
      const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
      year = match ? Number(match[1]) : 0;
      month = match ? Number(match[2]) : 0;

      if (!match || year === 0 || month < 1 || month > 12) {
        throw new BadRequestException(
          'Định dạng tháng không hợp lệ. Vui lòng truyền format YYYY-MM (VD: 2026-10).',
        );
      }
    }

    const startDate = new Date(0);
    startDate.setFullYear(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(0);
    endDate.setFullYear(year, month, 1);
    endDate.setHours(0, 0, 0, 0);

    const [paidInvoices, properties, allRooms] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          status: 'PAID',
          paidAt: { gte: startDate, lt: endDate },
          contract: { room: { landlordId } },
        },
        include: {
          contract: {
            include: {
              room: { include: { property: true } },
              tenant: true,
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.prisma.property.findMany({
        where: { landlordId },
        include: { rooms: { select: { id: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.room.findMany({
        where: { landlordId },
        include: {
          property: { select: { name: true } },
          contracts: {
            where: { isActive: true },
            include: { tenant: true },
          },
        },
        orderBy: [{ property: { name: 'asc' } }, { name: 'asc' }],
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rental SaaS System';
    workbook.created = new Date();

    const receiptsSheet = workbook.addWorksheet('Thu tiền');
    receiptsSheet.mergeCells('A1:G1');
    receiptsSheet.getCell('A1').value =
      `DANH SÁCH THU TIỀN THÁNG ${month}/${year}`;
    receiptsSheet.getCell('A1').font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    receiptsSheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    receiptsSheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    receiptsSheet.getRow(1).height = 36;
    receiptsSheet.columns = [
      { key: 'index', width: 8 },
      { key: 'invoiceCode', width: 18 },
      { key: 'property', width: 22 },
      { key: 'room', width: 16 },
      { key: 'tenant', width: 24 },
      { key: 'paidAt', width: 20 },
      { key: 'amount', width: 20 },
    ];
    receiptsSheet.getRow(2).values = [
      'STT',
      'Mã hóa đơn',
      'Khu trọ',
      'Phòng',
      'Khách thuê',
      'Ngày thanh toán',
      'Số tiền thu',
    ];
    receiptsSheet.getRow(2).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let totalRevenue = 0;
    paidInvoices.forEach((invoice, index) => {
      totalRevenue += invoice.totalAmount;
      const row = receiptsSheet.addRow({
        index: index + 1,
        invoiceCode: invoice.invoiceCode ?? '',
        property: invoice.contract.room.property?.name ?? 'Chưa phân khu',
        room: invoice.contract.room.name,
        tenant: invoice.contract.tenant.fullName,
        paidAt: invoice.paidAt,
        amount: invoice.totalAmount,
      });
      row.getCell('paidAt').numFmt = 'dd/mm/yyyy';
      row.getCell('amount').numFmt = '#,##0 "đ"';
    });

    const receiptTotalRow = receiptsSheet.addRow({
      tenant: 'TỔNG THU:',
      amount: totalRevenue,
    });
    receiptTotalRow.font = { bold: true };
    receiptTotalRow.getCell('amount').numFmt = '#,##0 "đ"';

    const propertySheet = workbook.addWorksheet('Doanh thu theo khu');
    propertySheet.mergeCells('A1:F1');
    propertySheet.getCell('A1').value =
      `DOANH THU THEO KHU TRỌ THÁNG ${month}/${year}`;
    propertySheet.getCell('A1').font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    propertySheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    propertySheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    propertySheet.getRow(1).height = 36;
    propertySheet.columns = [
      { key: 'index', width: 8 },
      { key: 'property', width: 24 },
      { key: 'address', width: 32 },
      { key: 'rooms', width: 14 },
      { key: 'receipts', width: 16 },
      { key: 'revenue', width: 22 },
    ];
    propertySheet.getRow(2).values = [
      'STT',
      'Khu trọ',
      'Địa chỉ',
      'Số phòng',
      'Số khoản thu',
      'Tổng doanh thu',
    ];
    propertySheet.getRow(2).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    properties.forEach((property, index) => {
      const propertyInvoices = paidInvoices.filter(
        (invoice) => invoice.contract.room.propertyId === property.id,
      );
      const row = propertySheet.addRow({
        index: index + 1,
        property: property.name,
        address: property.address,
        rooms: property.rooms.length,
        receipts: propertyInvoices.length,
        revenue: propertyInvoices.reduce(
          (sum, invoice) => sum + invoice.totalAmount,
          0,
        ),
      });
      row.getCell('revenue').numFmt = '#,##0 "đ"';
    });

    const unassignedInvoices = paidInvoices.filter(
      (invoice) => invoice.contract.room.propertyId === null,
    );
    if (unassignedInvoices.length > 0) {
      const row = propertySheet.addRow({
        index: properties.length + 1,
        property: 'Chưa phân khu',
        address: '',
        rooms: 0,
        receipts: unassignedInvoices.length,
        revenue: unassignedInvoices.reduce(
          (sum, invoice) => sum + invoice.totalAmount,
          0,
        ),
      });
      row.getCell('revenue').numFmt = '#,##0 "đ"';
    }

    const propertyTotalRow = propertySheet.addRow({
      property: 'TỔNG DOANH THU:',
      revenue: totalRevenue,
    });
    propertyTotalRow.font = { bold: true };
    propertyTotalRow.getCell('revenue').numFmt = '#,##0 "đ"';

    const roomSheet = workbook.addWorksheet('Thống kê phòng');
    roomSheet.mergeCells('A1:F1');
    roomSheet.getCell('A1').value =
      'THỐNG KÊ TÌNH TRẠNG PHÒNG HIỆN TẠI';
    roomSheet.getCell('A1').font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    roomSheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' },
    };
    roomSheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    roomSheet.getRow(1).height = 36;

    const totalRooms = allRooms.length;
    const rentedRooms = allRooms.filter(
      (room) => room.status === 'RENTED',
    ).length;
    const availableRooms = allRooms.filter(
      (room) => room.status === 'AVAILABLE',
    ).length;
    const maintenanceRooms = allRooms.filter(
      (room) => room.status === 'MAINTENANCE',
    ).length;
    const rate = (count: number) =>
      `${totalRooms > 0 ? Math.round((count / totalRooms) * 100) : 0}%`;

    roomSheet.addRow(['Tổng số phòng', totalRooms]);
    roomSheet.addRow(['Đang cho thuê', rentedRooms, rate(rentedRooms)]);
    roomSheet.addRow(['Còn trống', availableRooms, rate(availableRooms)]);
    roomSheet.addRow(['Đang bảo trì', maintenanceRooms, rate(maintenanceRooms)]);
    roomSheet.addRow([]);
    roomSheet.addRow([
      'STT',
      'Phòng',
      'Khu trọ',
      'Trạng thái',
      'Khách thuê',
      'Số điện thoại',
    ]);
    roomSheet.getRow(7).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    roomSheet.columns = [
      { width: 10 },
      { width: 18 },
      { width: 24 },
      { width: 20 },
      { width: 26 },
      { width: 20 },
    ];

    allRooms.forEach((room, index) => {
      const tenant = room.contracts[0]?.tenant;
      const status =
        room.status === 'RENTED'
          ? 'Đang cho thuê'
          : room.status === 'AVAILABLE'
            ? 'Còn trống'
            : 'Đang bảo trì';
      roomSheet.addRow([
        index + 1,
        room.name,
        room.property?.name ?? 'Chưa phân khu',
        status,
        tenant?.fullName ?? '',
        tenant?.phone ?? '',
      ]);
    });

    if (res) {
      res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Bao_cao_nha_tro_thang_${month}_${year}.xlsx"`,
      );
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    return workbook.xlsx.writeBuffer();
  }
}
