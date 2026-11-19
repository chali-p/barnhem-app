import { Language, StaffLeaveRecord, StaffLeaveSpan } from '../types/barnhem';
import { getDateKey } from '../utils/timeRules';

export const CORE_ROSTER_STAFF = [
  'พี่เอก',
  'พี่กุ๊ก',
  'พี่เกด',
  'พี่กิ๊ก',
  'พี่แบงค์',
  'ป้าเหมียว',
] as const;

export interface DailyStaffScheduleRow {
  dayIndex: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  dayTh: string;
  dayEn: string;
  shiftATh: string;
  shiftAEn: string;
  shiftBTh: string;
  shiftBEn: string;
  shiftCTh: string;
  shiftCEn: string;
  shiftDTh: string;
  shiftDEn: string;
  dayOffTh: string;
  dayOffEn: string;
  nightWatchTh: string;
  nightWatchEn: string;
  drivingMorningTh: string;
  drivingMorningEn: string;
  drivingEveningTh: string;
  drivingEveningEn: string;
  eveningDriverHighlight?: boolean;
}

export const WEEKLY_STAFF_SCHEDULE: DailyStaffScheduleRow[] = [
  {
    dayIndex: 1,
    dayTh: 'จันทร์',
    dayEn: 'Mon',
    shiftATh: 'พี่กุ๊ก',
    shiftAEn: "P'Kuk",
    shiftBTh: '—',
    shiftBEn: '—',
    shiftCTh: '—',
    shiftCEn: '—',
    shiftDTh: 'พี่เอก · พี่เกด · พี่กิ๊ก',
    shiftDEn: "P'Ek · P'Kade · P'Kik",
    dayOffTh: '—',
    dayOffEn: '—',
    nightWatchTh: 'พี่เอก',
    nightWatchEn: "P'Ek",
    drivingMorningTh: 'พี่แบงค์ / พี่กุ๊ก',
    drivingMorningEn: 'bank / kuk',
    drivingEveningTh: 'พี่กิ๊ก',
    drivingEveningEn: 'kik',
  },
  {
    dayIndex: 2,
    dayTh: 'อังคาร',
    dayEn: 'Tue',
    shiftATh: 'พี่เอก',
    shiftAEn: "P'Ek",
    shiftBTh: '—',
    shiftBEn: '—',
    shiftCTh: '—',
    shiftCEn: '—',
    shiftDTh: 'พี่เกด · พี่กุ๊ก · พี่กิ๊ก',
    shiftDEn: "P'Kade · P'Kuk · P'Kik",
    dayOffTh: '—',
    dayOffEn: '—',
    nightWatchTh: 'พี่เกด',
    nightWatchEn: "P'Kade",
    drivingMorningTh: 'พี่แบงค์',
    drivingMorningEn: 'bank',
    drivingEveningTh: 'พี่กุ๊ก / พี่กิ๊ก',
    drivingEveningEn: 'kuk / kik',
  },
  {
    dayIndex: 3,
    dayTh: 'พุธ',
    dayEn: 'Wed',
    shiftATh: 'พี่เกด',
    shiftAEn: "P'Kade",
    shiftBTh: '—',
    shiftBEn: '—',
    shiftCTh: '—',
    shiftCEn: '—',
    shiftDTh: 'พี่เอก · พี่กุ๊ก · พี่กิ๊ก',
    shiftDEn: "P'Ek · P'Kuk · P'Kik",
    dayOffTh: '—',
    dayOffEn: '—',
    nightWatchTh: 'พี่กิ๊ก',
    nightWatchEn: "P'Kik",
    drivingMorningTh: 'พี่แบงค์',
    drivingMorningEn: 'bank',
    drivingEveningTh: 'พี่แบงค์ / พี่กุ๊ก / พี่กิ๊ก',
    drivingEveningEn: 'bank / kuk / kik',
  },
  {
    dayIndex: 4,
    dayTh: 'พฤหัสบดี',
    dayEn: 'Thu',
    shiftATh: 'พี่กิ๊ก',
    shiftAEn: "P'Kik",
    shiftBTh: '—',
    shiftBEn: '—',
    shiftCTh: '—',
    shiftCEn: '—',
    shiftDTh: 'พี่เอก · พี่กุ๊ก',
    shiftDEn: "P'Ek · P'Kuk",
    dayOffTh: 'พี่เกด',
    dayOffEn: "P'Kade",
    nightWatchTh: 'พี่กุ๊ก',
    nightWatchEn: "P'Kuk",
    drivingMorningTh: 'พี่แบงค์ / พี่กิ๊ก',
    drivingMorningEn: 'bank / kik',
    drivingEveningTh: 'พี่แบงค์ / พี่กุ๊ก',
    drivingEveningEn: 'bank / kuk',
  },
  {
    dayIndex: 5,
    dayTh: 'ศุกร์',
    dayEn: 'Fri',
    shiftATh: 'พี่กุ๊ก',
    shiftAEn: "P'Kuk",
    shiftBTh: '—',
    shiftBEn: '—',
    shiftCTh: '—',
    shiftCEn: '—',
    shiftDTh: 'พี่เอก · พี่เกด',
    shiftDEn: "P'Ek · P'Kade",
    dayOffTh: 'พี่กิ๊ก',
    dayOffEn: "P'Kik",
    nightWatchTh: 'พี่เอก',
    nightWatchEn: "P'Ek",
    drivingMorningTh: 'พี่แบงค์ / พี่กุ๊ก',
    drivingMorningEn: 'bank / kuk',
    drivingEveningTh: 'ป้าเหมียว',
    drivingEveningEn: 'Miew',
    eveningDriverHighlight: true,
  },
  {
    dayIndex: 6,
    dayTh: 'เสาร์',
    dayEn: 'Sat',
    shiftATh: '—',
    shiftAEn: '—',
    shiftBTh: 'พี่เอก',
    shiftBEn: "P'Ek",
    shiftCTh: 'พี่กิ๊ก',
    shiftCEn: "P'Kik",
    shiftDTh: 'พี่เกด',
    shiftDEn: "P'Kade",
    dayOffTh: 'พี่กุ๊ก',
    dayOffEn: "P'Kuk",
    nightWatchTh: 'พี่เกด',
    nightWatchEn: "P'Kade",
    drivingMorningTh: 'พี่กิ๊ก (เช้า–เย็น)',
    drivingMorningEn: 'kik (All day)',
    drivingEveningTh: 'พี่กิ๊ก (เช้า–เย็น)',
    drivingEveningEn: 'kik (All day)',
  },
  {
    dayIndex: 0,
    dayTh: 'อาทิตย์',
    dayEn: 'Sun',
    shiftATh: '—',
    shiftAEn: '—',
    shiftBTh: 'พี่เกด',
    shiftBEn: "P'Kade",
    shiftCTh: 'พี่กิ๊ก',
    shiftCEn: "P'Kik",
    shiftDTh: 'พี่กุ๊ก',
    shiftDEn: "P'Kuk",
    dayOffTh: 'พี่เอก',
    dayOffEn: "P'Ek",
    nightWatchTh: 'พี่กุ๊ก',
    nightWatchEn: "P'Kuk",
    drivingMorningTh: 'พี่กิ๊ก',
    drivingMorningEn: 'kik',
    drivingEveningTh: 'พี่กุ๊ก',
    drivingEveningEn: 'kook',
  },
];

export function getStaffScheduleForDate(date: Date): DailyStaffScheduleRow {
  const day = date.getDay();
  return (
    WEEKLY_STAFF_SCHEDULE.find((r) => r.dayIndex === day) ?? WEEKLY_STAFF_SCHEDULE[0]
  );
}

export function getMorningStaffInfo(
  row: DailyStaffScheduleRow,
  options: {
    lang: Language;
    isHolidayOrSchoolBreak?: boolean;
    morningAbsentSubstitute?: boolean;
  }
): {
  regularStaff: string;
  shiftTime: string;
  effectiveStaff: string;
  substituteNote: string | null;
} {
  const { lang, isHolidayOrSchoolBreak, morningAbsentSubstitute } = options;
  const isWeekend = row.dayIndex === 0 || row.dayIndex === 6;
  const regularStaff =
    row.shiftATh !== '—'
      ? lang === 'th'
        ? row.shiftATh
        : row.shiftAEn
      : lang === 'th'
      ? row.shiftBTh
      : row.shiftBEn;

  const shiftTime =
    !isWeekend && isHolidayOrSchoolBreak
      ? '07:00–15:00 (กะ B วันหยุด)'
      : row.shiftATh !== '—'
      ? '05:30–13:30 (กะ A)'
      : '07:00–15:00 (กะ B)';

  if (!morningAbsentSubstitute) {
    return {
      regularStaff,
      shiftTime,
      effectiveStaff: regularStaff,
      substituteNote: null,
    };
  }

  // Thursday (dayIndex === 4): normal morning is P'Kik -> if P'Kik is away, P'Kuk covers Thursday morning!
  if (row.dayIndex === 4) {
    const sub = lang === 'th' ? 'พี่กุ๊ก (เข้าแทนพี่กิ๊ก)' : "P'Kuk (Covering P'Kik)";
    return {
      regularStaff,
      shiftTime,
      effectiveStaff: sub,
      substituteNote:
        lang === 'th'
          ? 'วันพฤหัสฯ หากพี่กิ๊กเข้าเช้าไม่อยู่ พี่กุ๊กจะเข้าแทนเพิ่มอีก 1 วันค่ะ'
          : "On Thursdays, if P'Kik is away in the morning, P'Kuk covers!",
    };
  }

  // Any other day: if morning staff is away, P'Kik covers all!
  const subAll = lang === 'th' ? 'พี่กิ๊ก (เข้าแทนทั้งหมด)' : "P'Kik (Morning Substitute)";
  return {
    regularStaff,
    shiftTime,
    effectiveStaff: subAll,
    substituteNote:
      lang === 'th'
        ? 'หากพี่เลี้ยงเข้าเช้าไม่อยู่ พี่กิ๊กจะเป็นคนเข้าแทนทั้งหมดค่ะ'
        : "Whenever morning staff is away, P'Kik covers the morning shift.",
  };
}

export function parseDateKeyToLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function parseTimeToMinutes(hhmm?: string): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return 11 * 60;
  const [h, m] = hhmm.trim().split(':').map(Number);
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

export function formatMinutesToHHMM(mins: number): string {
  const safe = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function parseRosterNames(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return [];
  return trimmed
    .split(/[·/,]/)
    .map((part) => part.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

export function isLeaveCoveringTime(
  leave: StaffLeaveRecord,
  minutesOfDay: number
): boolean {
  if (leave.status !== 'active') return false;
  if (leave.span === 'full_day') return true;
  if (leave.span === 'morning') {
    return minutesOfDay < 13 * 60 + 30;
  }
  const fromMin = parseTimeToMinutes(leave.leaveFromTime || '11:00');
  return minutesOfDay >= fromMin;
}

export function formatLeaveSpanTh(leave: StaffLeaveRecord): string {
  if (leave.span === 'full_day') return 'ทั้งวัน';
  if (leave.span === 'morning') return 'ครึ่งเช้า (05:30–13:30 น.)';
  return `ตั้งแต่ ${leave.leaveFromTime || '11:00'} น. เป็นต้นไป`;
}

export function formatLeaveKindTh(kind: StaffLeaveRecord['kind']): string {
  if (kind === 'emergency') return '⚡ ลากะทันหัน';
  if (kind === 'sick') return '🤒 ลาป่วย';
  if (kind === 'swap') return '🔁 แลกกะ';
  return '📝 ลากิจ';
}

export interface ShiftPersonStatus {
  name: string;
  status: 'on_duty' | 'on_leave' | 'substitute';
  leave?: StaffLeaveRecord;
  replacingName?: string;
}

export interface ActiveShiftSlotSummary {
  slotCode: 'A' | 'B' | 'C' | 'D' | 'NW';
  labelTh: string;
  labelEn: string;
  timeRange: string;
  scheduledNames: string[];
  entries: ShiftPersonStatus[];
  activeCount: number;
  warningTh: string | null;
}

export interface DateTimeCoverageSummary {
  dateKey: string;
  timeLabel: string;
  minutesOfDay: number;
  row: DailyStaffScheduleRow;
  activeSlots: ActiveShiftSlotSummary[];
  onDutyNowNames: string[];
  substituteNowEntries: { subName: string; replacingName: string; slotLabel: string }[];
  onLeaveNowEntries: { leave: StaffLeaveRecord; affectedSlots: string[] }[];
  leavesForDate: StaffLeaveRecord[];
  alertsTh: { severity: 'critical' | 'warning' | 'info'; text: string }[];
}

export function getShiftCoverageAtDateTime(
  targetDate: Date,
  minutesOfDay: number,
  leaves: StaffLeaveRecord[],
  isHolidayOrSchoolBreak = false
): DateTimeCoverageSummary {
  const dateKey = getDateKey(targetDate);
  const row = getStaffScheduleForDate(targetDate);
  const isWeekend = row.dayIndex === 0 || row.dayIndex === 6;

  // For early-morning Night Watch (00:00-05:29), check previous day's evening Night Watch roster & leaves
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateKey = getDateKey(prevDate);
  const prevRow = getStaffScheduleForDate(prevDate);

  const activeLeaves = leaves.filter((l) => l.status === 'active');
  const leavesForDate = activeLeaves.filter((l) => l.dateKey === dateKey);
  const leavesForPrevDate = activeLeaves.filter((l) => l.dateKey === prevDateKey);

  const activeSlots: ActiveShiftSlotSummary[] = [];
  const alertsTh: { severity: 'critical' | 'warning' | 'info'; text: string }[] = [];

  const evaluateSlot = (
    slotCode: 'A' | 'B' | 'C' | 'D' | 'NW',
    labelTh: string,
    labelEn: string,
    timeRange: string,
    rawNames: string,
    slotLeaves: StaffLeaveRecord[],
    evalMinute: number,
    autoMorningSubRule = false
  ) => {
    const scheduledNames = parseRosterNames(rawNames);
    if (scheduledNames.length === 0) return;

    const entries: ShiftPersonStatus[] = [];
    for (const person of scheduledNames) {
      const matchedLeave = slotLeaves.find(
        (l) => l.staffName === person && isLeaveCoveringTime(l, evalMinute)
      );
      if (matchedLeave) {
        entries.push({
          name: person,
          status: 'on_leave',
          leave: matchedLeave,
        });
        const explicitSub = matchedLeave.substituteName?.trim();
        if (explicitSub) {
          entries.push({
            name: explicitSub,
            status: 'substitute',
            leave: matchedLeave,
            replacingName: person,
          });
        } else if (autoMorningSubRule) {
          const autoSub = row.dayIndex === 4 ? 'พี่กุ๊ก' : 'พี่กิ๊ก';
          entries.push({
            name: `${autoSub} (ตามกติกาแทนเช้า)`,
            status: 'substitute',
            leave: matchedLeave,
            replacingName: person,
          });
        }
      } else {
        entries.push({
          name: person,
          status: 'on_duty',
        });
      }
    }

    const activeCount = entries.filter((e) => e.status !== 'on_leave').length;
    let warningTh: string | null = null;
    if (activeCount === 0) {
      warningTh =
        slotCode === 'NW'
          ? `🚨 เวรไนท์วอช (${timeRange}) ยังไม่มีคนเข้าเวรแทน!`
          : `🚨 ${labelTh} (${timeRange}) ยังไม่มีผู้ดูแลเข้าเวรในช่วงเวลานี้!`;
    } else if (slotCode === 'D' && scheduledNames.length >= 2 && activeCount === 1) {
      warningTh = `⚠️ กะเย็น D เหลือผู้ดูแล 1 คน (ปกติมี ${scheduledNames.length} คน)`;
    }

    activeSlots.push({
      slotCode,
      labelTh,
      labelEn,
      timeRange,
      scheduledNames,
      entries,
      activeCount,
      warningTh,
    });
  };

  // Shift A
  if (row.shiftATh !== '—') {
    const startA = !isWeekend && isHolidayOrSchoolBreak ? 7 * 60 : 5 * 60 + 30;
    const endA = !isWeekend && isHolidayOrSchoolBreak ? 15 * 60 : 13 * 60 + 30;
    const rangeA = !isWeekend && isHolidayOrSchoolBreak ? '07:00–15:00' : '05:30–13:30';
    if (minutesOfDay >= startA && minutesOfDay < endA) {
      evaluateSlot(
        'A',
        !isWeekend && isHolidayOrSchoolBreak ? 'กะ A (ปรับเป็น B วันหยุด)' : 'กะเช้า A',
        'Morning A',
        rangeA,
        row.shiftATh,
        leavesForDate,
        minutesOfDay,
        true
      );
    }
  }

  // Shift B
  if (row.shiftBTh !== '—' && minutesOfDay >= 7 * 60 && minutesOfDay < 15 * 60) {
    evaluateSlot('B', 'กะเช้า B', 'Morning B', '07:00–15:00', row.shiftBTh, leavesForDate, minutesOfDay, true);
  }

  // Shift C
  if (row.shiftCTh !== '—' && minutesOfDay >= 9 * 60 && minutesOfDay < 17 * 60) {
    evaluateSlot('C', 'กะกลางวัน C', 'Midday C', '09:00–17:00', row.shiftCTh, leavesForDate, minutesOfDay);
  }

  // Shift D
  if (row.shiftDTh !== '—' && minutesOfDay >= 15 * 60 && minutesOfDay < 23 * 60) {
    evaluateSlot('D', 'กะเย็น D', 'Evening D', '15:00–23:00', row.shiftDTh, leavesForDate, minutesOfDay);
  }

  // Night Watch
  if (minutesOfDay >= 23 * 60) {
    evaluateSlot('NW', 'เวรไนท์วอช (คืนนี้)', 'Night Watch', '23:00–05:30', row.nightWatchTh, leavesForDate, minutesOfDay);
  } else if (minutesOfDay < 5 * 60 + 30) {
    // Overnight from previous evening: evaluate against previous date's leaves (full_day or afternoon_from_time)
    const overnightLeaves = leavesForPrevDate.filter((l) => l.span !== 'morning');
    evaluateSlot('NW', 'เวรไนท์วอช (ต่อเนื่องเมื่อคืน)', 'Overnight Watch', '23:00–05:30', prevRow.nightWatchTh, overnightLeaves, 23 * 60 + 30);
  }

  // Gather deduplicated active personnel, substitutes, and on-leave personnel at this exact time
  const onDutySet = new Set<string>();
  const substituteNowEntries: { subName: string; replacingName: string; slotLabel: string }[] = [];
  const leaveMap = new Map<string, { leave: StaffLeaveRecord; affectedSlots: Set<string> }>();

  for (const slot of activeSlots) {
    for (const entry of slot.entries) {
      if (entry.status === 'on_duty') {
        onDutySet.add(entry.name);
      } else if (entry.status === 'substitute') {
        onDutySet.add(entry.name);
        substituteNowEntries.push({
          subName: entry.name,
          replacingName: entry.replacingName || '',
          slotLabel: slot.labelTh,
        });
      } else if (entry.status === 'on_leave' && entry.leave) {
        const existing = leaveMap.get(entry.leave.id);
        if (existing) {
          existing.affectedSlots.add(slot.labelTh);
        } else {
          leaveMap.set(entry.leave.id, {
            leave: entry.leave,
            affectedSlots: new Set([slot.labelTh]),
          });
        }
      }
    }
    if (slot.warningTh) {
      alertsTh.push({
        severity: slot.activeCount === 0 ? 'critical' : 'warning',
        text: slot.warningTh,
      });
    }
  }

  // Also add date-wide risk alerts for leaves later today (so morning users see evening/night watch risks immediately!)
  for (const lv of leavesForDate) {
    const impact = analyzeStaffLeaveImpact(
      lv.staffName,
      lv.dateKey,
      lv.span,
      lv.leaveFromTime,
      isHolidayOrSchoolBreak
    );
    if (!lv.substituteName?.trim() && impact.needsSubstitute) {
      const msg = `${formatLeaveKindTh(lv.kind)} ${lv.staffName} (${formatLeaveSpanTh(lv)}) กระทบ: ${impact.affectedDuties.join(', ')} — ยังไม่ระบุคนเข้าแทน`;
      if (!alertsTh.some((a) => a.text.includes(lv.staffName) && a.text.includes('ยังไม่ระบุคนเข้าแทน'))) {
        alertsTh.push({
          severity: impact.hasNightWatch ? 'critical' : 'warning',
          text: msg,
        });
      }
    } else if (!lv.acknowledgedBy) {
      alertsTh.push({
        severity: 'info',
        text: `🔔 มีใบแจ้งลาใหม่รอผู้จัดการรับทราบ: ${lv.staffName} (${formatLeaveSpanTh(lv)})${
          lv.substituteName ? ` · แทนโดย ${lv.substituteName}` : ''
        }`,
      });
    }
  }

  return {
    dateKey,
    timeLabel: formatMinutesToHHMM(minutesOfDay),
    minutesOfDay,
    row,
    activeSlots,
    onDutyNowNames: Array.from(onDutySet),
    substituteNowEntries,
    onLeaveNowEntries: Array.from(leaveMap.values()).map((v) => ({
      leave: v.leave,
      affectedSlots: Array.from(v.affectedSlots),
    })),
    leavesForDate,
    alertsTh,
  };
}

export interface StaffLeaveImpactSummary {
  dayTh: string;
  affectedDuties: string[];
  hasMorningShift: boolean;
  hasNightWatch: boolean;
  needsSubstitute: boolean;
  suggestedSubstitute: string | null;
  coWorkersInShift: string[];
  summaryTh: string;
}

export function analyzeStaffLeaveImpact(
  staffName: string,
  dateKey: string,
  span: StaffLeaveSpan,
  leaveFromTime?: string,
  isHolidayOrSchoolBreak = false
): StaffLeaveImpactSummary {
  const dateObj = parseDateKeyToLocalDate(dateKey);
  const row = getStaffScheduleForDate(dateObj);
  const isWeekend = row.dayIndex === 0 || row.dayIndex === 6;
  const fromMin = parseTimeToMinutes(leaveFromTime || '11:00');
  const affectedDuties: string[] = [];
  const coWorkersSet = new Set<string>();
  let hasMorningShift = false;
  let hasNightWatch = false;
  let needsSubstitute = false;
  let suggestedSubstitute: string | null = null;

  const overlapsRange = (startMin: number, endMin: number) => {
    if (span === 'full_day') return true;
    if (span === 'morning') return startMin < 13 * 60 + 30;
    return endMin > fromMin;
  };

  // Shift A
  const startA = !isWeekend && isHolidayOrSchoolBreak ? 7 * 60 : 5 * 60 + 30;
  const endA = !isWeekend && isHolidayOrSchoolBreak ? 15 * 60 : 13 * 60 + 30;
  if (parseRosterNames(row.shiftATh).includes(staffName) && overlapsRange(startA, endA)) {
    hasMorningShift = true;
    needsSubstitute = true;
    suggestedSubstitute = row.dayIndex === 4 ? 'พี่กุ๊ก' : 'พี่กิ๊ก';
    affectedDuties.push(!isWeekend && isHolidayOrSchoolBreak ? 'กะเช้า A→B (07:00–15:00)' : 'กะเช้า A (05:30–13:30)');
  }

  // Shift B
  if (parseRosterNames(row.shiftBTh).includes(staffName) && overlapsRange(7 * 60, 15 * 60)) {
    hasMorningShift = true;
    needsSubstitute = true;
    suggestedSubstitute = 'พี่กิ๊ก';
    affectedDuties.push('กะเช้า B (07:00–15:00)');
  }

  // Shift C
  if (parseRosterNames(row.shiftCTh).includes(staffName) && overlapsRange(9 * 60, 17 * 60)) {
    needsSubstitute = true;
    affectedDuties.push('กะกลางวัน C (09:00–17:00)');
  }

  // Shift D
  const dNames = parseRosterNames(row.shiftDTh);
  if (dNames.includes(staffName) && overlapsRange(15 * 60, 23 * 60)) {
    const others = dNames.filter((n) => n !== staffName);
    others.forEach((n) => coWorkersSet.add(n));
    affectedDuties.push(
      others.length > 0
        ? `กะเย็น D (15:00–23:00 · เหลือ ${others.join(', ')})`
        : 'กะเย็น D (15:00–23:00 · ไม่มีคนเหลือ!)'
    );
    if (others.length <= 1) needsSubstitute = true;
  }

  // Night Watch
  if (parseRosterNames(row.nightWatchTh).includes(staffName) && span !== 'morning') {
    hasNightWatch = true;
    needsSubstitute = true;
    affectedDuties.push('🌙 เวรไนท์วอชคืนนี้ (23:00–05:30)');
  }

  // Driving
  if (parseRosterNames(row.drivingMorningTh).includes(staffName) && overlapsRange(6 * 60, 9 * 60)) {
    affectedDuties.push('🚐 ขับรถรอบเช้า');
  }
  if (parseRosterNames(row.drivingEveningTh).includes(staffName) && overlapsRange(15 * 60, 19 * 60)) {
    affectedDuties.push('🚐 ขับรถรอบเย็น');
  }

  const isDayOff = parseRosterNames(row.dayOffTh).includes(staffName);

  const summaryTh =
    affectedDuties.length > 0
      ? `วัน${row.dayTh} ${staffName} มีเวรที่กระทบ: ${affectedDuties.join(' · ')}${
          suggestedSubstitute ? ` (แนะนำ: ${suggestedSubstitute} เข้าแทนกะเช้า)` : ''
        }`
      : isDayOff
      ? `วัน${row.dayTh} เป็นวันหยุดประจำสัปดาห์ของ ${staffName} อยู่แล้ว`
      : `วัน${row.dayTh} ช่วงเวลาที่เลือก ${staffName} ไม่มีเวรกะหลักที่ซ้อนทับ`;

  return {
    dayTh: row.dayTh,
    affectedDuties,
    hasMorningShift,
    hasNightWatch,
    needsSubstitute,
    suggestedSubstitute,
    coWorkersInShift: Array.from(coWorkersSet),
    summaryTh,
  };
}

