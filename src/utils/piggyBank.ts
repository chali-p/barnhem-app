import {
  AppSettings,
  GoldenPoolLog,
  KidAllowanceState,
  Member,
} from '../types/barnhem';
import { getDateKey, isPublicHoliday } from './timeRules';

export function isKidAwayOnDate(member: Member, dateKey: string): boolean {
  const until = member.allowance?.awayUntilDateKey;
  if (!until || typeof until !== 'string') return false;
  return dateKey <= until;
}

export interface EconomyConfig {
  dailyAllowanceThb: number;
  schoolDaysPerWeek: number;
  weeklyBaseThb: number;
  early15MinBonusStars: number;
  starToCoinStars: number;
  starToCoinThb: number;
}

export const WEEKDAY_NAMES_TH: Record<number, string> = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัส',
  5: 'ศุกร์',
  6: 'เสาร์',
  7: 'อาทิตย์',
};

export const WEEKDAY_NAMES_EN: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export function getEconomyConfig(settings?: Partial<AppSettings>): EconomyConfig {
  const dailyAllowanceThb = Math.min(
    500,
    Math.max(10, Math.round(Number(settings?.dailyAllowanceThb ?? 70)))
  );
  const schoolDaysPerWeek = Math.min(
    7,
    Math.max(1, Math.round(Number(settings?.schoolDaysPerWeek ?? 5)))
  );
  const early15MinBonusStars = Math.min(
    20,
    Math.max(0, Math.round(Number(settings?.early15MinBonusStars ?? 1)))
  );
  const starToCoinStars = Math.min(
    500,
    Math.max(1, Math.round(Number(settings?.starToCoinStars ?? 30)))
  );
  const starToCoinThb = Math.min(
    200,
    Math.max(1, Math.round(Number(settings?.starToCoinThb ?? 5)))
  );
  return {
    dailyAllowanceThb,
    schoolDaysPerWeek,
    weeklyBaseThb: dailyAllowanceThb * schoolDaysPerWeek,
    early15MinBonusStars,
    starToCoinStars,
    starToCoinThb,
  };
}

export function getKidEconomyConfig(
  member: Member,
  settings?: Partial<AppSettings>
): EconomyConfig {
  const base = getEconomyConfig(settings);
  const customDaily = member.allowance?.customDailyAllowanceThb;
  if (typeof customDaily === 'number' && Number.isFinite(customDaily) && customDaily >= 10) {
    const dailyAllowanceThb = Math.min(500, Math.max(10, Math.round(customDaily)));
    return {
      ...base,
      dailyAllowanceThb,
      weeklyBaseThb: dailyAllowanceThb * base.schoolDaysPerWeek,
    };
  }
  return base;
}

export function getMondayWeekKey(date: Date): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = local.getDay(); // 0=Sun .. 6=Sat
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  local.setDate(local.getDate() + diffToMonday);
  return getDateKey(local);
}

export function createInitialAllowanceState(
  now: Date,
  settings?: Partial<AppSettings>
): KidAllowanceState {
  const eco = getEconomyConfig(settings);
  const weekKey = getMondayWeekKey(now);
  return {
    coins: eco.weeklyBaseThb,
    weekKey,
    deductedWeekdays: [],
    weeklyPenaltyThb: 0,
    coinHistory: [
      {
        id: `coin_init_${weekKey}`,
        timestamp: now.toISOString(),
        reason: `เติมเงินค่าไปโรงเรียนประจำสัปดาห์ (${eco.schoolDaysPerWeek} วัน × ${eco.dailyAllowanceThb} ฿)`,
        amount: eco.weeklyBaseThb,
        kind: 'weekly_topup',
      },
    ],
  };
}

export function ensureCurrentWeekAllowance(
  member: Member,
  now: Date,
  settings?: Partial<AppSettings>
): { allowance: KidAllowanceState; rolledOver: boolean } {
  const eco = getKidEconomyConfig(member, settings);
  const currentWeekKey = getMondayWeekKey(now);

  if (!member.allowance) {
    return {
      allowance: createInitialAllowanceState(now, settings),
      rolledOver: false,
    };
  }

  if (member.allowance.weekKey === currentWeekKey) {
    return {
      allowance: {
        ...member.allowance,
        deductedWeekdays: Array.isArray(member.allowance.deductedWeekdays)
          ? member.allowance.deductedWeekdays
          : [],
        coinHistory: Array.isArray(member.allowance.coinHistory)
          ? member.allowance.coinHistory
          : [],
        weeklyPenaltyThb: Number(member.allowance.weeklyPenaltyThb ?? 0),
        coins: Number(member.allowance.coins ?? eco.weeklyBaseThb),
      },
      rolledOver: false,
    };
  }

  // New Monday rollover: Previous week penalties reduce this Monday's top-up
  const prevPenalty = Math.max(0, Number(member.allowance.weeklyPenaltyThb ?? 0));
  const netMondayCoins = Math.max(0, eco.weeklyBaseThb - prevPenalty);
  const nextHistory = [
    {
      id: `coin_mon_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: now.toISOString(),
      reason:
        prevPenalty > 0
          ? `เติมเงินวันจันทร์ (${eco.weeklyBaseThb} - หักผิดกฎสัปดาห์ก่อน ${prevPenalty} = ${netMondayCoins} ฿)`
          : `เติมเงินวันจันทร์เต็มจำนวน (${eco.schoolDaysPerWeek} วัน × ${eco.dailyAllowanceThb} ฿)`,
      amount: netMondayCoins,
      kind: 'weekly_topup' as const,
    },
    ...(member.allowance.coinHistory ?? []),
  ].slice(0, 40);

  return {
    allowance: {
      coins: netMondayCoins,
      weekKey: currentWeekKey,
      deductedWeekdays: [],
      weeklyPenaltyThb: 0,
      coinHistory: nextHistory,
      ...(typeof member.allowance?.customDailyAllowanceThb === 'number'
        ? { customDailyAllowanceThb: member.allowance.customDailyAllowanceThb }
        : {}),
      ...(member.allowance?.awayUntilDateKey
        ? {
            awayUntilDateKey: member.allowance.awayUntilDateKey,
            awayReason: member.allowance.awayReason,
          }
        : {}),
    },
    rolledOver: true,
  };
}

export function applyDailySchoolDeduction(
  member: Member,
  now: Date,
  settings?: Partial<AppSettings>,
  forceNextWeekday?: boolean,
  skipBecauseSick?: boolean
): {
  allowance: KidAllowanceState;
  deducted: boolean;
  weekdayNum: number | null;
  amount: number;
} {
  const eco = getKidEconomyConfig(member, settings);
  const { allowance } = ensureCurrentWeekAllowance(member, now, settings);
  const todayKey = getDateKey(now);

  // Never charge daily school allowance on public holidays, sick days, or active kid away/leave days
  if (
    !forceNextWeekday &&
    (isPublicHoliday(now, Boolean(settings?.isPublicHolidayToday)) ||
      skipBecauseSick ||
      isKidAwayOnDate(member, todayKey))
  ) {
    return { allowance, deducted: false, weekdayNum: null, amount: 0 };
  }

  const jsDay = now.getDay(); // 0 Sun, 1 Mon .. 5 Fri, 6 Sat
  let targetWeekday: number | null = null;

  if (forceNextWeekday) {
    for (let d = 1; d <= eco.schoolDaysPerWeek; d++) {
      if (!allowance.deductedWeekdays.includes(d)) {
        targetWeekday = d;
        break;
      }
    }
  } else if (jsDay >= 1 && jsDay <= eco.schoolDaysPerWeek) {
    if (!allowance.deductedWeekdays.includes(jsDay)) {
      targetWeekday = jsDay;
    }
  }

  if (targetWeekday === null) {
    return { allowance, deducted: false, weekdayNum: null, amount: 0 };
  }

  const dayTh = WEEKDAY_NAMES_TH[targetWeekday] ?? `วัน ${targetWeekday}`;
  return {
    deducted: true,
    weekdayNum: targetWeekday,
    amount: eco.dailyAllowanceThb,
    allowance: {
      ...allowance,
      coins: allowance.coins - eco.dailyAllowanceThb,
      deductedWeekdays: [...allowance.deductedWeekdays, targetWeekday].sort((a, b) => a - b),
      coinHistory: [
        {
          id: `coin_sch_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: now.toISOString(),
          reason: `ค่าไปโรงเรียนวัน${dayTh} (-${eco.dailyAllowanceThb} ฿)`,
          amount: -eco.dailyAllowanceThb,
          kind: 'school_deduct' as const,
        },
        ...allowance.coinHistory,
      ].slice(0, 40),
    },
  };
}

export function triggerManualMondayReset(
  member: Member,
  now: Date,
  settings?: Partial<AppSettings>
): { allowance: KidAllowanceState; base: number; penalty: number; netCoins: number } {
  const eco = getKidEconomyConfig(member, settings);
  const { allowance } = ensureCurrentWeekAllowance(member, now, settings);
  const penalty = Math.max(0, allowance.weeklyPenaltyThb);
  const netCoins = Math.max(0, eco.weeklyBaseThb - penalty);

  return {
    base: eco.weeklyBaseThb,
    penalty,
    netCoins,
    allowance: {
      coins: netCoins,
      weekKey: getMondayWeekKey(now),
      deductedWeekdays: [],
      weeklyPenaltyThb: 0,
      coinHistory: [
        {
          id: `coin_reset_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: now.toISOString(),
          reason:
            penalty > 0
              ? `เริ่มสัปดาห์ใหม่วันจันทร์ (${eco.weeklyBaseThb} - หักผิดกฎ ${penalty} = ${netCoins} ฿)`
              : `เริ่มสัปดาห์ใหม่วันจันทร์ (รับเต็ม ${eco.weeklyBaseThb} ฿)`,
          amount: netCoins,
          kind: 'weekly_topup' as const,
        },
        ...allowance.coinHistory,
      ].slice(0, 40),
      ...(typeof allowance.customDailyAllowanceThb === 'number'
        ? { customDailyAllowanceThb: allowance.customDailyAllowanceThb }
        : {}),
      ...(allowance.awayUntilDateKey
        ? {
            awayUntilDateKey: allowance.awayUntilDateKey,
            awayReason: allowance.awayReason,
          }
        : {}),
    },
  };
}

export function applyRulePenaltyToKidAndPool(
  member: Member,
  amountThb: number,
  reason: string,
  recordedBy: string,
  now: Date,
  settings?: Partial<AppSettings>
): { nextAllowance: KidAllowanceState; poolLog: GoldenPoolLog } {
  const cleanAmount = Math.max(1, Math.round(amountThb));
  const { allowance } = ensureCurrentWeekAllowance(member, now, settings);
  const ts = now.toISOString();

  const nextAllowance: KidAllowanceState = {
    ...allowance,
    coins: allowance.coins - cleanAmount,
    weeklyPenaltyThb: allowance.weeklyPenaltyThb + cleanAmount,
    coinHistory: [
      {
        id: `coin_pen_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: ts,
        reason: `${reason} (-${cleanAmount} ฿ → กระปุกทองคำ & หักจันทร์หน้า)`,
        amount: -cleanAmount,
        kind: 'penalty' as const,
      },
      ...allowance.coinHistory,
    ].slice(0, 40),
  };

  const poolLog: GoldenPoolLog = {
    id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kidId: member.id,
    kidNickname: member.nickname,
    amount: cleanAmount,
    kind: 'penalty_in',
    reason,
    recordedBy,
    createdAt: ts,
  };

  return { nextAllowance, poolLog };
}

export function computeGoldenPoolBalance(logs?: GoldenPoolLog[]): number {
  if (!Array.isArray(logs) || logs.length === 0) return 0;
  const total = logs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return Math.max(0, total);
}
