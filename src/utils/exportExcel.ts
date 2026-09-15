import * as XLSX from 'xlsx';
import type { Participant, PrizeConfig } from '../data/participants';

export interface WonRecord {
  prizeKey: string;
  prizeLabel: string;
  productName: string;
  productDetail: string;
  slotIndex: number;
  winner: Participant;
}

export function sanitizeFileName(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function getPrizeExcelFileName(tierTitle?: string, productName?: string): string {
  if (tierTitle && productName) {
    return `Ket_Qua_${sanitizeFileName(tierTitle)}_${sanitizeFileName(productName)}.xlsx`;
  } else if (tierTitle) {
    return `Ket_Qua_${sanitizeFileName(tierTitle)}.xlsx`;
  }
  return 'Ket_Qua_Tong_Ket_Lucky_Draw_Genesis.xlsx';
}

export function exportGenesisLuckyDrawToExcel(
  records: WonRecord[],
  fileName = 'Ket_Qua_Tong_Ket_Lucky_Draw_Genesis.xlsx'
) {
  const hasDepartment = records.some(r => Boolean(r.winner.department));

  const data = records.map((r, idx) => {
    const item: Record<string, any> = {
      'STT': idx + 1,
      'Hạng Giải': r.prizeLabel,
      'Sản Phẩm Trúng Thưởng': r.productDetail ? `${r.productName} - ${r.productDetail}` : r.productName,
      'Họ Và Tên': r.winner.name,
      'Mã Khách': r.winner.code,
    };
    if (hasDepartment) {
      item['Phòng Ban'] = r.winner.department || '';
    }
    return item;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 45 },
    { wch: 30 },
    { wch: 18 },
    ...(hasDepartment ? [{ wch: 24 }] : []),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ket Qua Lucky Draw');

  XLSX.writeFile(workbook, fileName);
}
