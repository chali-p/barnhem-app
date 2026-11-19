import { Member } from '../types/barnhem';

export interface TrashDutyAssignee {
  kidId: string;
  displayNameTh: string;
  displayNameEn: string;
}

export interface TrashDutyWeekRow {
  weekNumber: number;
  startDate: Date; // Sunday
  endDate: Date; // Saturday
  sundayDate: Date;
  wednesdayDate: Date;
  rangeLabelTh: string;
  rangeLabelEn: string;
  sundayLabelTh: string;
  wednesdayLabelTh: string;
  sundayLabelEn: string;
  wednesdayLabelEn: string;
  boyAssignee: TrashDutyAssignee;
  girlAssignee: TrashDutyAssignee;
}

export interface TrashDutyTodayInfo extends TrashDutyWeekRow {
  isTrashDayToday: boolean;
  isSunday: boolean;
  isWednesday: boolean;
  nextTrashDayLabelTh: string;
  nextTrashDayLabelEn: string;
}

// Anchor: Week 1 starts Sunday 15 Nov 2026 (matches foundation spreadsheet schedules)
export const TRASH_DUTY_ANCHOR_YEAR = 2026;
export const TRASH_DUTY_ANCHOR_MONTH_INDEX = 10; // November (0-indexed)
export const TRASH_DUTY_ANCHOR_DAY = 15;

export const TRASH_DUTY_RULE_TH = '*รบกวนเด็กๆ ไม่ทิ้งขยะในห้องนอนค่ะ*';
export const TRASH_DUTY_RULE_EN = '*Please do not leave trash inside the bedrooms.*';

// Exact 7-week Boy Zone rotation
export const BOYS_TRASH_ROTATION: TrashDutyAssignee[] = [
  { kidId: 's1', displayNameTh: 'เสือ', displayNameEn: 'Suea' },
  { kidId: 's4', displayNameTh: 'แบงค์', displayNameEn: 'Bank' },
  { kidId: 's9', displayNameTh: 'แน็ก', displayNameEn: 'Nack' },
  { kidId: 'j1', displayNameTh: 'เก้า', displayNameEn: 'Kao' },
  { kidId: 'j2', displayNameTh: 'บาส', displayNameEn: 'Bas' },
  { kidId: 'j3', displayNameTh: 'ลีโอ', displayNameEn: 'Leo' },
  { kidId: 'j4', displayNameTh: 'เพชร', displayNameEn: 'Petch' },
];

// Exact 8-week Girl Zone rotation
export const GIRLS_TRASH_ROTATION: TrashDutyAssignee[] = [
  { kidId: 's2', displayNameTh: 'โบ', displayNameEn: 'Bow' },
  { kidId: 's3', displayNameTh: 'กวาง', displayNameEn: 'Kwang' },
  { kidId: 's5', displayNameTh: 'ใบเตย', displayNameEn: 'Baitoey' },
  { kidId: 's6', displayNameTh: 'ยิ้ม', displayNameEn: 'Yim' },
  { kidId: 's7', displayNameTh: 'ฟ้า', displayNameEn: 'Fah' },
  { kidId: 's8', displayNameTh: 'แตงโม', displayNameEn: 'Tangmo' },
  { kidId: 's10', displayNameTh: 'ฟา', displayNameEn: 'Fa' },
  { kidId: 'j5', displayNameTh: 'หยก+พี่เลี้ยง', displayNameEn: 'Yok + Staff' },
];

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const EN_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function positiveMod(n: number, mod: number): number {
  return ((n % mod) + mod) % mod;
}

function makeLocalDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function addDaysLocal(base: Date, days: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
    0,
    0,
    0,
    0
  );
}

export function formatThaiTrashDate(date: Date, withYear = true): string {
  const day = date.getDate();
  const month = THAI_SHORT_MONTHS[date.getMonth()];
  return withYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

export function formatEnTrashDate(date: Date, withYear = true): string {
  const day = date.getDate();
  const month = EN_SHORT_MONTHS[date.getMonth()];
  return withYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

export function getTrashDutyWeekByNumber(weekNumber: number): TrashDutyWeekRow {
  const anchor = makeLocalDate(
    TRASH_DUTY_ANCHOR_YEAR,
    TRASH_DUTY_ANCHOR_MONTH_INDEX,
    TRASH_DUTY_ANCHOR_DAY
  );
  const offsetWeeks = weekNumber - 1;
  const startDate = addDaysLocal(anchor, offsetWeeks * 7);
  const endDate = addDaysLocal(startDate, 6);
  const sundayDate = startDate;
  const wednesdayDate = addDaysLocal(startDate, 3);

  const crossYear = startDate.getFullYear() !== endDate.getFullYear();
  const rangeLabelTh = `${formatThaiTrashDate(startDate, crossYear)} - ${formatThaiTrashDate(
    endDate,
    true
  )}`;
  const rangeLabelEn = `${formatEnTrashDate(startDate, crossYear)} - ${formatEnTrashDate(
    endDate,
    true
  )}`;

  const boyAssignee =
    BOYS_TRASH_ROTATION[positiveMod(offsetWeeks, BOYS_TRASH_ROTATION.length)];
  const girlAssignee =
    GIRLS_TRASH_ROTATION[positiveMod(offsetWeeks, GIRLS_TRASH_ROTATION.length)];

  return {
    weekNumber,
    startDate,
    endDate,
    sundayDate,
    wednesdayDate,
    rangeLabelTh,
    rangeLabelEn,
    sundayLabelTh: formatThaiTrashDate(sundayDate, true),
    wednesdayLabelTh: formatThaiTrashDate(wednesdayDate, true),
    sundayLabelEn: formatEnTrashDate(sundayDate, true),
    wednesdayLabelEn: formatEnTrashDate(wednesdayDate, true),
    boyAssignee,
    girlAssignee,
  };
}

export function getTrashDutyWeekNumberForDate(date: Date): number {
  const localMidnight = makeLocalDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  // Find Sunday of target week
  const sundayOfTarget = addDaysLocal(localMidnight, -localMidnight.getDay());
  const anchor = makeLocalDate(
    TRASH_DUTY_ANCHOR_YEAR,
    TRASH_DUTY_ANCHOR_MONTH_INDEX,
    TRASH_DUTY_ANCHOR_DAY
  );

  // Use UTC midnight delta to avoid DST drift
  const utcTarget = Date.UTC(
    sundayOfTarget.getFullYear(),
    sundayOfTarget.getMonth(),
    sundayOfTarget.getDate()
  );
  const utcAnchor = Date.UTC(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate()
  );
  const diffDays = Math.round((utcTarget - utcAnchor) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks + 1;
}

export function getTrashDutyInfoForDate(now: Date): TrashDutyTodayInfo {
  const weekNumber = getTrashDutyWeekNumberForDate(now);
  const row = getTrashDutyWeekByNumber(weekNumber);
  const dow = now.getDay();
  const isSunday = dow === 0;
  const isWednesday = dow === 3;
  const isTrashDayToday = isSunday || isWednesday;

  let nextTrashDayLabelTh = '';
  let nextTrashDayLabelEn = '';
  if (isSunday) {
    nextTrashDayLabelTh = `วันนี้ เย็นวันอาทิตย์ (${row.sundayLabelTh})`;
    nextTrashDayLabelEn = `Today, Sunday Evening (${row.sundayLabelEn})`;
  } else if (isWednesday) {
    nextTrashDayLabelTh = `วันนี้ เย็นวันพุธ (${row.wednesdayLabelTh})`;
    nextTrashDayLabelEn = `Today, Wednesday Evening (${row.wednesdayLabelEn})`;
  } else if (dow < 3) {
    nextTrashDayLabelTh = `รอบถัดไป: เย็นวันพุธ ${row.wednesdayLabelTh}`;
    nextTrashDayLabelEn = `Next: Wed Evening ${row.wednesdayLabelEn}`;
  } else {
    const nextWeek = getTrashDutyWeekByNumber(weekNumber + 1);
    nextTrashDayLabelTh = `รอบถัดไป: เย็นวันอาทิตย์ ${nextWeek.sundayLabelTh}`;
    nextTrashDayLabelEn = `Next: Sun Evening ${nextWeek.sundayLabelEn}`;
  }

  return {
    ...row,
    isTrashDayToday,
    isSunday,
    isWednesday,
    nextTrashDayLabelTh,
    nextTrashDayLabelEn,
  };
}

export function generateTrashDutySchedule(
  weeksCount = 16,
  startWeekNumber = 1
): TrashDutyWeekRow[] {
  const rows: TrashDutyWeekRow[] = [];
  for (let i = 0; i < weeksCount; i += 1) {
    rows.push(getTrashDutyWeekByNumber(startWeekNumber + i));
  }
  return rows;
}

export function isKidAssignedTrashWeek(
  kid: Member,
  weekInfo: TrashDutyWeekRow
): boolean {
  return (
    kid.id === weekInfo.boyAssignee.kidId ||
    kid.id === weekInfo.girlAssignee.kidId
  );
}

export function getKitchenSlotsLabelsForKid(kid: Member, lang: 'th' | 'en'): string[] {
  const slots: string[] = [];
  if (kid.kitchenDuty?.evening1530) {
    slots.push(lang === 'th' ? 'เย็น 15:30 น.' : 'Evening 15:30');
  }
  if (kid.kitchenDuty?.sat0930) {
    slots.push(lang === 'th' ? 'เช้าเสาร์/นักขัตฯ 09:30 น.' : 'Sat/Holiday 09:30');
  }
  if (kid.kitchenDuty?.sun0915) {
    slots.push(lang === 'th' ? 'เช้าอาทิตย์ 09:15 น.' : 'Sun 09:15');
  }
  return slots;
}
