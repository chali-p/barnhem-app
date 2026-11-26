import { AppSettings, Language, Member, ModalAlertPayload } from '../types/barnhem';
import {
  canKidUseCommand,
  doesKidHavePhone,
  evaluateKidReturnPhoneSchedule,
  formatThaiCurfewClock,
  getAutoReturnPhoneRuleConfig,
  getEffectiveHomeworkPermissionWindow,
  minsToHHMM,
} from './expressKiosk';
import { isKidAwayOnDate } from './piggyBank';
import { getDateKey, getMinutesOfDay, isPublicHoliday } from './timeRules';

export type ShiftSlotKey = 'shift_morning' | 'shift_afternoon' | 'shift_night';

export type StepModalTarget =
  | 'shift_morning'
  | 'shift_afternoon'
  | 'shift_night'
  | 'penalty_status'
  | 'kindness_deed_modal';

export interface DailyShiftProgressItem {
  key: ShiftSlotKey;
  emoji: string;
  labelTh: string;
  labelEn: string;
  done: boolean;
  isCurrent: boolean;
  isOverdue: boolean;
  summaryTh: string;
  summaryEn: string;
}

export interface NextStepActionItem {
  id: string;
  shift: ShiftSlotKey;
  targetModal: StepModalTarget;
  urgent: boolean;
  approachingDeadline: boolean;
  deadlineMinutes: number | null;
  minutesDelta: number | null; // negative = minutes remaining until deadline; >= 0 = minutes past deadline
  titleTh: string;
  titleEn: string;
  instructionTh: string;
  instructionEn: string;
  ctaTh: string;
  ctaEn: string;
}

export interface PenaltyInstructionItem {
  id: string;
  severity: 'warning' | 'penalty';
  titleTh: string;
  titleEn: string;
  ruleInstructionTh: string;
  ruleInstructionEn: string;
  targetModal: StepModalTarget;
}

export interface KidStepReminderSnapshot {
  shifts: DailyShiftProgressItem[];
  nextStep: NextStepActionItem | null;
  upcomingSteps: NextStepActionItem[];
  penaltyInstructions: PenaltyInstructionItem[];
  shouldAutoPop: boolean;
  badgeTextTh: string;
  badgeTextEn: string;
  allDoneClean: boolean;
}

function formatHHMM(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} น.`;
}

export function evaluateKidStepReminders(
  kid: Member,
  now: Date,
  isSickToday: boolean,
  isPublicHolidayToday = false,
  settings?: Partial<AppSettings>
): KidStepReminderSnapshot {
  const mins = getMinutesOfDay(now);
  const day = now.getDay(); // 0 Sun, 5 Fri, 6 Sat
  const todayKey = getDateKey(now);
  const isWeekend = day === 0 || day === 6;
  const isHoliday = isPublicHoliday(now, isPublicHolidayToday);
  const isAwayToday = isKidAwayOnDate(kid, todayKey);
  const isSchoolDay = day >= 1 && day <= 5 && !isHoliday;
  const SCHOOL_MORNING_CEILING = 8 * 60; // 08:00 น. เพดานเวลาสายวันไปโรงเรียน
  const PHONE_RETURN_CEILING = 23 * 60; // 23:00 น. เพดานคืนโทรศัพท์หลัง 22:45

  const kidHasPhone = doesKidHavePhone(kid.id, settings);
  const canEveningPhone = kidHasPhone && canKidUseCommand('evening_uniform_phone', kid, settings);
  const canHwPerm = kidHasPhone && canKidUseCommand('night_homework_permission', kid, settings);
  const canReturnPhone = kidHasPhone && canKidUseCommand('night_return_phone', kid, settings);

  // --- 1. Determine completion status of the 3 core daily shifts ---
  const morningDone =
    kid.group === 1
      ? Boolean(kid.daily.breakfastChecked && kid.daily.vanOrMorningChecked)
      : Boolean(kid.daily.vanOrMorningChecked);

  const afternoonDone =
    kid.group === 1
      ? Boolean(kid.daily.returnedHomeChecked && kid.daily.extraStudyChecked && kid.daily.choresChecked)
      : Boolean(kid.daily.returnedHomeChecked);

  const nightDone =
    kid.group === 1
      ? Boolean(kid.daily.bossStageUnlocked)
      : !canReturnPhone
      ? kid.group === 2
        ? kid.daily.eveningChecklist.every(Boolean)
        : true
      : Boolean(kid.daily.phoneReturnedChecked);

  // --- 2. Compute ordered next step actions across the 3 shifts ---
  const pendingSteps: NextStepActionItem[] = [];

  if (!isAwayToday) {
  // === SHIFT 1: MORNING ===
  if (kid.group === 1) {
    if (!kid.daily.breakfastChecked && (!isSchoolDay || mins <= SCHOOL_MORNING_CEILING)) {
      const deadline = 6 * 60 + 40; // 06:40
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_breakfast',
        shift: 'shift_morning',
        targetModal: 'shift_morning',
        urgent: delta > 0,
        approachingDeadline: delta >= -30 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเช้า (ขั้นที่ 1): ทานข้าวเช้า & ใส่ชุดนักเรียน',
        titleEn: 'Morning (Step 1): Breakfast & Uniform',
        instructionTh:
          delta <= 0
            ? `ต้องเช็คอินทานข้าวเช้าก่อน 06:40 น. เพื่อรับ +5 ⭐ (เหลือเวลาอีก ${Math.abs(delta)} นาที)`
            : `เลยเวลา 06:40 น. มาแล้ว ${delta} นาที (เตือนสายวันไปโรงเรียนถึงเพดาน 08:00 น.) รีบเช็คอินทานข้าวเช้าและเตรียมขึ้นรถตู้เลยจ้า`,
        instructionEn:
          delta <= 0
            ? `Check in breakfast before 06:40 for +5 ⭐ (${Math.abs(delta)} min left).`
            : `Past 06:40 by ${delta} min (school-day morning cap 08:00). Check in breakfast now.`,
        ctaTh: '🍚 ไปเช็คอินข้าวเช้า',
        ctaEn: '🍚 Check In Breakfast',
      });
    }
    if (!kid.daily.vanOrMorningChecked && (!isSchoolDay || mins <= SCHOOL_MORNING_CEILING)) {
      const deadline = 7 * 60 + 1; // 07:01
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_van',
        shift: 'shift_morning',
        targetModal: 'shift_morning',
        urgent: delta > 0,
        approachingDeadline: delta >= -30 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเช้า (ขั้นที่ 2): ขึ้นรถตู้ไปโรงเรียน',
        titleEn: 'Morning (Step 2): Board School Van',
        instructionTh:
          delta <= 0
            ? `ขึ้นรถตู้ไปโรงเรียนไม่เกิน 07:01 น. รับ +10 ⭐ (เหลืออีก ${Math.abs(delta)} นาที)`
            : `เลย 07:01 น. มาแล้ว ${delta} นาที (เพดานเตือนสายวันไปโรงเรียนถึง 08:00 น.) รีบเช็คอินขึ้นรถตู้ด่วนจ้า`,
        instructionEn:
          delta <= 0
            ? `Board the school van by 07:01 for +10 ⭐ (${Math.abs(delta)} min left).`
            : `Past 07:01 by ${delta} min (school-day late cap 08:00). Please check in for the van.`,
        ctaTh: '🚐 ไปเช็คอินขึ้นรถตู้',
        ctaEn: '🚐 Check In Van',
      });
    }
  } else if (kid.group === 2) {
    if (!kid.daily.vanOrMorningChecked) {
      if (day === 6) {
        const deadline = 8 * 60 + 30;
        const hardLimit = 8 * 60 + 45;
        const delta = mins - deadline;
        pendingSteps.push({
          id: 'g2_sat_morning',
          shift: 'shift_morning',
          targetModal: 'shift_morning',
          urgent: mins > deadline,
          approachingDeadline: mins >= 7 * 60 + 55 && mins <= hardLimit,
          deadlineMinutes: hardLimit,
          minutesDelta: mins - hardLimit,
          titleTh: 'กะเช้าวันเสาร์: เช็คอินกะเช้า / ขอรับมือถือ & ไปโรงเรียน/กิจกรรม',
          titleEn: 'Saturday Morning: Check-in / Phone Pickup',
          instructionTh:
            mins <= deadline
              ? `วันเสาร์ (วันศุกร์ Free Day น้องขอนอนเพิ่ม): เช็คอินช่วง 08:00–08:30 น. รับ +10 ⭐ (อีก ${Math.max(0, deadline - mins)} นาที)`
              : mins <= hardLimit
              ? `⚠️ ช่วงเตือนสาย 08:31–08:45 น. (เหลือ ${hardLimit - mins} นาที ก่อนครบกำหนดยึดมือถือถึง 18:30 น.) รีบเช็คอินด่วน!`
              : `🚨 เลย 08:45 น. มาแล้ว ${mins - hardLimit} นาที — กรุณาเช็คอินเพื่อรับทราบคำสั่งยึดมือถือถึง 18:30 น.`,
          instructionEn:
            mins <= deadline
              ? `Saturday sleep-in window 08:00–08:30 for +10 ⭐ (${Math.max(0, deadline - mins)} min left).`
              : mins <= hardLimit
              ? `Warning window 08:31–08:45! Check in within ${hardLimit - mins} min to avoid holding phone until 18:30.`
              : `Past 08:45 by ${mins - hardLimit} min — check in now (phone held until 18:30).`,
          ctaTh: '📱 ไปเช็คอินกะเช้า',
          ctaEn: '📱 Morning Check-In',
        });
      } else if (day === 0) {
        const deadline = 8 * 60 + 15;
        const hardLimit = 8 * 60 + 20;
        pendingSteps.push({
          id: 'g2_sun_morning',
          shift: 'shift_morning',
          targetModal: 'shift_morning',
          urgent: mins > deadline,
          approachingDeadline: mins >= 7 * 60 + 45 && mins <= hardLimit,
          deadlineMinutes: hardLimit,
          minutesDelta: mins - hardLimit,
          titleTh: 'กะเช้าวันอาทิตย์: เช็คอินทำเวร + อาบน้ำ + เช็คเวรครัว',
          titleEn: 'Sunday Morning: Chores + Shower + Kitchen Check',
          instructionTh:
            mins <= deadline
              ? `เช็คอินช่วง 08:00–08:15 น. รับ +15 ⭐ (เหลืออีก ${Math.max(0, deadline - mins)} นาที)`
              : mins <= hardLimit
              ? `⚠️ ช่วงเตือนสาย 08:16–08:20 น. (เหลือ ${hardLimit - mins} นาที ก่อนหัก -5 ⭐)`
              : `🚨 เลย 08:20 น. แล้ว (ลด -5 ⭐ แทนยึดมือถือ) รีบกดเช็คอิน หรือแจ้งพี่เลี้ยงหากเกิดเหตุสุดวิสัย/ปลุกช้า`,
          instructionEn:
            mins <= deadline
              ? `Check in 08:00–08:15 for +15 ⭐ (${Math.max(0, deadline - mins)} min left).`
              : mins <= hardLimit
              ? `Grace period 08:16–08:20! ${hardLimit - mins} min left before -5 ⭐ deduction.`
              : `Past 08:20 (-5 ⭐ deduction; notify staff if there was a wakeup accident).`,
          ctaTh: '☀️ ไปเช็คอินเช้าวันอาทิตย์',
          ctaEn: '☀️ Sunday Check-In',
        });
      } else if (isSchoolDay && mins <= SCHOOL_MORNING_CEILING) {
        const deadline = 7 * 60 + 21;
        const delta = mins - deadline;
        pendingSteps.push({
          id: 'g2_weekday_morning',
          shift: 'shift_morning',
          targetModal: 'shift_morning',
          urgent: delta > 0,
          approachingDeadline: delta >= -35 && delta <= 0,
          deadlineMinutes: deadline,
          minutesDelta: delta,
          titleTh: 'กะเช้า (วันไปโรงเรียน): อาบน้ำแต่งตัว & เช็คชื่อไปโรงเรียน',
          titleEn: 'School Morning: Ready, Phone Pickup & School Check-In',
          instructionTh:
            delta <= 0
              ? `กด "อาบน้ำ แต่งตัว & ขอรับมือถือ" แล้วกด "เช็คชื่อไปโรงเรียน" ไม่เกิน 07:21 น. รับ +10 ⭐ (เหลืออีก ${Math.abs(delta)} นาที)`
              : `🚨 สายไปโรงเรียน ${delta} นาทีแล้ว (ปรับนาทีละ 5 บ. สูงสุด 50 บ. · เพดานเวลาสายวันไปโรงเรียนถึง 08:00 น.) รีบเช็คชื่อทันที!`,
          instructionEn:
            delta <= 0
              ? `Tap "Showered, Dressed & Phone Pickup" then "School Check-In" by 07:21 for +10 ⭐ (${Math.abs(delta)} min left).`
              : `School day late by ${delta} min (5 THB/min fine, max 50 THB · late ceiling 08:00). Check in now!`,
          ctaTh: '🚌 ไปเช็คชื่อไปโรงเรียน',
          ctaEn: '🚌 School Check-In',
        });
      } else if (!isSchoolDay && mins <= 9 * 60) {
        pendingSteps.push({
          id: 'g2_holiday_morning',
          shift: 'shift_morning',
          targetModal: 'shift_morning',
          urgent: false,
          approachingDeadline: false,
          deadlineMinutes: 8 * 60 + 30,
          minutesDelta: mins - (8 * 60 + 30),
          titleTh: 'กะเช้าวันหยุด: เช็คอินตื่นนอน & ทำภารกิจเช้า (+10 ⭐)',
          titleEn: 'Holiday Morning: Morning Check-In (+10 ⭐)',
          instructionTh: 'วันนี้วันหยุดราชการ ไม่มีหักสายไปโรงเรียน กดเช็คอินกะเช้าเพื่อรับ +10 ⭐ ค่ะ',
          instructionEn: 'Public holiday today — no school late penalty! Tap Morning Check-In for +10 ⭐.',
          ctaTh: '📱 ไปเช็คอินกะเช้า',
          ctaEn: '📱 Morning Check-In',
        });
      }
    }
  } else {
    // Group 3
    if (!kid.daily.vanOrMorningChecked && (!isSchoolDay || mins <= SCHOOL_MORNING_CEILING)) {
      const deadline = 8 * 60;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g3_morning',
        shift: 'shift_morning',
        targetModal: 'shift_morning',
        urgent: false,
        approachingDeadline: mins >= 6 * 60 + 30 && mins <= deadline,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเช้า: เช็คอินไปโรงเรียน / ฝึกงาน',
        titleEn: 'Morning: College / Internship Check-In',
        instructionTh: 'อย่าลืมกดเช็คอินกะเช้าไปเรียนหรือฝึกงาน เพื่อรับ +10 ⭐ (ไม่มีหักสายตอนเช้า) นะคะ',
        instructionEn: 'Tap Morning Check-In when leaving for college or internship (+10 ⭐).',
        ctaTh: '🎓 ไปเช็คอินกะเช้า',
        ctaEn: '🎓 Morning Check-In',
      });
    }
  }

  // === SHIFT 2: AFTERNOON / RETURN HOME ===
  if (kid.group === 1) {
    if (!kid.daily.returnedHomeChecked) {
      const deadline = 16 * 60 + 30;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_home',
        shift: 'shift_afternoon',
        targetModal: 'shift_afternoon',
        urgent: mins > 16 * 60 + 45,
        approachingDeadline: mins >= 15 * 60 + 45 && mins <= deadline,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเย็น (ขั้นที่ 1): เช็คอินกลับบ้าน & ถ่ายรูปเช็คอิน',
        titleEn: 'Afternoon (Step 1): Return Home & Photo Check-In',
        instructionTh:
          delta <= 0
            ? `กลับถึงบ้านกดเช็คอินเวลา 16:30 น. เพื่อเริ่มจับเวลา Speedy Ninja 20 นาที (อีก ${Math.abs(delta)} นาที)`
            : 'กลับบ้านแล้วรีบกดเช็คอิน ถ่ายรูปเช็คอิน และเปลี่ยนชุดถอดซักทันที!',
        instructionEn:
          delta <= 0
            ? `Check in home around 16:30 to start 20-min Speedy Ninja (${Math.abs(delta)} min left).`
            : 'Check in home, take return photo, and start 20-min Speedy Ninja!',
        ctaTh: '🏡 ไปเช็คอินกลับบ้าน',
        ctaEn: '🏡 Return Home Check-In',
      });
    } else if (!kid.daily.extraStudyChecked) {
      const deadline = 16 * 60 + 50;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_study',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: delta > 0,
        approachingDeadline: delta >= -25 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเย็น/ค่ำ: เข้าเรียนเสริม (ไม่เกิน 16:50 น.)',
        titleEn: 'Afternoon/Evening: Extra Study (by 16:50)',
        instructionTh:
          delta <= 0
            ? `เข้าเรียนเสริมก่อน 16:50 น. รับ +10 ⭐ (เหลือเวลาอีก ${Math.abs(delta)} นาที)`
            : `เลย 16:50 น. มาแล้ว ${delta} นาที รีบเข้าเรียนเสริมและเช็คอินเลย`,
        instructionEn:
          delta <= 0
            ? `Join extra study before 16:50 for +10 ⭐ (${Math.abs(delta)} min left).`
            : `Past 16:50 by ${delta} min. Check in for extra study now.`,
        ctaTh: '📖 ไปเช็คอินเรียนเสริม',
        ctaEn: '📖 Check In Study',
      });
    } else if (!kid.daily.choresChecked) {
      const deadline = 18 * 60 + 15;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_chores',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: delta > 0,
        approachingDeadline: delta >= -30 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเย็น/ค่ำ: งานบ้าน & ตากชุดนักเรียน (ก่อน 18:15 น.)',
        titleEn: 'Evening: Chores & Hang Uniform (< 18:15)',
        instructionTh:
          delta <= 0
            ? `ทำงานบ้าน & ตากชุดนักเรียนก่อน 18:15 น. รับ +10 ⭐ (เหลืออีก ${Math.abs(delta)} นาที)`
            : mins <= 18 * 60 + 50
            ? `เลย 18:15 น. แล้ว รีบทำก่อน 18:50 น. ยังได้ +3 ⭐ (เหลือ ${18 * 60 + 50 - mins} นาที)`
            : 'เลย 18:50 น. แล้ว รีบทำงานบ้าน & ตากชุดนักเรียนให้เรียบร้อยจ้า',
        instructionEn:
          delta <= 0
            ? `Finish chores & hang uniform before 18:15 for +10 ⭐ (${Math.abs(delta)} min left).`
            : 'Finish chores & hang your uniform quickly!',
        ctaTh: '🧺 ไปเช็คอินงานบ้าน',
        ctaEn: '🧺 Check In Chores',
      });
    }
  } else if (kid.group === 2) {
    if (!kid.daily.returnedHomeChecked) {
      const deadline = isWeekend ? 14 * 60 : 17 * 60;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g2_home',
        shift: 'shift_afternoon',
        targetModal: 'shift_afternoon',
        urgent: delta > 0,
        approachingDeadline: isWeekend ? mins >= 13 * 60 && delta <= 0 : mins >= 15 * 60 + 45 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: isWeekend
          ? 'กะเย็น (เสาร์-อาทิตย์): ถ่ายรูปเช็คอินกลับบ้าน & เก็บมือถือไม่เกิน 14:00 น.'
          : 'กะเย็น: ถ่ายรูปเช็คอินกลับบ้าน (+5 ⭐)',
        titleEn: isWeekend
          ? 'Afternoon (Weekend): Return-Home Photo & Store Phone by 14:00'
          : 'Afternoon: Return-Home Photo Check-In (+5 ⭐)',
        instructionTh: isWeekend
          ? delta <= 0
            ? `เสาร์-อาทิตย์ถ่ายรูปเช็คอินกลับบ้านและเก็บมือถือไม่เกิน 14:00 น. ห้ามนอนกลางวัน (อีก ${Math.abs(delta)} นาที)`
            : `🚨 เลย 14:00 น. มาแล้ว ${delta} นาที รีบกดถ่ายรูปเช็คอินกลับบ้านและเก็บมือถือด่วน!`
          : 'เมื่อกลับถึงบ้าน กด "ถ่ายรูปเช็คอินกลับบ้าน" ปุ่มเดียวเพื่อเปลี่ยนชุดอยู่บ้านและรับ +5 ⭐ (พร้อมเช็คคิวซักผ้า)',
        instructionEn: isWeekend
          ? `Take return-home photo & store phone by 14:00 on weekends, no daytime naps (${delta <= 0 ? `${Math.abs(delta)} min left` : `${delta} min overdue`}).`
          : 'Tap Return-Home Photo Check-In to switch into lounge wear and earn +5 ⭐.',
        ctaTh: '📸 ไปถ่ายรูปเช็คอินกลับบ้าน',
        ctaEn: '📸 Return-Home Photo Check-In',
      });
    }
  } else {
    // Group 3
    if (!kid.daily.returnedHomeChecked) {
      const deadline = 18 * 60;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g3_home',
        shift: 'shift_afternoon',
        targetModal: 'shift_afternoon',
        urgent: false,
        approachingDeadline: mins >= 16 * 60 && mins <= deadline,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะเย็น: กลับจากเรียน/ฝึกงาน & เก็บมือถือเข้าตู้ (+20 ⭐)',
        titleEn: 'Afternoon: Return & Store Phone (+20 ⭐)',
        instructionTh: 'ถึงบ้านแล้วกดเช็คอินกลับบ้าน & เก็บมือถือเข้าตู้เพื่อรับ +20 ⭐ ค่ะ',
        instructionEn: 'Check in home and store your phone to receive +20 ⭐.',
        ctaTh: '🏡 ไปเช็คอินกลับบ้าน',
        ctaEn: '🏡 Return Home Check-In',
      });
    }
  }

  // === SHIFT 3: NIGHT / HOMEWORK & BEDTIME ===
  if (kid.group === 1) {
    if (!kid.daily.bossStageUnlocked) {
      const deadline = 20 * 60; // 20:00 Boss stage
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g1_boss',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: mins > 20 * 60 + 15,
        approachingDeadline: mins >= 19 * 60 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะค่ำ: ด่านบอส 20:00 น. (ขอ PIN พี่เลี้ยงปลดล็อกการ์ตูน +10 ⭐)',
        titleEn: 'Night: 20:00 Boss Stage (Staff PIN +10 ⭐)',
        instructionTh:
          delta <= 0
            ? `เตรียมตัวเข้าด่านบอสภาษาเวลา 20:00 น. (เหลือเวลาอีก ${Math.abs(delta)} นาที) จากนั้นดื่มน้ำ 20:40 น. เข้านอน 21:00 น.`
            : 'ถึงเวลาด่านบอส 20:00 น. แล้ว ให้พี่เลี้ยงใส่ PIN เพื่อปลดล็อกสิทธิ์ดูการ์ตูนและรับ +10 ⭐ ค่ะ',
        instructionEn:
          delta <= 0
            ? `20:00 Boss Stage starts in ${Math.abs(delta)} min! Drink water 20:40, bedtime 21:00.`
            : 'It is Boss Stage time! Ask staff to enter PIN to unlock cartoons (+10 ⭐).',
        ctaTh: '✍️ ไปหน้าด่านบอส 20:00',
        ctaEn: '✍️ Open Boss Stage',
      });
    }
  } else if (kid.group === 2) {
    if (canEveningPhone && !kid.daily.eveningPhoneUnlocked) {
      const deadline = 18 * 60 + 30;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g2_evening_checklist',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: false,
        approachingDeadline: mins >= 17 * 60 + 45 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะค่ำ (18:30 น.): เช็คลิสต์ 4 ข้อ (ซัก-รีด-ตรวจชุด-อาบน้ำ) เพื่อรับมือถือ',
        titleEn: 'Evening (18:30): 4-Item Checklist & Phone Pickup',
        instructionTh:
          delta <= 0
            ? `รีบทำเช็คลิสต์ 4 ข้อให้ครบก่อนเวลา 18:30 น. เพื่อรับมือถือ (+10 ⭐) (อีก ${Math.abs(delta)} นาที)`
            : 'ทำเช็คลิสต์ 4 ข้อให้ครบแล้วขอ PIN พี่เลี้ยงเพื่อรับมือถือรอบเย็น (+10 ⭐) ค่ะ',
        instructionEn:
          delta <= 0
            ? `Complete all 4 checklist items before 18:30 to pick up evening phone (${Math.abs(delta)} min left).`
            : 'Finish the 4-item checklist and ask staff for PIN to unlock evening phone (+10 ⭐).',
        ctaTh: '✅ ไปทำเช็คลิสต์ 4 ข้อ',
        ctaEn: '✅ Open Checklist',
      });
    } else if (!canEveningPhone && !kid.daily.eveningChecklist.every(Boolean)) {
      const deadline = 18 * 60 + 30;
      const delta = mins - deadline;
      pendingSteps.push({
        id: 'g2_evening_checklist_nophone',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: false,
        approachingDeadline: mins >= 17 * 60 + 45 && delta <= 0,
        deadlineMinutes: deadline,
        minutesDelta: delta,
        titleTh: 'กะค่ำ (18:30 น.): เช็คลิสต์ 4 ข้อ (ซัก-รีด-ตรวจชุด-อาบน้ำ)',
        titleEn: 'Evening (18:30): 4-Item Hygiene & Uniform Checklist',
        instructionTh: 'อย่าลืมติ๊กเช็คลิสต์ 4 ข้อ (ซักชุด รีดชุด ตรวจชุด อาบน้ำ) ให้ครบนะคะ',
        instructionEn: 'Remember to finish all 4 checklist items (wash, iron, inspect uniform, shower).',
        ctaTh: '✅ ไปทำเช็คลิสต์ 4 ข้อ',
        ctaEn: '✅ Open Checklist',
      });
    } else if (canReturnPhone && !kid.daily.phoneReturnedChecked) {
      // Check dynamic homework permission window & phone return curfew
      const hwWin = getEffectiveHomeworkPermissionWindow(settings);
      const curfew = getAutoReturnPhoneRuleConfig(settings).homeworkExtendedDeadlineMins;
      const curfewTh = formatThaiCurfewClock(curfew);
      const curfewEn = minsToHHMM(curfew);
      const hasHw = Boolean(kid.daily.homeworkRegisteredSubject);
      const canAskHwWindow =
        canHwPerm &&
        !kid.daily.homeworkRegisteredSubject &&
        (hwWin.startMins <= hwWin.endMins
          ? mins >= hwWin.startMins && mins <= hwWin.endMins
          : mins >= hwWin.startMins || mins <= hwWin.endMins);
      if (canAskHwWindow) {
        const hwClose = hwWin.endMins;
        pendingSteps.push({
          id: 'g2_hw_register',
          shift: 'shift_night',
          targetModal: 'shift_night',
          urgent: true,
          approachingDeadline: true,
          deadlineMinutes: hwClose,
          minutesDelta: mins - hwClose,
          titleTh: `กะค่ำ (${hwWin.labelTh}): ปุ่มขออนุญาตทำการบ้านเปิดแล้ว`,
          titleEn: `Night (${hwWin.labelEn}): Homework Permission Open`,
          instructionTh: `กดขออนุญาต (ทำการบ้าน / หาข้อมูล / เรียนพิเศษ) ในช่องที่ 3 ก่อน ${minsToHHMM(hwClose)} น. (เหลือ ${Math.max(0, hwClose - mins)} นาที) เพื่อใช้งานต่อได้ถึง ${curfewTh}`,
          instructionEn: `Request homework permission in Channel 3 before ${minsToHHMM(hwClose)} (${Math.max(0, hwClose - mins)} min left) to extend until ${curfewEn}.`,
          ctaTh: '📝 ไปช่อง 3 ขออนุญาตทำการบ้าน',
          ctaEn: '📝 Open Channel 3',
        });
      }

      const returnEval = evaluateKidReturnPhoneSchedule(kid, now, settings, 'th');
      const returnDeadline = returnEval.deadlineMins;
      const returnDeadlineTh = returnEval.deadlineTh;
      const returnDeadlineEn = returnEval.deadlineEn;
      const delta = mins - returnDeadline;
      pendingSteps.push({
        id: 'g2_phone_return',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: delta > 0,
        approachingDeadline: delta >= -30 && delta <= 0,
        deadlineMinutes: returnDeadline,
        minutesDelta: delta,
        titleTh: hasHw
          ? `กะค่ำ: นำมือถือมาเก็บ (ขอทำการบ้าน · ถึง ${returnDeadlineTh})`
          : `กะค่ำ: ส่งคืนมือถือเข้าตู้พี่เลี้ยง (ไม่เกิน ${returnDeadlineTh})`,
        titleEn: hasHw
          ? `Night: Store Phone (HW Extension — By ${returnDeadlineEn})`
          : `Night: Return Phone to Locker (By ${returnDeadlineEn})`,
        instructionTh:
          delta <= 0
            ? `ต้องนำมือถือมาเก็บภายในเวลา ${returnDeadlineTh} (เหลือเวลาอีก ${Math.abs(delta)} นาที)`
            : `🚨 เลยเวลา ${returnDeadlineTh} มาแล้ว ${delta} นาที! รีบส่งคืนทันทีเพื่อลดบทลงโทษ`,
        instructionEn:
          delta <= 0
            ? `Store your phone by ${returnDeadlineEn} (${Math.abs(delta)} min left).`
            : `Past ${returnDeadlineEn} by ${delta} min! Return immediately!`,
        ctaTh: '📱 ไปส่งคืนมือถือ',
        ctaEn: '📱 Return Phone',
      });
    }
  } else {
    // Group 3
    if (canReturnPhone && !kid.daily.phoneReturnedChecked && mins <= PHONE_RETURN_CEILING) {
      const returnEval = evaluateKidReturnPhoneSchedule(kid, now, settings, 'th');
      const curfew = returnEval.deadlineMins;
      const delta = mins - curfew;
      const minsLeftToCeiling = Math.max(0, PHONE_RETURN_CEILING - mins);
      pendingSteps.push({
        id: 'g3_phone_return',
        shift: 'shift_night',
        targetModal: 'shift_night',
        urgent: delta > 0,
        approachingDeadline: delta >= -30 && delta <= 0,
        deadlineMinutes: curfew,
        minutesDelta: delta,
        titleTh: 'กะค่ำ: ส่งคืนมือถือเข้าตู้พี่เลี้ยง (Curfew 22:45 · เพดาน 23:00 น.)',
        titleEn: 'Night: Return Phone to Locker (Curfew 22:45 · Ceiling 23:00)',
        instructionTh:
          delta <= 0
            ? `ส่งคืนมือถือเข้าตู้พี่เลี้ยงก่อนเวลา 22:45 น. (เหลือเวลาอีก ${Math.abs(delta)} นาที)`
            : `🚨 เลยเวลา Curfew 22:45 น. มาแล้ว ${delta} นาที (ตั้งเพดานคืนโทรศัพท์ถึง 23:00 น. — เหลือ ${minsLeftToCeiling} นาที · งดใช้มือถือช่วงเย็นวันพรุ่งนี้)`,
        instructionEn:
          delta <= 0
            ? `Return phone by 22:45 Curfew (${Math.abs(delta)} min left).`
            : `Past 22:45 Curfew by ${delta} min (ceiling 23:00 — ${minsLeftToCeiling} min left)! Return phone immediately.`,
        ctaTh: '📱 ไปส่งคืนมือถือ',
        ctaEn: '📱 Return Phone',
      });
    }
  }
  } // end if (!isAwayToday)

  // --- 3. Late / Penalty / Rule Violation Instructions ---
  const penaltyInstructions: PenaltyInstructionItem[] = [];

  if (kid.penalty.lateFineThb > 0) {
    penaltyInstructions.push({
      id: 'pen_fine',
      severity: 'penalty',
      titleTh: `💸 มีค่าปรับมาสายค้างอยู่ ${kid.penalty.lateFineThb} บาท`,
      titleEn: `💸 Outstanding Late Fine: ${kid.penalty.lateFineThb} THB`,
      ruleInstructionTh:
        'คำสั่งสำหรับคนมาสาย: สามารถเข้าหน้า "ขอบคุณ & ความดี" เพื่อรับภารกิจทำความดีไถ่ลดค่าปรับกับพี่เลี้ยงได้ค่ะ',
      ruleInstructionEn:
        'For late record: ask staff for a Good Deed mission to reduce or clear your fine.',
      targetModal: 'kindness_deed_modal',
    });
  }

  if (kid.penalty.phoneConfiscatedUntil1830Date === todayKey && mins < 18 * 60 + 30) {
    penaltyInstructions.push({
      id: 'pen_confiscated_1830',
      severity: 'penalty',
      titleTh: '📵 คำสั่งผิดกฎเช้าวันเสาร์: ยึดมือถือถึง 18:30 น. วันนี้',
      titleEn: '📵 Saturday Rule Penalty: Phone Held Until 18:30 Today',
      ruleInstructionTh:
        'ทำเวรบ้าน อาบน้ำ และเช็คเวรครัวให้เรียบร้อย งดรับมือถือก่อน 18:30 น. (รอตรวจเช็คลิสต์ครบตอนเย็น)',
      ruleInstructionEn:
        'Complete chores, shower, and kitchen check; phone cannot be unlocked before 18:30.',
      targetModal: 'penalty_status',
    });
  }

  if (kid.penalty.noEveningPhoneTomorrowDate === todayKey) {
    penaltyInstructions.push({
      id: 'pen_no_eve_today',
      severity: 'penalty',
      titleTh: '📵 คำสั่งผิดกฎคืนมือถือเกิน 22:45 น.: งดใช้มือถือรอบเย็นวันนี้ 1 วัน',
      titleEn: '📵 Curfew Penalty: No Evening Phone Today',
      ruleInstructionTh:
        'เนื่องจากคืนมือถือเกิน 22:45 น. เมื่อคืน วันนี้ยังต้องทำเช็คลิสต์ 4 ข้อและพักผ่อนตามเวลาปกติ แต่จะงดรับมือถือรอบ 18:30 น. 1 วันค่ะ',
      ruleInstructionEn:
        'Due to returning phone past 22:45 last night, evening 18:30 phone usage is suspended for today.',
      targetModal: 'penalty_status',
    });
  }

  if (kid.penalty.fridayFreeDayDeductedCount > 0) {
    penaltyInstructions.push({
      id: 'pen_fri_deduct',
      severity: 'warning',
      titleTh: `🗓️ สะสมงดใช้โทรศัพท์วัน Free Day ${kid.penalty.fridayFreeDayDeductedCount} วัน`,
      titleEn: `🗓️ Free Day Phone Deductions: ${kid.penalty.fridayFreeDayDeductedCount}`,
      ruleInstructionTh:
        'อย่าลืมนำมือถือมาเก็บให้ตรงเวลาไม่เกิน 21:00 น. (3 ทุ่ม) เพื่อไม่ให้ถูกงดใช้โทรศัพท์วัน Free Day เพิ่มนะ',
      ruleInstructionEn:
        'Store phone by 21:00 to avoid additional Free Day phone deductions.',
      targetModal: 'penalty_status',
    });
  }

  // Sunday late -5 star penalty today (unwaived)
  const hadSundayLateToday = kid.starHistory.some(
    (tx) => tx.timestamp.slice(0, 10) === todayKey && tx.amount < 0 && tx.reason.includes('เช้าวันอาทิตย์เกิน')
  );
  const hadSundayWaiverToday = kid.starHistory.some(
    (tx) => tx.timestamp.slice(0, 10) === todayKey && tx.amount > 0 && tx.reason.includes('ยกเว้นเหตุสุดวิสัยเช้าวันอาทิตย์')
  );
  if (hadSundayLateToday && !hadSundayWaiverToday) {
    penaltyInstructions.push({
      id: 'pen_sun_stars',
      severity: 'warning',
      titleTh: '⏰ วันอาทิตย์เช็คอินเกิน 08:20 น. (ลด -5 ⭐ แทนยึดมือถือ)',
      titleEn: '⏰ Sunday Check-In Past 08:20 (-5 ⭐)',
      ruleInstructionTh:
        'หากเกิดเหตุสุดวิสัยหรือพี่เลี้ยงไปปลุกช้า แจ้งพี่เลี้ยงให้กดปุ่ม "คืนดาวเหตุสุดวิสัย (+5 ⭐)" ได้เลยค่ะ',
      ruleInstructionEn:
        'If there was a wake-up delay or unexpected accident, ask staff to waive and refund +5 ⭐.',
      targetModal: 'penalty_status',
    });
  }

  // Pick the most urgent / current next step
  const nextStep =
    pendingSteps.find((s) => s.urgent && !isSickToday) ??
    pendingSteps.find((s) => s.approachingDeadline) ??
    pendingSteps[0] ??
    null;

  const shifts: DailyShiftProgressItem[] = [
    {
      key: 'shift_morning',
      emoji: '🌅',
      labelTh: '1. กะเช้า (ไปโรงเรียน)',
      labelEn: '1. Morning Shift',
      done: morningDone,
      isCurrent: nextStep?.shift === 'shift_morning',
      isOverdue: !morningDone && !isSickToday && pendingSteps.some((s) => s.shift === 'shift_morning' && s.urgent),
      summaryTh: morningDone ? 'เช็คอินเรียบร้อย' : 'รอเช็คอินกะเช้า',
      summaryEn: morningDone ? 'Completed' : 'Pending',
    },
    {
      key: 'shift_afternoon',
      emoji: '🏡',
      labelTh: '2. กะเย็น (กลับบ้าน)',
      labelEn: '2. Afternoon Shift',
      done: afternoonDone,
      isCurrent: nextStep?.shift === 'shift_afternoon',
      isOverdue: !afternoonDone && !isSickToday && pendingSteps.some((s) => s.shift === 'shift_afternoon' && s.urgent),
      summaryTh: afternoonDone ? 'เช็คอินเรียบร้อย' : 'รอเช็คอินกลับบ้าน',
      summaryEn: afternoonDone ? 'Completed' : 'Pending',
    },
    {
      key: 'shift_night',
      emoji: '🌙',
      labelTh: '3. กะค่ำ (การบ้าน & เข้านอน)',
      labelEn: '3. Night / Homework',
      done: nightDone,
      isCurrent: nextStep?.shift === 'shift_night',
      isOverdue: !nightDone && !isSickToday && pendingSteps.some((s) => s.shift === 'shift_night' && s.urgent),
      summaryTh: nightDone ? 'ครบเรียบร้อย' : 'รอทำภารกิจค่ำ',
      summaryEn: nightDone ? 'Completed' : 'Pending',
    },
  ];

  const hasOverdueOrPenalty =
    (!isSickToday && !isAwayToday && pendingSteps.some((s) => s.urgent)) || penaltyInstructions.length > 0;
  const allDoneClean = isAwayToday || (!nextStep && penaltyInstructions.length === 0);

  // Auto-pop whenever there is an upcoming/active step before deadline OR any late/penalty rule instruction (suppressed while kid is away/on leave)!
  const shouldAutoPop = !isAwayToday && Boolean(nextStep || penaltyInstructions.length > 0);

  const badgeTextTh = isAwayToday
    ? `🏡 ลาพักถึง ${kid.allowance?.awayUntilDateKey}`
    : hasOverdueOrPenalty
    ? '🚨 มีสเตปสาย / คำสั่งวินัย'
    : nextStep?.approachingDeadline
    ? '⏰ ใกล้ถึงเวลากำหนด'
    : nextStep
    ? '📋 สเตปถัดไปวันนี้'
    : '✅ ครบ 3 กะแล้ว';

  const badgeTextEn = isAwayToday
    ? `🏡 On Leave Until ${kid.allowance?.awayUntilDateKey}`
    : hasOverdueOrPenalty
    ? '🚨 Overdue / Penalty'
    : nextStep?.approachingDeadline
    ? '⏰ Approaching Deadline'
    : nextStep
    ? '📋 Next Step Today'
    : '✅ All 3 Shifts Done';

  return {
    shifts,
    nextStep,
    upcomingSteps: pendingSteps,
    penaltyInstructions,
    shouldAutoPop,
    badgeTextTh,
    badgeTextEn,
    allDoneClean,
  };
}

export function buildStepAlertMessage(
  item: NextStepActionItem,
  lang: Language
): Pick<ModalAlertPayload, 'title' | 'message'> {
  return {
    title: lang === 'th' ? item.titleTh : item.titleEn,
    message: lang === 'th' ? item.instructionTh : item.instructionEn,
  };
}
