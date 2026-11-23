import { isPublicHoliday } from '../utils/timeRules';

export interface CleaningMonthCol {
  key: string; // YYYY-MM e.g. '2026-11'
  labelTh: string; // e.g. 'พ.ย.-69'
  labelEn: string; // e.g. 'Nov 2026'
}

export interface WeekendPair {
  sat: string;
  sun: string;
}

export interface WeekendCleaningZoneRow {
  order: number;
  zoneTh: string;
  zoneEn: string;
  emoji: string;
  assignments: Record<string, WeekendPair>;
}

export const CLEANING_MONTH_COLUMNS: CleaningMonthCol[] = [
  { key: '2026-11', labelTh: 'พ.ย.-69', labelEn: 'Nov 2026' },
  { key: '2026-12', labelTh: 'ธ.ค.-69', labelEn: 'Dec 2026' },
  { key: '2027-01', labelTh: 'ม.ค.-70', labelEn: 'Jan 2027' },
  { key: '2027-02', labelTh: 'ก.พ.-70', labelEn: 'Feb 2027' },
  { key: '2027-03', labelTh: 'มี.ค.-70', labelEn: 'Mar 2027' },
  { key: '2027-04', labelTh: 'เม.ย.-70', labelEn: 'Apr 2027' },
  { key: '2027-05', labelTh: 'พ.ค.-70', labelEn: 'May 2027' },
];

export const WEEKEND_CLEANING_NOTE_HOLIDAY =
  'ถ้าอาทิตย์นั้นมีวันหยุดนักขัตฤกษ์-ปิดเทอม ให้ใช้เวรของวันเสาร์ของประจำเดือนนั้น สรุป ทุกคนจะได้ทำหน้าที่ 2 อย่างใน 1 เดือน';

export const WEEKEND_CLEANING_NOTE_EXCUSES =
  'ทุกวันเสาร์จะไม่มีพี่เสือ (พี่เสือฝึกงาน) ทุกวันอาทิตย์ จะไม่มีพี่กวาง (พี่กวางทำงาน)';

export const WEEKEND_CLEANING_NOTE_HOLIDAY_EN =
  'If a week includes a Public Holiday or School Break, follow Saturday’s duty for that month (so everyone does 2 roles per month).';

export const WEEKEND_CLEANING_NOTE_EXCUSES_EN =
  'Saturdays: P’Sua is absent (internship). Sundays: P’Kwang is absent (work).';

export const WEEKEND_CLEANING_ROSTER: WeekendCleaningZoneRow[] = [
  {
    order: 1,
    zoneTh: 'กวาดโรงของเล่น + เก็บโต๊ะ',
    zoneEn: 'Sweep Toy Hall & Tidy Tables',
    emoji: '🧸',
    assignments: {
      '2026-11': { sat: 'แน็ก', sun: 'โบว์' },
      '2026-12': { sat: 'บาส', sun: 'แน็ก' },
      '2027-01': { sat: 'ลีโอ', sun: 'แบงค์' },
      '2027-02': { sat: 'เก้า', sun: 'ฟ้า' },
      '2027-03': { sat: 'แน็ก', sun: 'ใบเตย' },
      '2027-04': { sat: 'ใบเตย', sun: 'แตงโม' },
      '2027-05': { sat: 'แน็ก', sun: 'ยิ้ม' },
    },
  },
  {
    order: 2,
    zoneTh: 'ถูโรงของเล่น',
    zoneEn: 'Mop Toy Hall',
    emoji: '🫧',
    assignments: {
      '2026-11': { sat: 'ฟ้า', sun: 'เก้า' },
      '2026-12': { sat: 'ใบเตย', sun: 'เสือ' },
      '2027-01': { sat: 'แบงค์', sun: 'ลีโอ' },
      '2027-02': { sat: 'ฟ้า', sun: 'ยิ้ม' },
      '2027-03': { sat: 'กวาง', sun: 'แตงโม' },
      '2027-04': { sat: 'แบงค์', sun: 'บาส' },
      '2027-05': { sat: 'กวาง', sun: 'ลีโอ' },
    },
  },
  {
    order: 3,
    zoneTh: 'กวาดห้องทีวี + เก็บอุปกรณ์',
    zoneEn: 'Sweep TV Room & Organize Gear',
    emoji: '📺',
    assignments: {
      '2026-11': { sat: 'เก้า', sun: 'แตงโม' },
      '2026-12': { sat: 'ยิ้ม', sun: 'ใบเตย' },
      '2027-01': { sat: 'บาส', sun: 'เสือ' },
      '2027-02': { sat: 'กวาง', sun: 'เก้า' },
      '2027-03': { sat: 'แบงค์', sun: 'โบว์' },
      '2027-04': { sat: 'ยิ้ม', sun: 'ยิ้ม' },
      '2027-05': { sat: 'ลีโอ', sun: 'แบงค์' },
    },
  },
  {
    order: 4,
    zoneTh: 'ถูห้องทีวี',
    zoneEn: 'Mop TV Room',
    emoji: '🧽',
    assignments: {
      '2026-11': { sat: 'แบงค์', sun: 'ฟ้า' },
      '2026-12': { sat: 'โบว์', sun: 'ฟ้า' },
      '2027-01': { sat: 'ยิ้ม', sun: 'ฟ้า' },
      '2027-02': { sat: 'ฟ้า', sun: 'แบงค์' },
      '2027-03': { sat: 'แตงโม', sun: 'ฟ้า' },
      '2027-04': { sat: 'แน็ก', sun: 'ลีโอ' },
      '2027-05': { sat: 'ยิ้ม', sun: 'เสือ' },
    },
  },
  {
    order: 5,
    zoneTh: 'กวาดโรงซักผ้า + เก็บไม้แขวนเสื้อ',
    zoneEn: 'Sweep Laundry Area & Collect Hangers',
    emoji: '🧺',
    assignments: {
      '2026-11': { sat: 'ใบเตย', sun: 'ฟ้า' },
      '2026-12': { sat: 'แตงโม', sun: 'โบว์' },
      '2027-01': { sat: 'ฟ้า', sun: 'โบว์' },
      '2027-02': { sat: 'บาส', sun: 'เสือ' },
      '2027-03': { sat: 'ยิ้ม', sun: 'ยิ้ม' },
      '2027-04': { sat: 'กวาง', sun: 'เก้า' },
      '2027-05': { sat: 'ใบเตย', sun: 'ฟ้า' },
    },
  },
  {
    order: 6,
    zoneTh: 'ถูโรงซักผ้า',
    zoneEn: 'Mop Laundry Area',
    emoji: '💧',
    assignments: {
      '2026-11': { sat: 'ฟ้า', sun: 'ยิ้ม' },
      '2026-12': { sat: 'กวาง', sun: 'แตงโม' },
      '2027-01': { sat: 'ใบเตย', sun: 'บาส' },
      '2027-02': { sat: 'ใบเตย', sun: 'ฟ้า' },
      '2027-03': { sat: 'บาส', sun: 'บาส' },
      '2027-04': { sat: 'ลีโอ', sun: 'เสือ' },
      '2027-05': { sat: 'เก้า', sun: 'เก้า' },
    },
  },
  {
    order: 7,
    zoneTh: 'กวาดใบไม้หน้าห้องครัว',
    zoneEn: 'Sweep Leaves in Front of Kitchen',
    emoji: '🍂',
    assignments: {
      '2026-11': { sat: 'ลีโอ', sun: 'ใบเตย' },
      '2026-12': { sat: 'แน็ก', sun: 'แบงค์' },
      '2027-01': { sat: 'แน็ก', sun: 'ยิ้ม' },
      '2027-02': { sat: 'ลีโอ', sun: 'ลีโอ' },
      '2027-03': { sat: 'ลีโอ', sun: 'แบงค์' },
      '2027-04': { sat: 'เก้า', sun: 'แน็ก' },
      '2027-05': { sat: 'โบว์', sun: 'ฟ้า' },
    },
  },
  {
    order: 8,
    zoneTh: 'กวาดใบไม้ร่องน้ำหน้าห้องครัว',
    zoneEn: 'Clear Kitchen Drain Gutter Leaves',
    emoji: '🌊',
    assignments: {
      '2026-11': { sat: 'บาส', sun: 'แบงค์' },
      '2026-12': { sat: 'เก้า', sun: 'ลีโอ' },
      '2027-01': { sat: 'ฟ้า', sun: 'ฟ้า' },
      '2027-02': { sat: 'แน็ก', sun: 'บาส' },
      '2027-03': { sat: 'โบว์', sun: 'ลีโอ' },
      '2027-04': { sat: 'โบว์', sun: 'ใบเตย' },
      '2027-05': { sat: 'แตงโม', sun: 'ใบเตย' },
    },
  },
  {
    order: 9,
    zoneTh: 'กวาดถูห้องพยาบาล',
    zoneEn: 'Sweep & Mop First-Aid Room',
    emoji: '🩺',
    assignments: {
      '2026-11': { sat: 'แตงโม', sun: 'ลีโอ' },
      '2026-12': { sat: 'ฟ้า', sun: 'บาส' },
      '2027-01': { sat: 'โบว์', sun: 'ใบเตย' },
      '2027-02': { sat: 'แตงโม', sun: 'แตงโม' },
      '2027-03': { sat: 'ฟ้า', sun: 'เสือ' },
      '2027-04': { sat: 'ฟ้า', sun: 'แบงค์' },
      '2027-05': { sat: 'ฟ้า', sun: 'แน็ก' },
    },
  },
  {
    order: 10,
    zoneTh: 'กวาดโดมด้านซ้าย',
    zoneEn: 'Sweep Dome Left Side',
    emoji: '⛺',
    assignments: {
      '2026-11': { sat: 'กวาง', sun: 'เสือ' },
      '2026-12': { sat: 'ฟ้า', sun: 'ยิ้ม' },
      '2027-01': { sat: 'กวาง', sun: 'เก้า' },
      '2027-02': { sat: 'ยิ้ม', sun: 'แน็ก' },
      '2027-03': { sat: 'ฟ้า', sun: 'ฟ้า' },
      '2027-04': { sat: 'แตงโม', sun: 'ฟ้า' },
      '2027-05': { sat: 'บาส', sun: 'โบว์' },
    },
  },
  {
    order: 11,
    zoneTh: 'กวาดโดมด้านขวา',
    zoneEn: 'Sweep Dome Right Side',
    emoji: '🏟️',
    assignments: {
      '2026-11': { sat: 'ยิ้ม', sun: 'บาส' },
      '2026-12': { sat: 'ลีโอ', sun: 'ฟ้า' },
      '2027-01': { sat: 'แตงโม', sun: 'แน็ก' },
      '2027-02': { sat: 'โบว์', sun: 'ใบเตย' },
      '2027-03': { sat: 'เก้า', sun: 'เก้า' },
      '2027-04': { sat: 'บาส', sun: 'ฟ้า' },
      '2027-05': { sat: 'ฟ้า', sun: 'บาส' },
    },
  },
  {
    order: 12,
    zoneTh: 'เก็บใบไม้ด้านบน',
    zoneEn: 'Collect Upper Yard Leaves',
    emoji: '🍃',
    assignments: {
      '2026-11': { sat: 'โบว์', sun: 'แน็ก' },
      '2026-12': { sat: 'แบงค์', sun: 'เก้า' },
      '2027-01': { sat: 'เก้า', sun: 'แตงโม' },
      '2027-02': { sat: 'แบงค์', sun: 'โบว์' },
      '2027-03': { sat: 'ใบเตย', sun: 'แน็ก' },
      '2027-04': { sat: 'ฟ้า', sun: 'โบว์' },
      '2027-05': { sat: 'แบงค์', sun: 'แตงโม' },
    },
  },
  {
    order: 13,
    zoneTh: 'เก็บเศษขยะหน้าห้องฝั่งผู้ชาย',
    zoneEn: 'Pick Up Litter Outside Boys Dorm',
    emoji: '👦',
    assignments: {
      '2026-11': { sat: 'เพชร', sun: 'เพชร' },
      '2026-12': { sat: 'เพชร', sun: 'เพชร' },
      '2027-01': { sat: 'เพชร', sun: 'เพชร' },
      '2027-02': { sat: 'เพชร', sun: 'เพชร' },
      '2027-03': { sat: 'เพชร', sun: 'เพชร' },
      '2027-04': { sat: 'เพชร', sun: 'เพชร' },
      '2027-05': { sat: 'เพชร', sun: 'เพชร' },
    },
  },
  {
    order: 14,
    zoneTh: 'เก็บเศษขยะหน้าห้องฝั่งผู้หญิง',
    zoneEn: 'Pick Up Litter Outside Girls Dorm',
    emoji: '👧',
    assignments: {
      '2026-11': { sat: 'หยก', sun: 'หยก' },
      '2026-12': { sat: 'หยก', sun: 'หยก' },
      '2027-01': { sat: 'หยก', sun: 'หยก' },
      '2027-02': { sat: 'หยก', sun: 'หยก' },
      '2027-03': { sat: 'หยก', sun: 'หยก' },
      '2027-04': { sat: 'หยก', sun: 'หยก' },
      '2027-05': { sat: 'หยก', sun: 'หยก' },
    },
  },
];

export const WEEKEND_CLEANING_KIDS: string[] = [
  'แน็ก',
  'โบว์',
  'ฟ้า',
  'เก้า',
  'แบงค์',
  'ใบเตย',
  'ลีโอ',
  'บาส',
  'แตงโม',
  'กวาง',
  'ยิ้ม',
  'เสือ',
  'เพชร',
  'หยก',
];

export interface ResolvedCleaningMonth {
  col: CleaningMonthCol;
  isExactMonth: boolean;
}

export function getCleaningMonthForDate(date: Date): ResolvedCleaningMonth {
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const exact = CLEANING_MONTH_COLUMNS.find((c) => c.key === ym);
  if (exact) {
    return { col: exact, isExactMonth: true };
  }
  // Wrap stably across the 7-month rotation for dates outside Nov 2026 - May 2027
  const monthsSinceNov2026 =
    (date.getFullYear() - 2026) * 12 + (date.getMonth() - 10);
  const idx =
    ((monthsSinceNov2026 % CLEANING_MONTH_COLUMNS.length) +
      CLEANING_MONTH_COLUMNS.length) %
    CLEANING_MONTH_COLUMNS.length;
  return { col: CLEANING_MONTH_COLUMNS[idx], isExactMonth: false };
}

export type CleaningDayType = 'sat' | 'sun';

export interface ResolvedCleaningDayContext {
  dayType: CleaningDayType | null;
  reason: 'saturday' | 'sunday' | 'holiday_uses_saturday' | null;
  reasonTh: string;
  reasonEn: string;
}

export function resolveCleaningDayType(
  date: Date,
  manualHolidayFlag = false
): ResolvedCleaningDayContext {
  const dow = date.getDay();
  if (dow === 6) {
    return {
      dayType: 'sat',
      reason: 'saturday',
      reasonTh: 'วันเสาร์ (ใช้เวรวันเสาร์ประจำเดือน)',
      reasonEn: 'Saturday (Monthly Saturday Roster)',
    };
  }
  if (dow === 0) {
    return {
      dayType: 'sun',
      reason: 'sunday',
      reasonTh: 'วันอาทิตย์ (ใช้เวรวันอาทิตย์ประจำเดือน)',
      reasonEn: 'Sunday (Monthly Sunday Roster)',
    };
  }
  if (isPublicHoliday(date, manualHolidayFlag)) {
    return {
      dayType: 'sat',
      reason: 'holiday_uses_saturday',
      reasonTh: 'วันหยุดนักขัตฤกษ์-ปิดเทอม (ตามหมายเหตุ: ใช้เวรวันเสาร์ประจำเดือน)',
      reasonEn: 'Public Holiday / School Break (Rule: uses Saturday Roster)',
    };
  }
  return {
    dayType: null,
    reason: null,
    reasonTh: 'วันเรียนปกติ (จันทร์–ศุกร์)',
    reasonEn: 'Regular School Day (Mon–Fri)',
  };
}

export interface WeekendZoneAssignmentItem {
  order: number;
  zoneTh: string;
  zoneEn: string;
  emoji: string;
  satKid: string;
  sunKid: string;
}

export function getWeekendCleaningRosterForMonth(
  monthKey: string
): WeekendZoneAssignmentItem[] {
  return WEEKEND_CLEANING_ROSTER.map((row) => {
    const pair = row.assignments[monthKey] ?? row.assignments['2026-11'];
    return {
      order: row.order,
      zoneTh: row.zoneTh,
      zoneEn: row.zoneEn,
      emoji: row.emoji,
      satKid: pair.sat,
      sunKid: pair.sun,
    };
  });
}

export interface KidWeekendCleaningSummary {
  month: ResolvedCleaningMonth;
  dayContext: ResolvedCleaningDayContext;
  todayZones: WeekendZoneAssignmentItem[];
  satZones: WeekendZoneAssignmentItem[];
  sunZones: WeekendZoneAssignmentItem[];
}

export function getWeekendCleaningForKid(
  kidNickname: string,
  date: Date,
  manualHolidayFlag = false,
  overrideMonthKey?: string
): KidWeekendCleaningSummary {
  const resolvedMonth = overrideMonthKey
    ? {
        col:
          CLEANING_MONTH_COLUMNS.find((c) => c.key === overrideMonthKey) ??
          CLEANING_MONTH_COLUMNS[0],
        isExactMonth: true,
      }
    : getCleaningMonthForDate(date);

  const monthRoster = getWeekendCleaningRosterForMonth(resolvedMonth.col.key);
  const normalized = kidNickname.trim();
  const satZones = monthRoster.filter((z) => z.satKid === normalized);
  const sunZones = monthRoster.filter((z) => z.sunKid === normalized);
  const dayContext = resolveCleaningDayType(date, manualHolidayFlag);

  const todayZones =
    dayContext.dayType === 'sat'
      ? satZones
      : dayContext.dayType === 'sun'
      ? sunZones
      : [];

  return {
    month: resolvedMonth,
    dayContext,
    todayZones,
    satZones,
    sunZones,
  };
}
