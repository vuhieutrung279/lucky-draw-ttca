export interface Participant {
  id: number;
  name: string;
  code: string;
  department: string;
}

export type PrizeKey = 'consolation' | 'third' | 'second' | 'first' | 'grand';

export interface PrizeConfig {
  key: PrizeKey;
  label: string;
  tierNumber: string;
  tierTitle: string;
  productName: string;
  productDetail: string;
  count: number;
  gridCols: number;
}

export const PRIZE_CONFIGS: PrizeConfig[] = [
  {
    key: 'consolation',
    label: '09 GIẢI KHUYẾN KHÍCH',
    tierNumber: '09',
    tierTitle: 'GIẢI KHUYẾN KHÍCH',
    productName: 'Pin sạc dự phòng Anker',
    productDetail: 'Nano Maggo Ultra Slim A1665 Qi2 5000mAh',
    count: 9,
    gridCols: 3,
  },
  {
    key: 'third',
    label: '05 GIẢI BA',
    tierNumber: '05',
    tierTitle: 'GIẢI BA',
    productName: 'AirPods 4',
    productDetail: '',
    count: 5,
    gridCols: 2,
  },
  {
    key: 'second',
    label: '03 GIẢI NHÌ',
    tierNumber: '03',
    tierTitle: 'GIẢI NHÌ',
    productName: 'Apple Watch',
    productDetail: 'SE 3 GPS',
    count: 3,
    gridCols: 1,
  },
  {
    key: 'first',
    label: '02 GIẢI NHẤT',
    tierNumber: '02',
    tierTitle: 'GIẢI NHẤT',
    productName: 'iPad Air M4',
    productDetail: '11 inch Wifi 128GB',
    count: 2,
    gridCols: 1,
  },
  {
    key: 'grand',
    label: '01 GIẢI ĐẶC BIỆT',
    tierNumber: '01',
    tierTitle: 'GIẢI ĐẶC BIỆT',
    productName: 'iPhone 18 Pro Max',
    productDetail: '',
    count: 1,
    gridCols: 1,
  },
];

export const PRIZE_DRAW_ORDER: PrizeKey[] = ['consolation', 'third', 'second', 'first', 'grand'];

const FIRST_NAMES = [
  'NGUYỄN', 'TRẦN', 'LÊ', 'PHẠM', 'HOÀNG', 'HUỲNH', 'PHAN', 'VŨ', 'VÕ', 'ĐẶNG',
  'BÙI', 'ĐỖ', 'HỒ', 'NGÔ', 'DƯƠNG', 'LÝ', 'ĐÀO', 'ĐINH', 'ĐOÀN', 'LÂM',
  'TRỊNH', 'MAI', 'CAO', 'HÀ', 'LƯƠNG', 'LƯU', 'THÁI', 'TÔ', 'TẠ', 'CHÂU'
];

const MIDDLE_NAMES = [
  'VĂN', 'THỊ', 'HỮU', 'ĐỨC', 'MINH', 'QUỐC', 'THANH', 'XUÂN', 'HOÀNG', 'NGỌC',
  'ĐÌNH', 'TIẾN', 'HẢI', 'QUANG', 'GIA', 'ANH', 'BẢO', 'TUẤN', 'DUY', 'TRỌNG',
  'KIM', 'PHƯƠNG', 'HỒNG', 'MẠNH', 'THẾ', 'VĨNH', 'CÔNG', 'KHÁNH', 'NHẬT', 'THÀNH'
];

const LAST_NAMES = [
  'AN', 'BÌNH', 'CƯỜNG', 'DŨNG', 'ĐẠT', 'HẢI', 'HIẾU', 'HOÀNG', 'HÙNG', 'HUY',
  'KHOA', 'KHÔI', 'KIÊN', 'LONG', 'MINH', 'NAM', 'NGHĨA', 'PHÚC', 'QUÂN', 'SƠN',
  'TÀI', 'TÂN', 'THẮNG', 'THÀNH', 'THỊNH', 'TOÀN', 'TRÍ', 'TRUNG', 'TUẤN', 'TÙNG',
  'VIỆT', 'VŨ', 'ANH', 'CHÂU', 'CHI', 'DUNG', 'HÀ', 'HẠNH', 'HOA', 'HƯƠNG',
  'LAN', 'LINH', 'MAI', 'MY', 'NGÂN', 'NGỌC', 'NHUNG', 'OANH', 'PHƯƠNG', 'QUỲNH',
  'THẢO', 'THU', 'THỦY', 'TRANG', 'TRINH', 'TRÚC', 'TUYẾT', 'UYÊN', 'VÂN', 'YẾN'
];

const DEPARTMENTS = [
  'IQI Vietnam', 'Sales Team A', 'Sales Team B', 'Sales Team C', 'Sales Prime',
  'Marketing & Growth', 'Operations', 'Finance & Accounting', 'Human Resources',
  'Tech & Digital', 'Customer Experience', 'Project Management', 'Asset Management'
];

function generate1000Participants(): Participant[] {
  const list: Participant[] = [];
  let id = 1;
  const usedCodes = new Set<string>();

  for (let i = 0; i < 1000; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const mn = MIDDLE_NAMES[(i * 7 + 3) % MIDDLE_NAMES.length];
    const ln = LAST_NAMES[(i * 13 + 5) % LAST_NAMES.length];
    const fullName = `${fn} ${mn} ${ln}`;
    const codeNum = 1001 + i;
    const code = `IQI - ${codeNum}`;
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];

    list.push({
      id: id++,
      name: fullName,
      code,
      department: dept,
    });
    usedCodes.add(code);
  }
  return list;
}

export const PARTICIPANTS: Participant[] = generate1000Participants();