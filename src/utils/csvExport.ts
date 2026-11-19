import { AppState } from '../types/barnhem';
import { ensureCurrentWeekAllowance, isKidAwayOnDate } from './piggyBank';
import { getDateKey } from './timeRules';

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadKidsSummaryCsv(state: AppState, now: Date): void {
  const todayKey = getDateKey(now);
  const kids = state.members.filter((m) => m.role === 'kid');

  const headers = [
    'ID',
    'กลุ่ม',
    'ชื่อเล่น',
    'ชื่อ-นามสกุล',
    'ดาวสะสม',
    'กระปุกหมูสีชมพู (บาท)',
    'หักผิดกฎสัปดาห์นี้ (บาท)',
    'ค่าปรับมาสายค้าง (บาท)',
    'สิทธิ์การ์ตูน/มือถือ',
    'สถานะลาพัก/ไม่อยู่บ้าน',
    'แจ้งป่วยวันนี้',
    'เช็คข้าวเช้า',
    'เช็ครถตู้/กะเช้า',
    'เช็คกลับบ้าน',
    'เช็คเรียนเสริม',
    'เช็คงานบ้าน',
    'เช็คคืนมือถือ',
  ];

  const rows = kids.map((kid) => {
    const { allowance } = ensureCurrentWeekAllowance(kid, now, state.settings);
    const away = isKidAwayOnDate(kid, todayKey);
    const sickToday = state.sickReports.some(
      (r) => r.kidId === kid.id && r.dateKey === todayKey && !r.resolved
    );
    const phoneBlocked =
      kid.penalty.phoneConfiscatedUntil1830Date === todayKey ||
      kid.penalty.noEveningPhoneTomorrowDate === todayKey;

    const privilegeLabel =
      kid.group === 1
        ? kid.daily.bossStageUnlocked
          ? 'ปลดล็อกการ์ตูนแล้ว'
          : 'รอปลดล็อก 20:00'
        : phoneBlocked
        ? 'งดใช้มือถือตามโทษ'
        : 'ปกติ';

    return [
      kid.id,
      `กลุ่ม ${kid.group ?? 1}`,
      kid.nickname,
      kid.fullName,
      kid.stars,
      allowance.coins,
      allowance.weeklyPenaltyThb,
      kid.penalty.lateFineThb,
      privilegeLabel,
      away ? `ลาพักถึง ${allowance.awayUntilDateKey} (${allowance.awayReason || 'ไม่อยู่บ้าน'})` : 'อยู่บ้านปกติ',
      sickToday ? 'ป่วย (งดหัก/งดปรับ)' : 'ปกติ',
      kid.daily.breakfastChecked ? 'เช็คแล้ว' : '-',
      kid.daily.vanOrMorningChecked ? 'เช็คแล้ว' : '-',
      kid.daily.returnedHomeChecked ? 'เช็คแล้ว' : '-',
      kid.daily.extraStudyChecked ? 'เช็คแล้ว' : '-',
      kid.daily.choresChecked ? 'เช็คแล้ว' : '-',
      kid.daily.phoneReturnedChecked ? 'เช็คแล้ว' : '-',
    ];
  });

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  // Prefix UTF-8 BOM so Thai characters open cleanly in Microsoft Excel & Google Sheets
  const blob = new Blob([`\uFEFF${csvLines}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `barnhem-daily-report-${todayKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
