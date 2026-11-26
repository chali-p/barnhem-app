import {
  AppSettings,
  CommandAuthMode,
  CommandPenaltyPresetId,
  CustomQuickCommand,
  Language,
  LoginCommandType,
  Member,
} from '../types/barnhem';
import { applyMorningStreakOnTime } from './houseChores';
import { applyDailySchoolDeduction, getEconomyConfig, isKidAwayOnDate } from './piggyBank';
import { getDateKey, getMinutesOfDay, getTomorrowDateKey, isPublicHoliday } from './timeRules';

export interface KioskPenaltyAlert {
  kidNickname: string;
  kidEmoji?: string;
  headline: string;
  reasonLine: string;
  penaltyText: string;
  clockNote?: string;
}

export interface KioskResult {
  success: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  starsDelta: number;
  emoji: string;
  updatedKid?: Member;
  fineThb?: number;
  fineReason?: string;
  penaltyAlert?: KioskPenaltyAlert;
}

export function playKioskChime(success: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    if (success) {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

export function evaluateExpressKioskScan(
  kid: Member,
  now: Date,
  lang: Language,
  settings?: Partial<AppSettings>,
  isSickToday = false
): KioskResult {
  const mins = getMinutesOfDay(now);
  const eco = getEconomyConfig(settings);
  const earlyBonus = eco.early15MinBonusStars;

  const appendStarTx = (prev: Member, amount: number, reason: string, patch: Partial<Member>): Member => ({
    ...prev,
    ...patch,
    stars: Math.max(0, prev.stars + amount),
    starHistory: [
      {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: now.toISOString(),
        reason,
        amount,
      },
      ...prev.starHistory,
    ].slice(0, 60),
  });

  // 1) 05:00 – 06:45 น. -> ด่านกินข้าวเช้า (ก่อน 06:40 รับ +5 ⭐, มาก่อน 15 นาที <= 06:25 รับเพิ่มเบี้ยขยัน)
  if (mins >= 5 * 60 && mins <= 6 * 60 + 45) {
    if (kid.daily.breakfastChecked) {
      return {
        success: true,
        emoji: '🍚',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} ผ่านด่านกินข้าวเช้าแล้ว` : `${kid.nickname} already checked breakfast`,
        bannerSubtitle: lang === 'th' ? 'พร้อมสแกนคนถัดไปได้เลย' : 'Ready for next person',
      };
    }
    const onTime = mins < 6 * 60 + 40;
    const isEarly15 = onTime && mins <= 6 * 60 + 25 && earlyBonus > 0;
    const streakUpdate = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const stars = (onTime ? 5 : 0) + (isEarly15 ? earlyBonus : 0) + (streakUpdate?.milestoneBonusStars ?? 0);
    const updated = appendStarTx(
      kid,
      stars,
      onTime
        ? `⚡ Kiosk: กินข้าวเช้าก่อน 06:40 น.${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐ เบี้ยขยัน)` : ''}${streakUpdate?.streakTextTh ? ` (${streakUpdate.streakTextTh})` : ''}`
        : '⚡ Kiosk: กินข้าวเช้า (06:40-06:45 น.)',
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        streak: streakUpdate ? streakUpdate.nextStreak : kid.streak,
        daily: { ...kid.daily, breakfastChecked: true },
      }
    );
    return {
      success: true,
      emoji: isEarly15 ? '🍚🌟' : '🍚',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คอินสำเร็จ ${stars > 0 ? `+${stars} ⭐` : '(0 ⭐)'}`
          : `${kid.nickname} Breakfast OK ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? `${isEarly15 ? `โบนัสมาก่อน 15 นาที +${earlyBonus} ⭐! · ` : ''}${streakUpdate?.streakTextTh ?? 'ผ่านด่านกินข้าวเช้าอัตโนมัติ (ใส่ชุดนักเรียนแล้ว)'}`
          : 'Auto Breakfast Check-in (School Uniform on)',
      updatedKid: updated,
    };
  }

  // 2) 06:46 – 08:00 น. -> ด่านขึ้นรถตู้ / กะเช้า (ไม่เกิน 07:01 รับ +10 ⭐, เพดานสายวันไปโรงเรียนถึง 08:00 น.)
  if (mins >= 6 * 60 + 46 && mins <= 8 * 60) {
    if (kid.daily.vanOrMorningChecked) {
      return {
        success: true,
        emoji: '🚐',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} ผ่านด่านขึ้นรถตู้แล้ว` : `${kid.nickname} already boarded van`,
        bannerSubtitle: lang === 'th' ? 'พร้อมสแกนคนถัดไปได้เลย' : 'Ready for next person',
      };
    }
    const onTime = mins <= 7 * 60 + 1;
    const isEarly15 = onTime && mins <= 6 * 60 + 46 && earlyBonus > 0;
    const streakUpdate = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const stars = (onTime ? 10 : 0) + (isEarly15 ? earlyBonus : 0) + (streakUpdate?.milestoneBonusStars ?? 0);
    const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
    const updated = appendStarTx(
      kid,
      stars,
      onTime
        ? `⚡ Kiosk: ขึ้นรถตู้ทันเวลา (ไม่เกิน 07:01 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐ เบี้ยขยัน)` : ''}${streakUpdate?.streakTextTh ? ` (${streakUpdate.streakTextTh})` : ''}`
        : '⚡ Kiosk: ขึ้นรถตู้สาย (หลัง 07:01 น.)',
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        streak: streakUpdate ? streakUpdate.nextStreak : kid.streak,
        allowance: schoolDeduct.allowance,
        daily: { ...kid.daily, vanOrMorningChecked: true },
      }
    );
    return {
      success: true,
      emoji: '🚐',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คอินสำเร็จ ${stars > 0 ? `+${stars} ⭐` : '(0 ⭐)'}`
          : `${kid.nickname} School Van OK ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? `${schoolDeduct.deducted ? `กระปุกหมู -${schoolDeduct.amount} ฿ · ` : ''}${isEarly15 ? `มาก่อน 15 นาที +${earlyBonus} ⭐ · ` : ''}${
              streakUpdate?.streakTextTh ??
              (onTime ? 'ผ่านด่านขึ้นรถตู้อัตโนมัติ!' : 'ผ่านด่านขึ้นรถตู้ (เลย 07:01 น.)')
            }`
          : 'Auto School Van Check-in!',
      updatedKid: updated,
    };
  }

  // 3) 16:00 – 16:40 น. -> เช็คอินกลับบ้าน + เริ่มจับเวลา Speedy Ninja 20 นาที อัตโนมัติ
  if (mins >= 16 * 60 && mins <= 16 * 60 + 40) {
    if (kid.daily.returnedHomeChecked) {
      return {
        success: true,
        emoji: '🥷',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} เช็คอินกลับบ้านแล้ว` : `${kid.nickname} already checked home`,
        bannerSubtitle: lang === 'th' ? 'Speedy Ninja กำลังทำงาน' : 'Speedy Ninja active',
      };
    }
    const stars = kid.group === 3 ? 20 : kid.group === 2 ? 5 : 0;
    const updated = appendStarTx(
      kid,
      stars,
      '⚡ Kiosk: เช็คอินกลับบ้าน + Speedy Ninja 20 นาที',
      {
        avatar: { ...kid.avatar, outfitMode: 'lounge' },
        daily: {
          ...kid.daily,
          returnedHomeChecked: true,
          speedyNinjaStartMs: now.getTime(),
        },
      }
    );
    return {
      success: true,
      emoji: '🥷',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คอินกลับบ้านสำเร็จ! ${stars > 0 ? `+${stars} ⭐` : ''}`
          : `${kid.nickname} Home Check-in OK!`,
      bannerSubtitle:
        lang === 'th'
          ? 'เริ่มจับเวลา Speedy Ninja 20 นาที อัตโนมัติ (เปลี่ยนเป็นชุดอยู่บ้านแล้ว)'
          : 'Speedy Ninja 20-min timer started!',
      updatedKid: updated,
    };
  }

  // 4) 16:41 – 17:30 น. -> ด่านเรียนเสริม (ไม่เกิน 16:50 น. รับ +10 ⭐, ก่อน 15 นาที <= 16:35 น.)
  if (mins >= 16 * 60 + 41 && mins <= 17 * 60 + 30) {
    if (kid.daily.extraStudyChecked) {
      return {
        success: true,
        emoji: '📚',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} ผ่านด่านเรียนเสริมแล้ว` : `${kid.nickname} study already checked`,
        bannerSubtitle: lang === 'th' ? 'พร้อมสแกนคนถัดไปได้เลย' : 'Ready for next person',
      };
    }
    const onTime = mins <= 16 * 60 + 50;
    const stars = onTime ? 10 : 0;
    const updated = appendStarTx(
      kid,
      stars,
      onTime ? '⚡ Kiosk: ด่านเรียนเสริม (ไม่เกิน 16:50 น.)' : '⚡ Kiosk: ด่านเรียนเสริม (หลัง 16:50 น.)',
      {
        daily: { ...kid.daily, extraStudyChecked: true },
      }
    );
    return {
      success: true,
      emoji: '📚',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คอินสำเร็จ ${stars > 0 ? `+${stars} ⭐` : '(0 ⭐)'}`
          : `${kid.nickname} Extra Study OK ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle: lang === 'th' ? 'ผ่านด่านเรียนเสริมอัตโนมัติ!' : 'Auto Extra Study Check-in!',
      updatedKid: updated,
    };
  }

  // 5) 17:31 – 19:30 น. -> งานบ้าน & ตากชุดนักเรียน (ก่อน 18:15 +10 ⭐, ก่อน 15 นาที <= 18:00 รับเพิ่ม)
  if (mins >= 17 * 60 + 31 && mins <= 19 * 60 + 30) {
    if (kid.daily.choresChecked) {
      return {
        success: true,
        emoji: '🧹',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} ผ่านด่านงานบ้านแล้ว` : `${kid.nickname} chores already checked`,
        bannerSubtitle: lang === 'th' ? 'พร้อมสแกนคนถัดไปได้เลย' : 'Ready for next person',
      };
    }
    const isEarly15 = mins <= 18 * 60 && earlyBonus > 0;
    const stars = (mins < 18 * 60 + 15 ? 10 : mins <= 18 * 60 + 50 ? 3 : 0) + (isEarly15 ? earlyBonus : 0);
    const updated = appendStarTx(
      kid,
      stars,
      `⚡ Kiosk: งานบ้าน & ตากชุดนักเรียน${isEarly15 ? ` · เสร็จก่อน 15 นาที (+${earlyBonus} ⭐)` : ''} (+${stars} ⭐)`,
      {
        daily: { ...kid.daily, choresChecked: true },
      }
    );
    return {
      success: true,
      emoji: '🧹',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คอินสำเร็จ ${stars > 0 ? `+${stars} ⭐` : '(0 ⭐)'}`
          : `${kid.nickname} Chores OK ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? isEarly15
            ? `เยี่ยมมาก! เสร็จก่อน 18:00 น. รับเบี้ยขยัน +${earlyBonus} ⭐ เพิ่มด้วย`
            : 'ผ่านด่านงานบ้าน & ตากชุดนักเรียนอัตโนมัติ!'
          : 'Auto Chores & Uniform Check-in!',
      updatedKid: updated,
    };
  }

  // Out of Express Kiosk time windows
  return {
    success: false,
    emoji: '⏰',
    starsDelta: 0,
    bannerTitle:
      lang === 'th'
        ? `สแกนพบน้อง${kid.nickname} (นอกช่วงเวลา Kiosk ด่วน)`
        : `Scanned ${kid.nickname} (Outside Express Window)`,
    bannerSubtitle:
      lang === 'th'
        ? 'ช่วงด่วน: 05:00-08:00 และ 16:00-19:30 น. (หากต้องการดูดาว ให้สแกนเข้าหน้าปกติ)'
        : 'Express windows: 05:00-08:00 & 16:00-19:30. Switch to Personal mode to open hub.',
  };
}

/**
 * 1-Tap Morning "ไปโรงเรียน" (Go to School) check-in without barcode scanner.
 * Completes the kid's morning school departure check-in in a single tap.
 */
export function evaluateOneTapGoToSchool(
  kid: Member,
  now: Date,
  lang: Language,
  settings?: Partial<AppSettings>,
  isSickToday = false
): KioskResult {
  if (!canKidUseCommand('morning_school', kid, settings)) {
    const denied = getCommandDenialReason('morning_school', kid, lang, settings);
    return {
      success: false,
      emoji: '🚫',
      starsDelta: 0,
      bannerTitle: denied.title,
      bannerSubtitle: denied.subtitle,
    };
  }
  if (kid.daily.vanOrMorningChecked) {
    return {
      success: true,
      emoji: '✅',
      starsDelta: 0,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} กดไปโรงเรียนวันนี้แล้ว`
          : `${kid.nickname} already checked Go to School`,
      bannerSubtitle:
        lang === 'th'
          ? 'เช็คชื่อเรียบร้อยแล้วค่ะ กดชื่อคนถัดไปต่อได้เลย'
          : 'Already checked in today — next student can tap their name.',
    };
  }

  const todayKey = getDateKey(now);
  const mins = getMinutesOfDay(now);
  const day = now.getDay();
  const eco = getEconomyConfig(settings);
  const earlyBonus = eco.early15MinBonusStars;
  const isHolidayToday = isPublicHoliday(now, Boolean(settings?.isPublicHolidayToday));
  const isAwayToday = isKidAwayOnDate(kid, todayKey);

  const appendStarTx = (prev: Member, amount: number, reason: string, patch: Partial<Member>): Member => ({
    ...prev,
    ...patch,
    stars: Math.max(0, prev.stars + amount),
    starHistory: [
      {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: now.toISOString(),
        reason,
        amount,
      },
      ...prev.starHistory,
    ].slice(0, 60),
  });

  // Public Holiday or Weekend
  if (isHolidayToday || day === 0 || day === 6) {
    const label = isHolidayToday ? 'วันหยุดราชการ' : day === 6 ? 'เช้าวันเสาร์' : 'เช้าวันอาทิตย์';
    const stars = isHolidayToday ? 10 : day === 0 && mins <= 8 * 60 + 15 ? 15 : mins <= 8 * 60 + 30 ? 10 : 0;
    const updated = appendStarTx(kid, stars, `🚌 ปุ่มด่วน "ไปโรงเรียน" (${label} +${stars} ⭐)`, {
      daily: {
        ...kid.daily,
        morningDressedConfirmed: true,
        vanOrMorningChecked: true,
      },
    });
    return {
      success: true,
      emoji: '🎉',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} เช็คชื่อกะเช้า (${label}) สำเร็จ ${stars > 0 ? `+${stars} ⭐` : ''}`
          : `${kid.nickname} Morning Check-in OK ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? 'วันหยุด/เสาร์-อาทิตย์ ไม่หักค่าไปโรงเรียน 70 ฿ ค่ะ'
          : 'Holiday/weekend — no daily school allowance deduction.',
      updatedKid: updated,
    };
  }

  // Group 1 (Elementary - Van <= 07:01)
  if (kid.group === 1) {
    const onTime = mins <= 7 * 60 + 1;
    const isEarly15 = onTime && mins <= 6 * 60 + 46 && earlyBonus > 0;
    const streakUpdate = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const stars = (onTime ? 10 : 0) + (isEarly15 ? earlyBonus : 0) + (streakUpdate?.milestoneBonusStars ?? 0);
    const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
    const updated = appendStarTx(
      kid,
      stars,
      onTime
        ? `🚌 ปุ่มด่วน "ไปโรงเรียน": ขึ้นรถตู้ตรงเวลา (≤07:01 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐)` : ''}${streakUpdate?.streakTextTh ? ` · ${streakUpdate.streakTextTh}` : ''}`
        : '🚌 ปุ่มด่วน "ไปโรงเรียน": ขึ้นรถตู้หลัง 07:01 น.',
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        streak: streakUpdate ? streakUpdate.nextStreak : kid.streak,
        allowance: schoolDeduct.allowance,
        daily: {
          ...kid.daily,
          morningDressedConfirmed: true,
          vanOrMorningChecked: true,
        },
      }
    );
    return {
      success: true,
      emoji: onTime ? '🚌🌟' : '🚐⏰',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ไปโรงเรียนแล้ว! ${stars > 0 ? `+${stars} ⭐` : '(หลัง 07:01 น.)'}`
          : `${kid.nickname} Going to School! ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? `${schoolDeduct.deducted ? `กระปุกหมู -${schoolDeduct.amount} ฿ · ` : isAwayToday || isSickToday ? 'ยกเว้นหักค่าไปโรงเรียน · ' : ''}${
              isEarly15 ? `เบี้ยขยันมาก่อนเวลา +${earlyBonus} ⭐ · ` : ''
            }${streakUpdate?.streakTextTh ?? 'เปลี่ยนเป็นชุดนักเรียนและเช็คชื่อขึ้นรถตู้เรียบร้อย!'}`
          : 'School uniform & van check-in recorded!',
      updatedKid: updated,
    };
  }

  // Group 3 (College / Internship - No morning fine)
  if (kid.group === 3) {
    const isEarly15 = mins <= 7 * 60 + 15 && earlyBonus > 0;
    const stars = 10 + (isEarly15 ? earlyBonus : 0);
    const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
    const updated = appendStarTx(
      kid,
      stars,
      `🚌 ปุ่มด่วน "ไปโรงเรียน/ฝึกงาน" (พี่ใหญ่ +${stars} ⭐)${isEarly15 ? ` · เช้าก่อนเวลา 15 นาที (+${earlyBonus} ⭐)` : ''}`,
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        allowance: schoolDeduct.allowance,
        daily: {
          ...kid.daily,
          morningDressedConfirmed: true,
          vanOrMorningChecked: true,
        },
      }
    );
    return {
      success: true,
      emoji: '🎓✨',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ไปโรงเรียน/ฝึกงานแล้ว! +${stars} ⭐`
          : `${kid.nickname} Going to College/Internship! +${stars} ⭐`,
      bannerSubtitle:
        lang === 'th'
          ? `${schoolDeduct.deducted ? `กระปุกหมู -${schoolDeduct.amount} ฿ · ` : ''}บันทึกเช็คชื่อกะเช้าเรียบร้อยค่ะ`
          : 'Morning check-in recorded!',
      updatedKid: updated,
    };
  }

  // Group 2 / Default (On time <= deadlineMins, late ceiling 08:00)
  const schoolCfg =
    getEffectiveHomeQuickActions(settings, true).find((a) => a.id === 'morning_school') ??
    HOME_QUICK_ACTIONS.find((a) => a.id === 'morning_school')!;
  const deadlineMins = schoolCfg.deadlineMins ?? 7 * 60 + 21;
  const rewardStars = Math.max(0, Math.round(schoolCfg.rewardStars ?? 10));
  const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
  if (mins <= deadlineMins) {
    const isEarly15 = mins <= deadlineMins - 15 && earlyBonus > 0;
    const streakUpdate = applyMorningStreakOnTime(kid, now);
    const stars = rewardStars + (isEarly15 ? earlyBonus : 0) + streakUpdate.milestoneBonusStars;
    const deadlineLabel = minsToHHMM(deadlineMins);
    const updated = appendStarTx(
      kid,
      stars,
      `🚌 ปุ่มด่วน "${schoolCfg.titleTh}": ตรงเวลา (≤${deadlineLabel} น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐)` : ''}${streakUpdate.streakTextTh ? ` · ${streakUpdate.streakTextTh}` : ''}`,
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        streak: streakUpdate.nextStreak,
        allowance: schoolDeduct.allowance,
        daily: {
          ...kid.daily,
          morningDressedConfirmed: true,
          vanOrMorningChecked: true,
        },
      }
    );
    return {
      success: true,
      emoji: '🚌✨',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ${schoolCfg.titleTh}แล้ว! +${stars} ⭐`
          : `${kid.nickname} Going to School! +${stars} ⭐`,
      bannerSubtitle:
        lang === 'th'
          ? `${schoolDeduct.deducted ? `กระปุกหมู -${schoolDeduct.amount} ฿ · ` : ''}${
              isEarly15 ? `เบี้ยขยัน +${earlyBonus} ⭐ · ` : ''
            }${streakUpdate.streakTextTh ?? 'ตรงเวลา เช็คชื่อเรียบร้อยค่ะ'}`
          : 'School check-in on time!',
      updatedKid: updated,
    };
  }

  const SCHOOL_LATE_CEILING = Math.max(deadlineMins + 15, 8 * 60);
  const cappedMins = Math.min(mins, SCHOOL_LATE_CEILING);
  const minsLate = Math.max(1, cappedMins - deadlineMins);
  const pastCeiling = mins > SCHOOL_LATE_CEILING;
  const preset = schoolCfg.penaltyPreset ?? 'per_minute_fine_thb';
  const fine =
    isSickToday || isAwayToday
      ? 0
      : preset === 'fixed_fine_thb'
      ? 20
      : preset === 'per_minute_fine_thb'
      ? Math.min(minsLate * 5, 50)
      : 0;
  const fineReason = `ไปโรงเรียนสาย ${minsLate} นาที${pastCeiling ? ` (เพดานสาย ${minsToHHMM(SCHOOL_LATE_CEILING)} น.)` : ''}`;
  const penaltyPatch =
    isSickToday || isAwayToday
      ? {
          avatar: { ...kid.avatar, outfitMode: 'uniform' as const },
          allowance: schoolDeduct.allowance,
          daily: {
            ...kid.daily,
            morningDressedConfirmed: true,
            vanOrMorningChecked: true,
          },
        }
      : fine > 0
      ? {
          avatar: { ...kid.avatar, outfitMode: 'uniform' as const },
          allowance: schoolDeduct.allowance,
          penalty: {
            ...kid.penalty,
            lateFineThb: kid.penalty.lateFineThb + fine,
          },
          daily: {
            ...kid.daily,
            morningDressedConfirmed: true,
            vanOrMorningChecked: true,
          },
        }
      : {
          avatar: { ...kid.avatar, outfitMode: 'uniform' as const },
          allowance: schoolDeduct.allowance,
          daily: {
            ...kid.daily,
            morningDressedConfirmed: true,
            vanOrMorningChecked: true,
          },
        };
  const updated = appendStarTx(
    kid,
    0,
    isSickToday || isAwayToday
      ? `🚌 ปุ่มด่วน "${schoolCfg.titleTh}" (${fineReason} · ยกเว้นค่าปรับเพราะ${isSickToday ? 'ป่วย' : 'ลาพัก'})`
      : fine > 0
      ? `🚌 ปุ่มด่วน "${schoolCfg.titleTh}" (${fineReason} · หักกระปุกหมู ${fine} ฿ → เข้ากระปุกทองคำ)`
      : `🚌 ปุ่มด่วน "${schoolCfg.titleTh}" (${fineReason} · ${schoolCfg.penaltyNote || 'เกินเส้นตาย'})`,
    penaltyPatch
  );
  return {
    success: true,
    emoji: fine > 0 ? '🚌⏰' : '💚🚌',
    starsDelta: 0,
    fineThb: fine,
    fineReason,
    penaltyAlert:
      fine > 0
        ? {
            kidNickname: kid.nickname,
            kidEmoji: kid.emoji,
            headline:
              lang === 'th'
                ? 'เลยกำหนดเวลาไปโรงเรียนแล้ว!'
                : 'Past School Departure Deadline!',
            reasonLine:
              lang === 'th'
                ? `เลยกำหนด ${minsToHHMM(deadlineMins)} น. มาแล้ว ${minsLate} นาที`
                : `${minsLate} min past ${minsToHHMM(deadlineMins)} deadline`,
            penaltyText:
              lang === 'th'
                ? `บันทึกค่าปรับ ${fine} บาท เข้ากระปุกทองคำ`
                : `Fine recorded: ${fine} THB`,
            clockNote:
              lang === 'th'
                ? `บันทึกเวลา ${minsToHHMM(mins)} น.`
                : `Recorded at ${minsToHHMM(mins)}`,
          }
        : undefined,
    bannerTitle:
      lang === 'th'
        ? fine > 0
          ? `น้อง${kid.nickname} ไปโรงเรียนแล้ว (สาย ${minsLate} นาที · -${fine} ฿)`
          : `น้อง${kid.nickname} ไปโรงเรียนแล้ว (ยกเว้นค่าปรับ)`
        : `${kid.nickname} Checked Go to School`,
    bannerSubtitle:
      lang === 'th'
        ? `${schoolDeduct.deducted ? `กระปุกหมู -${schoolDeduct.amount} ฿ · ` : ''}${
            fine > 0 ? `เกิน 07:21 น. บันทึกค่าปรับ ${fine} ฿ เข้ากระปุกทองคำแล้ว` : 'เดินทางปลอดภัยนะคะ'
          }`
        : 'School check-in saved!',
    updatedKid: updated,
  };
}

export type HomeQuickActionId =
  | 'morning_phone_pickup'
  | 'morning_breakfast'
  | 'morning_school'
  | 'afternoon_home'
  | 'evening_uniform_phone'
  | 'evening_computer_homework'
  | 'evening_unlock_cartoon'
  | 'night_homework_permission'
  | 'night_return_phone'
  | 'daily_penalty';

export interface PenaltyPresetOption {
  id: CommandPenaltyPresetId;
  emoji: string;
  labelTh: string;
  labelEn: string;
  defaultNoteTh: string;
  defaultNoteEn: string;
}

export const PENALTY_PRESET_OPTIONS: PenaltyPresetOption[] = [
  {
    id: 'deduct_free_day',
    emoji: '🗓️',
    labelTh: 'หักสิทธิ์ Free Day วันศุกร์',
    labelEn: 'Deduct Friday Free Day Privilege',
    defaultNoteTh: 'หัก Free Day 1 วัน',
    defaultNoteEn: 'Deduct 1 Free Day',
  },
  {
    id: 'deduct_stars',
    emoji: '⭐',
    labelTh: 'หักดาวสะสม',
    labelEn: 'Deduct Saved Stars',
    defaultNoteTh: 'หักดาวสะสม 5 ดวง',
    defaultNoteEn: 'Deduct 5 Stars',
  },
  {
    id: 'fixed_fine_thb',
    emoji: '🧾',
    labelTh: 'ปรับเงินคงที่',
    labelEn: 'Fixed Fine (THB)',
    defaultNoteTh: 'ปรับเงินคงที่ 20 บาท',
    defaultNoteEn: 'Fixed 20 THB Fine',
  },
  {
    id: 'per_minute_fine_thb',
    emoji: '💸',
    labelTh: 'ปรับเงินรายนาที (สูงสุด 50 บาท)',
    labelEn: 'Per-Minute Fine (Max 50 THB)',
    defaultNoteTh: 'ปรับนาทีละ 5 บาท (สูงสุด 50 บ.)',
    defaultNoteEn: '5 THB/min (Max 50 THB)',
  },
  {
    id: 'no_phone_today_1830',
    emoji: '📵',
    labelTh: 'งดใช้มือถือวันนี้ถึง 18:30 น.',
    labelEn: 'No Phone Today Until 18:30',
    defaultNoteTh: 'งดใช้มือถือวันนี้ถึง 18:30 น.',
    defaultNoteEn: 'No phone today until 18:30',
  },
  {
    id: 'no_phone_tomorrow',
    emoji: '📵',
    labelTh: 'งดใช้มือถือวันพรุ่งนี้ 1 วัน',
    labelEn: 'No Phone Tomorrow (1 Day)',
    defaultNoteTh: 'งดใช้มือถือวันพรุ่งนี้ 1 วัน',
    defaultNoteEn: 'No phone tomorrow for 1 day',
  },
  {
    id: 'special_duty',
    emoji: '🧹',
    labelTh: 'บันทึกบทลงโทษ / เวรพิเศษ',
    labelEn: 'Record Penalty / Special Duty',
    defaultNoteTh: 'บันทึกบทลงโทษ / เวรพิเศษ',
    defaultNoteEn: 'Penalty / Special Duty',
  },
  {
    id: 'lock_after_deadline',
    emoji: '🔒',
    labelTh: 'ล็อกปุ่มทันทีเมื่อเกินเส้นตาย (ห้ามกด)',
    labelEn: 'Lock Button Immediately After Deadline',
    defaultNoteTh: 'ล็อกปุ่มทันทีเมื่อเลยเส้นตาย',
    defaultNoteEn: 'Locked immediately past deadline',
  },
  {
    id: 'no_fine_zero_stars',
    emoji: '⭐',
    labelTh: 'ไม่มีค่าปรับ (ไม่ได้ดาวเมื่อเลยเส้นตาย)',
    labelEn: 'No Fine (0 Stars After Deadline)',
    defaultNoteTh: 'ไม่ได้ดาวเมื่อเลยเส้นตาย',
    defaultNoteEn: 'No stars awarded past deadline',
  },
];

export function getPenaltyPresetMeta(presetId?: string): PenaltyPresetOption | null {
  if (!presetId) return null;
  return PENALTY_PRESET_OPTIONS.find((p) => p.id === presetId) ?? null;
}

export function getPenaltySummaryText(
  presetId: string | undefined,
  penaltyNote: string | undefined,
  lang: Language
): string {
  const cleanNote = (penaltyNote ?? '').trim();
  if (cleanNote) return cleanNote;
  const meta = getPenaltyPresetMeta(presetId);
  if (meta) return lang === 'th' ? meta.defaultNoteTh : meta.defaultNoteEn;
  if (presetId && presetId.trim()) return presetId.trim();
  return lang === 'th' ? 'ไม่ได้ดาวเมื่อเลยเส้นตาย' : 'No stars past deadline';
}

export interface HomeQuickActionConfig {
  id: HomeQuickActionId;
  emoji: string;
  startMins: number;
  endMins: number;
  earlyGraceMins: number;
  deadlineMins: number;
  rewardStars: number;
  penaltyPreset: string;
  penaltyNote: string;
  commandType: LoginCommandType;
  defaultAuthMode: CommandAuthMode;
  enabled: boolean;
  hidden: boolean;
  windowLabelTh: string;
  windowLabelEn: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  tapLabelTh: string;
  tapLabelEn: string;
  doneLabelTh: string;
  doneLabelEn: string;
}

export const HOME_QUICK_ACTIONS: HomeQuickActionConfig[] = [
  {
    id: 'morning_phone_pickup',
    emoji: '📱',
    startMins: 6 * 60,
    endMins: 7 * 60,
    earlyGraceMins: 5,
    deadlineMins: 7 * 60,
    rewardStars: 5,
    penaltyPreset: 'lock_after_deadline',
    penaltyNote: 'ล็อกปุ่มทันทีเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'self_tap',
    enabled: true,
    hidden: false,
    windowLabelTh: '06:00–07:00 น.',
    windowLabelEn: '06:00–07:00',
    titleTh: 'มาขอรับมือถือ',
    titleEn: 'Morning Phone Pickup',
    descriptionTh: 'เช็คอินรับมือถือช่วงเช้าก่อนไปโรงเรียน / ฝึกงาน',
    descriptionEn: 'Morning phone pickup check-in before school or internship.',
    tapLabelTh: '📱 มาขอรับมือถือ',
    tapLabelEn: '📱 Get Phone',
    doneLabelTh: '✅ รับมือถือแล้ว',
    doneLabelEn: '✅ Phone Collected',
  },
  {
    id: 'morning_breakfast',
    emoji: '🍚',
    startMins: 6 * 60 + 10,
    endMins: 7 * 60 + 30,
    earlyGraceMins: 10,
    deadlineMins: 6 * 60 + 40,
    rewardStars: 5,
    penaltyPreset: 'no_fine_zero_stars',
    penaltyNote: 'ไม่ได้ดาวเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'staff_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '06:10–07:30 น.',
    windowLabelEn: '06:10–07:30',
    titleTh: 'กินข้าวเช้า',
    titleEn: 'Breakfast',
    descriptionTh: 'เช็คอินทานข้าวเช้าน้องกลุ่ม 1 (ก่อน 06:40 น. รับ +5 ⭐)',
    descriptionEn: 'Breakfast check-in (before 06:40 earns +5 ⭐).',
    tapLabelTh: '🍚 กินข้าวเช้า',
    tapLabelEn: '🍚 Breakfast',
    doneLabelTh: '✅ กินข้าวแล้ว',
    doneLabelEn: '✅ Ate Breakfast',
  },
  {
    id: 'morning_school',
    emoji: '🚌',
    startMins: 6 * 60 + 30,
    endMins: 7 * 60 + 30,
    earlyGraceMins: 10,
    deadlineMins: 7 * 60 + 21,
    rewardStars: 10,
    penaltyPreset: 'per_minute_fine_thb',
    penaltyNote: 'ปรับนาทีละ 5 บาท (สูงสุด 50 บ.)',
    commandType: 'routine',
    defaultAuthMode: 'staff_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '06:30–07:30 น.',
    windowLabelEn: '06:30–07:30',
    titleTh: 'ไปโรงเรียน',
    titleEn: 'Go to School',
    descriptionTh: 'เช็คอินขึ้นรถตู้ / ออกเดินทางไปโรงเรียนหรือฝึกงาน',
    descriptionEn: 'Check in boarding van / leaving for school or internship.',
    tapLabelTh: '🚌 ไปโรงเรียน',
    tapLabelEn: '🚌 Go to School',
    doneLabelTh: '✅ ไปแล้ว',
    doneLabelEn: '✅ Checked',
  },
  {
    id: 'afternoon_home',
    emoji: '🏡',
    startMins: 15 * 60,
    endMins: 17 * 60,
    earlyGraceMins: 15,
    deadlineMins: 17 * 60,
    rewardStars: 5,
    penaltyPreset: 'no_fine_zero_stars',
    penaltyNote: 'ไม่ได้ดาวเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'self_tap',
    enabled: true,
    hidden: false,
    windowLabelTh: '15:00–17:00 น.',
    windowLabelEn: '15:00–17:00',
    titleTh: 'กลับบ้านแล้ว',
    titleEn: 'Returned Home',
    descriptionTh: 'เช็คอินกลับถึงบ้านเรียบร้อย เก็บมือถือและเปลี่ยนชุด',
    descriptionEn: 'Check in arriving home, storing phone and changing clothes.',
    tapLabelTh: '🏡 กลับบ้านแล้ว',
    tapLabelEn: '🏡 Home Now',
    doneLabelTh: '✅ กลับบ้านแล้ว',
    doneLabelEn: '✅ Back Home',
  },
  {
    id: 'evening_uniform_phone',
    emoji: '👕',
    startMins: 18 * 60,
    endMins: 20 * 60 + 30,
    earlyGraceMins: 10,
    deadlineMins: 19 * 60 + 30,
    rewardStars: 10,
    penaltyPreset: 'no_fine_zero_stars',
    penaltyNote: 'ไม่ได้ดาวเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'self_tap',
    enabled: true,
    hidden: false,
    windowLabelTh: '18:00–20:30 น.',
    windowLabelEn: '18:00–20:30',
    titleTh: 'ตรวจชุด & รับมือถือ',
    titleEn: 'Uniform & Get Phone',
    descriptionTh: 'ซัก-รีด-ตรวจชุดนักเรียน & อาบน้ำเรียบร้อย รับมือถือรอบเย็น',
    descriptionEn: 'Uniform checked & showered, collect evening phone.',
    tapLabelTh: '👕 ตรวจชุด & รับมือถือ',
    tapLabelEn: '👕 Uniform & Phone',
    doneLabelTh: '✅ รับมือถือแล้ว',
    doneLabelEn: '✅ Phone Collected',
  },
  {
    id: 'evening_computer_homework',
    emoji: '💻',
    startMins: 18 * 60 + 30,
    endMins: 20 * 60,
    earlyGraceMins: 0,
    deadlineMins: 20 * 60,
    rewardStars: 10,
    penaltyPreset: 'lock_after_deadline',
    penaltyNote: 'ล็อกปุ่มทันทีเมื่อเลยเวลา 20:00 น.',
    commandType: 'routine',
    defaultAuthMode: 'kid_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '18:30–20:00 น.',
    windowLabelEn: '18:30–20:00',
    titleTh: 'ขออนุญาตใช้คอมทำการบ้าน',
    titleEn: 'Computer for Homework',
    descriptionTh: 'เฉพาะรุ่นเด็กโต (มัธยม) · ต้องซักผ้า ตากผ้า รีดผ้า อาบน้ำ และตรวจชุดครบ 5 ข้อ (รับ +10 ⭐ · ใส่ PIN เอง)',
    descriptionEn: 'Older kids only (Group 2) · Requires washing, hang dry, ironing, shower & uniform check (+10 ⭐, Kid PIN).',
    tapLabelTh: '💻 ขออนุญาตใช้คอมทำการบ้าน',
    tapLabelEn: '💻 Computer Homework',
    doneLabelTh: '✅ อนุญาตใช้คอมแล้ว',
    doneLabelEn: '✅ Computer Approved',
  },
  {
    id: 'evening_unlock_cartoon',
    emoji: '📺',
    startMins: 20 * 60,
    endMins: 20 * 60 + 40,
    earlyGraceMins: 5,
    deadlineMins: 20 * 60 + 40,
    rewardStars: 10,
    penaltyPreset: 'lock_after_deadline',
    penaltyNote: 'ล็อกปุ่มทันทีเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'self_tap',
    enabled: true,
    hidden: false,
    windowLabelTh: '20:00–20:40 น.',
    windowLabelEn: '20:00–20:40',
    titleTh: 'ปลดล็อคดูการ์ตูน',
    titleEn: 'Unlock Cartoons',
    descriptionTh: 'ผ่านด่านทบทวนภาษา 20:00 น. รับสิทธิ์ดูการ์ตูน 20:00–20:40 น.',
    descriptionEn: 'Pass language review at 20:00 to unlock cartoon time 20:00–20:40.',
    tapLabelTh: '📺 ปลดล็อคการ์ตูน',
    tapLabelEn: '📺 Unlock Cartoons',
    doneLabelTh: '✅ ดูการ์ตูนแล้ว',
    doneLabelEn: '✅ Unlocked',
  },
  {
    id: 'night_homework_permission',
    emoji: '📝',
    startMins: 20 * 60 + 30,
    endMins: 20 * 60 + 45,
    earlyGraceMins: 5,
    deadlineMins: 20 * 60 + 45,
    rewardStars: 5,
    penaltyPreset: 'lock_after_deadline',
    penaltyNote: 'ล็อกปุ่มทันทีเมื่อเลยเส้นตาย',
    commandType: 'routine',
    defaultAuthMode: 'kid_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '20:30–20:45 น.',
    windowLabelEn: '20:30–20:45',
    titleTh: 'ขออนุญาตทำการบ้าน',
    titleEn: 'Homework Permission',
    descriptionTh: 'ลงทะเบียนใช้อุปกรณ์ทำการบ้านต่อหลัง 21:00 น. (ถึง 22:45 น.)',
    descriptionEn: 'Register device permission for homework past 21:00 (until 22:45).',
    tapLabelTh: '📝 ขออนุญาตทำการบ้าน',
    tapLabelEn: '📝 Homework Permission',
    doneLabelTh: '✅ ขออนุญาตแล้ว',
    doneLabelEn: '✅ Permitted',
  },
  {
    id: 'night_return_phone',
    emoji: '🌙',
    startMins: 20 * 60 + 46,
    endMins: 23 * 60,
    earlyGraceMins: 5,
    deadlineMins: 21 * 60,
    rewardStars: 5,
    penaltyPreset: 'deduct_free_day',
    penaltyNote: 'หัก Free Day 1 วัน',
    commandType: 'routine',
    defaultAuthMode: 'kid_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '20:46–23:00 น. (คำนวณเส้นตายอัตโนมัติ)',
    windowLabelEn: '20:46–23:00 (Auto Deadline)',
    titleTh: 'คืนมือถือ',
    titleEn: 'Return Phone',
    descriptionTh: 'ส่งคืนมือถือเข้าตู้พี่เลี้ยง (ระบบคำนวณเวลาอัตโนมัติ: ไม่ขอทำการบ้านคืนถึง 21:00 น. / ขอทำการบ้านแล้วคืนถึง 22:45 น.)',
    descriptionEn: 'Return mobile phone to cabinet (auto-calculates 21:00 if no homework registered vs 22:45 if registered).',
    tapLabelTh: '🌙 คืนมือถือ',
    tapLabelEn: '🌙 Return Phone',
    doneLabelTh: '✅ คืนมือถือแล้ว',
    doneLabelEn: '✅ Phone Returned',
  },
  {
    id: 'daily_penalty',
    emoji: '⚖️',
    startMins: 0,
    endMins: 23 * 60 + 59,
    earlyGraceMins: 0,
    deadlineMins: 23 * 60 + 59,
    rewardStars: 0,
    penaltyPreset: 'deduct_free_day',
    penaltyNote: 'หัก Free Day 1 วัน',
    commandType: 'penalty',
    defaultAuthMode: 'staff_pin',
    enabled: true,
    hidden: false,
    windowLabelTh: '00:00–23:59 น.',
    windowLabelEn: '00:00–23:59',
    titleTh: 'บทลงโทษ',
    titleEn: 'Daily Penalty',
    descriptionTh: 'บันทึกบทลงโทษประจำวัน (พี่เลี้ยงใส่ PIN ยืนยันเพื่อบันทึกโทษทันที)',
    descriptionEn: 'Record daily penalty immediately (Staff PIN confirmation).',
    tapLabelTh: '⚖️ บันทึกบทลงโทษ',
    tapLabelEn: '⚖️ Record Penalty',
    doneLabelTh: '⚖️ บันทึกแล้ว',
    doneLabelEn: '⚖️ Recorded',
  },
];

export const DEFAULT_HOMEWORK_CURFEW_MINS = 21 * 60; // 21:00 น. (3 ทุ่ม)

export function minsToHHMM(totalMins: number): string {
  const safe = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = String(Math.floor(safe / 60)).padStart(2, '0');
  const m = String(safe % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function getEffectiveHomeworkCurfewMins(settings?: Partial<AppSettings>): number {
  const raw = settings?.homeworkCurfewMins;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw < 1440) {
    return Math.round(raw);
  }
  return DEFAULT_HOMEWORK_CURFEW_MINS;
}

export function formatThaiCurfewClock(totalMins: number): string {
  const safe = Math.round(totalMins);
  const hhmm = minsToHHMM(safe);
  return safe === 21 * 60 ? `${hhmm} น. (3 ทุ่ม)` : `${hhmm} น.`;
}

export function compareLoginCommandsByTime(
  a: {
    startMins?: number;
    endMins?: number;
    deadlineMins?: number;
    alwaysOpen?: boolean;
    commandType?: LoginCommandType;
    kind?: CustomQuickCommand['kind'];
  },
  b: {
    startMins?: number;
    endMins?: number;
    deadlineMins?: number;
    alwaysOpen?: boolean;
    commandType?: LoginCommandType;
    kind?: CustomQuickCommand['kind'];
  }
): number {
  const aStart = typeof a.startMins === 'number' ? a.startMins : 0;
  const aEnd = typeof a.endMins === 'number' ? a.endMins : 23 * 60 + 59;
  const bStart = typeof b.startMins === 'number' ? b.startMins : 0;
  const bEnd = typeof b.endMins === 'number' ? b.endMins : 23 * 60 + 59;

  const aAllDay = Boolean(a.alwaysOpen) || (aStart === 0 && aEnd >= 23 * 60 + 59);
  const bAllDay = Boolean(b.alwaysOpen) || (bStart === 0 && bEnd >= 23 * 60 + 59);

  if (aAllDay !== bAllDay) {
    return aAllDay ? 1 : -1;
  }
  if (!aAllDay) {
    if (aStart !== bStart) return aStart - bStart;
    if (aEnd !== bEnd) return aEnd - bEnd;
    const aDeadline = typeof a.deadlineMins === 'number' ? a.deadlineMins : aEnd;
    const bDeadline = typeof b.deadlineMins === 'number' ? b.deadlineMins : bEnd;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  }
  const aIsPenalty = a.commandType === 'penalty' || a.kind === 'penalty';
  const bIsPenalty = b.commandType === 'penalty' || b.kind === 'penalty';
  if (aIsPenalty !== bIsPenalty) {
    return aIsPenalty ? 1 : -1;
  }
  return 0;
}

export function getEffectiveHomeQuickActions(
  settings?: Partial<AppSettings>,
  includeHidden = false
): HomeQuickActionConfig[] {
  const overrides = settings?.timedCommandSchedule;
  const curfewHHMM = minsToHHMM(getEffectiveHomeworkCurfewMins(settings));
  const mapped = HOME_QUICK_ACTIONS.map((action) => {
    const ov = overrides?.[action.id];
    const startMins =
      ov &&
      typeof ov.startMins === 'number' &&
      Number.isFinite(ov.startMins) &&
      ov.startMins >= 0 &&
      ov.startMins < 1440
        ? Math.round(ov.startMins)
        : action.startMins;
    const endMins =
      ov &&
      typeof ov.endMins === 'number' &&
      Number.isFinite(ov.endMins) &&
      ov.endMins >= 0 &&
      ov.endMins < 1440
        ? Math.round(ov.endMins)
        : action.endMins;
    const earlyGraceMins =
      ov &&
      typeof ov.earlyGraceMins === 'number' &&
      Number.isFinite(ov.earlyGraceMins) &&
      ov.earlyGraceMins >= 0 &&
      ov.earlyGraceMins <= 120
        ? Math.round(ov.earlyGraceMins)
        : action.earlyGraceMins;
    const deadlineMins =
      ov &&
      typeof ov.deadlineMins === 'number' &&
      Number.isFinite(ov.deadlineMins) &&
      ov.deadlineMins >= 0 &&
      ov.deadlineMins < 1440
        ? Math.round(ov.deadlineMins)
        : action.id === 'night_return_phone' && typeof settings?.homeworkCurfewMins === 'number'
        ? getEffectiveHomeworkCurfewMins(settings)
        : action.deadlineMins;
    const rewardStars =
      ov && typeof ov.rewardStars === 'number' && Number.isFinite(ov.rewardStars)
        ? Math.max(0, Math.min(50, Math.round(ov.rewardStars)))
        : action.rewardStars;
    const emoji = ov?.emoji?.trim() || action.emoji;
    const titleTh = ov?.titleTh?.trim() || action.titleTh;
    const titleEn = ov?.titleEn?.trim() || action.titleEn;
    const descriptionTh = ov?.descriptionTh !== undefined ? ov.descriptionTh : action.descriptionTh;
    const descriptionEn = ov?.descriptionEn !== undefined ? ov.descriptionEn : action.descriptionEn;
    const penaltyPreset = ov?.penaltyPreset !== undefined ? ov.penaltyPreset : action.penaltyPreset;
    const penaltyNote = ov?.penaltyNote !== undefined ? ov.penaltyNote : action.penaltyNote;
    const commandType: LoginCommandType = ov?.commandType ?? action.commandType;
    const enabled = ov?.enabled !== undefined ? Boolean(ov.enabled) : action.enabled;
    const hidden = ov?.hidden !== undefined ? Boolean(ov.hidden) : action.hidden;

    const sStr = minsToHHMM(startMins);
    const eStr = minsToHHMM(endMins);
    const isReturn = action.id === 'night_return_phone';
    const dStr = minsToHHMM(deadlineMins);
    return {
      ...action,
      emoji,
      titleTh,
      titleEn,
      descriptionTh,
      descriptionEn,
      startMins,
      endMins,
      earlyGraceMins,
      deadlineMins,
      rewardStars,
      penaltyPreset,
      penaltyNote,
      commandType,
      enabled,
      hidden,
      tapLabelTh: `${emoji} ${titleTh}`,
      tapLabelEn: `${emoji} ${titleEn}`,
      windowLabelTh: isReturn
        ? `${sStr}–${eStr} น. (Curfew ${ov?.deadlineMins !== undefined ? dStr : curfewHHMM})`
        : `${sStr}–${eStr} น.`,
      windowLabelEn: isReturn
        ? `${sStr}–${eStr} (${ov?.deadlineMins !== undefined ? dStr : curfewHHMM} Curfew)`
        : `${sStr}–${eStr}`,
    };
  });
  const list = includeHidden ? mapped : mapped.filter((a) => !a.hidden);
  return [...list].sort(compareLoginCommandsByTime);
}

export function getEffectiveHomeworkPermissionWindow(settings?: Partial<AppSettings>): {
  startMins: number;
  endMins: number;
  labelTh: string;
  labelEn: string;
} {
  const found =
    getEffectiveHomeQuickActions(settings, true).find((a) => a.id === 'night_homework_permission') ??
    HOME_QUICK_ACTIONS.find((a) => a.id === 'night_homework_permission')!;
  return {
    startMins: found.startMins,
    endMins: found.endMins,
    labelTh: found.windowLabelTh,
    labelEn: found.windowLabelEn,
  };
}

export function getEffectiveMorningPhoneWindow(settings?: Partial<AppSettings>): {
  startMins: number;
  endMins: number;
  labelTh: string;
  labelEn: string;
} {
  const found =
    getEffectiveHomeQuickActions(settings, true).find((a) => a.id === 'morning_phone_pickup') ??
    HOME_QUICK_ACTIONS.find((a) => a.id === 'morning_phone_pickup')!;
  return {
    startMins: found.startMins,
    endMins: found.endMins,
    labelTh: found.windowLabelTh,
    labelEn: found.windowLabelEn,
  };
}

export function isActionWithinTimeWindow(
  startMins: number,
  endMins: number,
  earlyGraceMins: number,
  deadlineMins: number | undefined,
  penaltyPreset: string | undefined,
  now: Date
): boolean {
  const mins = getMinutesOfDay(now);
  const grace = Math.max(0, Math.min(120, Math.round(earlyGraceMins || 0)));
  const effectiveStart =
    startMins === 0 && endMins >= 23 * 60 + 59
      ? 0
      : ((startMins - grace) % 1440 + 1440) % 1440;
  let effectiveEnd = endMins;
  if (
    penaltyPreset === 'lock_after_deadline' &&
    typeof deadlineMins === 'number' &&
    Number.isFinite(deadlineMins)
  ) {
    if (startMins <= endMins && deadlineMins >= startMins && deadlineMins <= endMins) {
      effectiveEnd = deadlineMins;
    }
  }
  if (effectiveStart <= effectiveEnd) {
    return mins >= effectiveStart && mins <= effectiveEnd;
  }
  return mins >= effectiveStart || mins <= effectiveEnd;
}

export function isActionPastCloseTime(
  startMins: number,
  endMins: number,
  earlyGraceMins: number,
  deadlineMins: number | undefined,
  penaltyPreset: string | undefined,
  now: Date
): boolean {
  if (
    isActionWithinTimeWindow(
      startMins,
      endMins,
      earlyGraceMins,
      deadlineMins,
      penaltyPreset,
      now
    )
  ) {
    return false;
  }
  const mins = getMinutesOfDay(now);
  let effectiveEnd = endMins;
  if (
    penaltyPreset === 'lock_after_deadline' &&
    typeof deadlineMins === 'number' &&
    Number.isFinite(deadlineMins)
  ) {
    if (startMins <= endMins && deadlineMins >= startMins && deadlineMins <= endMins) {
      effectiveEnd = deadlineMins;
    }
  }
  if (startMins <= endMins) {
    return mins > effectiveEnd;
  }
  return false;
}

export function isHomeActionOpenAt(
  actionId: HomeQuickActionId,
  now: Date,
  settings?: Partial<AppSettings>
): boolean {
  const cfg = getEffectiveHomeQuickActions(settings).find((a) => a.id === actionId);
  if (!cfg || !cfg.enabled || cfg.hidden) return false;
  if (actionId === 'night_return_phone') {
    const autoRule = getAutoReturnPhoneRuleConfig(settings);
    if (autoRule.enabled) {
      const minClose = Math.min(
        23 * 60 + 59,
        Math.max(autoRule.noHomeworkDeadlineMins, autoRule.homeworkExtendedDeadlineMins) + 15
      );
      const effectiveEnd = Math.max(cfg.endMins, minClose);
      return isActionWithinTimeWindow(
        cfg.startMins,
        effectiveEnd,
        cfg.earlyGraceMins,
        cfg.deadlineMins,
        'no_fine_zero_stars',
        now
      );
    }
  }
  return isActionWithinTimeWindow(
    cfg.startMins,
    cfg.endMins,
    cfg.earlyGraceMins,
    cfg.deadlineMins,
    cfg.penaltyPreset,
    now
  );
}

export function isHomeActionExpiredAt(
  actionId: HomeQuickActionId,
  now: Date,
  settings?: Partial<AppSettings>
): boolean {
  const cfg = getEffectiveHomeQuickActions(settings).find((a) => a.id === actionId);
  if (!cfg || !cfg.enabled || cfg.hidden) return true;
  if (actionId === 'night_return_phone') {
    const autoRule = getAutoReturnPhoneRuleConfig(settings);
    if (autoRule.enabled) {
      const minClose = Math.min(
        23 * 60 + 59,
        Math.max(autoRule.noHomeworkDeadlineMins, autoRule.homeworkExtendedDeadlineMins) + 15
      );
      const effectiveEnd = Math.max(cfg.endMins, minClose);
      return isActionPastCloseTime(
        cfg.startMins,
        effectiveEnd,
        cfg.earlyGraceMins,
        cfg.deadlineMins,
        'no_fine_zero_stars',
        now
      );
    }
  }
  return isActionPastCloseTime(
    cfg.startMins,
    cfg.endMins,
    cfg.earlyGraceMins,
    cfg.deadlineMins,
    cfg.penaltyPreset,
    now
  );
}

export interface ComputerHomeworkPrereqItem {
  key: 'wash' | 'dry' | 'iron' | 'shower' | 'uniform';
  labelTh: string;
  labelEn: string;
  done: boolean;
}

export interface ComputerHomeworkPrereqStatus {
  ready: boolean;
  items: ComputerHomeworkPrereqItem[];
  missingLabelsTh: string[];
  missingLabelsEn: string[];
}

export function getComputerHomeworkPrereqStatus(kid: Member): ComputerHomeworkPrereqStatus {
  const allDoneByPhone = Boolean(kid.daily.eveningPhoneUnlocked);
  const items: ComputerHomeworkPrereqItem[] = [
    {
      key: 'wash',
      labelTh: 'ซักผ้า',
      labelEn: 'Wash clothes',
      done: Boolean(kid.daily.eveningChecklist?.[0] || allDoneByPhone),
    },
    {
      key: 'dry',
      labelTh: 'ตากผ้า',
      labelEn: 'Hang laundry',
      done: Boolean(kid.daily.choresChecked || allDoneByPhone),
    },
    {
      key: 'iron',
      labelTh: 'รีดผ้า',
      labelEn: 'Iron clothes',
      done: Boolean(kid.daily.eveningChecklist?.[1] || allDoneByPhone),
    },
    {
      key: 'shower',
      labelTh: 'อาบน้ำ',
      labelEn: 'Take a shower',
      done: Boolean(kid.daily.eveningChecklist?.[3] || allDoneByPhone),
    },
    {
      key: 'uniform',
      labelTh: 'ตรวจชุด',
      labelEn: 'Check uniform',
      done: Boolean(kid.daily.eveningChecklist?.[2] || allDoneByPhone),
    },
  ];
  const missing = items.filter((i) => !i.done);
  return {
    ready: missing.length === 0,
    items,
    missingLabelsTh: missing.map((m) => m.labelTh),
    missingLabelsEn: missing.map((m) => m.labelEn),
  };
}

export function isHomeActionDoneForKid(actionId: HomeQuickActionId, kid: Member): boolean {
  switch (actionId) {
    case 'morning_phone_pickup':
      return Boolean(kid.daily.morningPhonePickupChecked);
    case 'morning_breakfast':
      return Boolean(kid.daily.breakfastChecked);
    case 'morning_school':
      return Boolean(kid.daily.vanOrMorningChecked);
    case 'afternoon_home':
      return Boolean(kid.daily.returnedHomeChecked);
    case 'evening_uniform_phone':
      return Boolean(kid.daily.eveningPhoneUnlocked);
    case 'evening_computer_homework':
      return Boolean(kid.daily.computerHomeworkChecked);
    case 'evening_unlock_cartoon':
      return Boolean(kid.daily.bossStageUnlocked);
    case 'night_homework_permission':
      return Boolean(kid.daily.homeworkRegisteredSubject);
    case 'night_return_phone':
      return Boolean(kid.daily.phoneReturnedChecked);
    case 'daily_penalty':
      return false;
  }
}

export function doesKidHavePhone(
  kidId: string,
  settings?: Partial<AppSettings>
): boolean {
  const withoutList = settings?.kidsWithoutPhoneIds;
  if (!Array.isArray(withoutList) || withoutList.length === 0) return true;
  return !withoutList.includes(kidId);
}

export function canKidUseCommand(
  commandId: string,
  kid: Member,
  settings?: Partial<AppSettings>
): boolean {
  if (commandId === 'evening_computer_homework' && kid.group !== 2) {
    return false;
  }
  const rule = settings?.commandPermissions?.[commandId];
  if (!rule) return true;
  const hasPhone = doesKidHavePhone(kid.id, settings);
  if (rule.phoneFilter === 'has_phone' && !hasPhone) return false;
  if (rule.phoneFilter === 'no_phone' && hasPhone) return false;
  if (rule.restrictToKidIds) {
    const allowed = Array.isArray(rule.allowedKidIds) ? rule.allowedKidIds : [];
    return allowed.includes(kid.id);
  }
  return true;
}

export interface AutoReturnPhoneRuleConfig {
  enabled: boolean;
  targetMode: 'match_homework_permission' | 'all_eligible' | 'custom_kids';
  targetKidIds: string[];
  noHomeworkDeadlineMins: number;
  noHomeworkPenaltyPreset: string;
  noHomeworkPenaltyNote: string;
  homeworkExtendedDeadlineMins: number;
  homeworkExtendedPenaltyPreset: string;
  homeworkExtendedPenaltyNote: string;
}

export function getAutoReturnPhoneRuleConfig(
  settings?: Partial<AppSettings>
): AutoReturnPhoneRuleConfig {
  const slot = settings?.timedCommandSchedule?.night_return_phone;
  const noHomeworkDeadlineMins =
    slot &&
    typeof slot.noHomeworkDeadlineMins === 'number' &&
    Number.isFinite(slot.noHomeworkDeadlineMins) &&
    slot.noHomeworkDeadlineMins >= 0 &&
    slot.noHomeworkDeadlineMins < 1440
      ? Math.round(slot.noHomeworkDeadlineMins)
      : DEFAULT_HOMEWORK_CURFEW_MINS;
  const homeworkExtendedDeadlineMins =
    slot &&
    typeof slot.homeworkExtendedDeadlineMins === 'number' &&
    Number.isFinite(slot.homeworkExtendedDeadlineMins) &&
    slot.homeworkExtendedDeadlineMins >= 0 &&
    slot.homeworkExtendedDeadlineMins < 1440
      ? Math.round(slot.homeworkExtendedDeadlineMins)
      : 22 * 60 + 45;
  const noHomeworkPenaltyPreset =
    slot?.noHomeworkPenaltyPreset?.trim() || 'deduct_free_day';
  const noHomeworkPenaltyNote =
    slot?.noHomeworkPenaltyNote !== undefined
      ? slot.noHomeworkPenaltyNote
      : `เลย ${minsToHHMM(noHomeworkDeadlineMins)} น. (ไม่ได้ขอทำการบ้าน) หัก Free Day 1 วัน`;
  const fallbackSlotPenalty =
    slot?.penaltyPreset && slot.penaltyPreset !== 'lock_after_deadline'
      ? slot.penaltyPreset.trim()
      : '';
  const homeworkExtendedPenaltyPreset =
    slot?.homeworkExtendedPenaltyPreset?.trim() || fallbackSlotPenalty || 'deduct_free_day';
  const homeworkExtendedPenaltyNote =
    slot?.homeworkExtendedPenaltyNote !== undefined
      ? slot.homeworkExtendedPenaltyNote
      : `เลย ${minsToHHMM(homeworkExtendedDeadlineMins)} น. (ขอทำการบ้าน) หัก Free Day 1 วัน`;
  const targetMode =
    slot?.noHomeworkTargetMode === 'all_eligible' ||
    slot?.noHomeworkTargetMode === 'custom_kids'
      ? slot.noHomeworkTargetMode
      : 'match_homework_permission';
  return {
    enabled: slot?.autoNoHomeworkRuleEnabled !== false,
    targetMode,
    targetKidIds: Array.isArray(slot?.noHomeworkTargetKidIds)
      ? slot.noHomeworkTargetKidIds
      : [],
    noHomeworkDeadlineMins,
    noHomeworkPenaltyPreset,
    noHomeworkPenaltyNote,
    homeworkExtendedDeadlineMins,
    homeworkExtendedPenaltyPreset,
    homeworkExtendedPenaltyNote,
  };
}

export function isKidInAutoNoHomework21Rule(
  kid: Member,
  settings?: Partial<AppSettings>
): boolean {
  const rule = getAutoReturnPhoneRuleConfig(settings);
  if (!rule.enabled) return false;
  if (rule.targetMode === 'custom_kids') {
    return rule.targetKidIds.includes(kid.id);
  }
  if (rule.targetMode === 'all_eligible') {
    return canKidUseCommand('night_return_phone', kid, settings);
  }
  return canKidUseCommand('night_homework_permission', kid, settings);
}

export interface KidReturnPhoneScheduleEval {
  caseKind: 'homework_registered' | 'no_homework_21_rule' | 'standard_curfew';
  hasRegisteredHomework: boolean;
  isAutoNoHwTarget: boolean;
  deadlineMins: number;
  deadlineTh: string;
  deadlineEn: string;
  penaltyPreset: string;
  penaltyNote: string;
  isPastDeadline: boolean;
  statusBadgeTh: string;
  statusBadgeEn: string;
}

export function evaluateKidReturnPhoneSchedule(
  kid: Member,
  now: Date,
  settings?: Partial<AppSettings>,
  lang: Language = 'th'
): KidReturnPhoneScheduleEval {
  const mins = getMinutesOfDay(now);
  const slot = settings?.timedCommandSchedule?.night_return_phone;
  const cfg = getEffectiveHomeQuickActions(settings, true).find(
    (a) => a.id === 'night_return_phone'
  )!;
  const rule = getAutoReturnPhoneRuleConfig(settings);
  const hasRegisteredHomework = Boolean(kid.daily.homeworkRegisteredSubject);
  const isAutoNoHwTarget = isKidInAutoNoHomework21Rule(kid, settings);

  let caseKind: KidReturnPhoneScheduleEval['caseKind'] = 'standard_curfew';
  let deadlineMins: number;
  let penaltyPreset =
    cfg.penaltyPreset && cfg.penaltyPreset !== 'lock_after_deadline'
      ? cfg.penaltyPreset
      : 'deduct_free_day';
  let penaltyNote = cfg.penaltyNote || 'หัก Free Day 1 วัน';

  if (rule.enabled) {
    if (hasRegisteredHomework) {
      caseKind = 'homework_registered';
      deadlineMins = rule.homeworkExtendedDeadlineMins;
      penaltyPreset = rule.homeworkExtendedPenaltyPreset;
      penaltyNote = rule.homeworkExtendedPenaltyNote;
    } else if (isAutoNoHwTarget) {
      caseKind = 'no_homework_21_rule';
      deadlineMins = rule.noHomeworkDeadlineMins;
      penaltyPreset = rule.noHomeworkPenaltyPreset;
      penaltyNote = rule.noHomeworkPenaltyNote;
    } else {
      caseKind = 'standard_curfew';
      deadlineMins =
        typeof slot?.deadlineMins === 'number'
          ? slot.deadlineMins
          : kid.group === 3
          ? 22 * 60 + 45
          : getEffectiveHomeworkCurfewMins(settings);
      if (kid.group === 3 && !slot?.penaltyPreset) {
        penaltyPreset = 'no_phone_tomorrow';
        penaltyNote = getPenaltySummaryText('no_phone_tomorrow', undefined, lang);
      }
    }
  } else {
    deadlineMins = hasRegisteredHomework
      ? rule.homeworkExtendedDeadlineMins
      : typeof slot?.deadlineMins === 'number'
      ? slot.deadlineMins
      : kid.group === 3
      ? 22 * 60 + 45
      : getEffectiveHomeworkCurfewMins(settings);
    if (hasRegisteredHomework) {
      caseKind = 'homework_registered';
      penaltyPreset = rule.homeworkExtendedPenaltyPreset;
      penaltyNote = rule.homeworkExtendedPenaltyNote;
    } else if (kid.group === 3 && !slot?.penaltyPreset) {
      penaltyPreset = 'no_phone_tomorrow';
      penaltyNote = getPenaltySummaryText('no_phone_tomorrow', undefined, lang);
    }
  }

  const deadlineTh = formatThaiCurfewClock(deadlineMins);
  const deadlineEn = minsToHHMM(deadlineMins);
  const isPastDeadline = mins > deadlineMins;

  let statusBadgeTh = '';
  let statusBadgeEn = '';
  if (caseKind === 'homework_registered') {
    statusBadgeTh = isPastDeadline
      ? `🚨 ขอทำการบ้าน · เลย ${deadlineEn} น. (ลงโทษทันที)`
      : `📝 ขอทำการบ้าน · คืนก่อน ${deadlineEn} น.`;
    statusBadgeEn = isPastDeadline
      ? `🚨 HW Past ${deadlineEn} (Penalty)`
      : `📝 HW By ${deadlineEn}`;
  } else if (caseKind === 'no_homework_21_rule') {
    statusBadgeTh = isPastDeadline
      ? `🚨 ไม่ได้ขอทำการบ้าน · เลย ${deadlineEn} น. (ลงโทษทันที)`
      : `⏰ ไม่ได้ขอทำการบ้าน · คืนก่อน ${deadlineEn} น.`;
    statusBadgeEn = isPastDeadline
      ? `🚨 No HW · Past ${deadlineEn} (Penalty)`
      : `⏰ No HW · Before ${deadlineEn}`;
  } else {
    statusBadgeTh = isPastDeadline
      ? `⚠️ เกิน ${deadlineEn} น.`
      : `🌙 คืนก่อน ${deadlineEn} น.`;
    statusBadgeEn = isPastDeadline ? `⚠️ Past ${deadlineEn}` : `🌙 By ${deadlineEn}`;
  }

  return {
    caseKind,
    hasRegisteredHomework,
    isAutoNoHwTarget,
    deadlineMins,
    deadlineTh,
    deadlineEn,
    penaltyPreset,
    penaltyNote,
    isPastDeadline,
    statusBadgeTh,
    statusBadgeEn,
  };
}

export function getCommandDenialReason(
  commandId: string,
  kid: Member,
  lang: Language,
  settings?: Partial<AppSettings>
): { title: string; subtitle: string; badgeTh: string; badgeEn: string } {
  if (commandId === 'evening_computer_homework' && kid.group !== 2) {
    return {
      badgeTh: '🌟 เฉพาะเด็กโต',
      badgeEn: '🌟 Older Kids Only',
      title:
        lang === 'th'
          ? `ปุ่มขอใช้คอมทำการบ้านเปิดเฉพาะรุ่นเด็กโตค่ะ`
          : `Computer Homework is for Older Kids Only`,
      subtitle:
        lang === 'th'
          ? `น้อง${kid.nickname} อยู่ใน${kid.group === 1 ? 'รุ่นเด็กเล็ก' : 'รุ่นพี่ใหญ่'} จึงไม่สามารถใช้ปุ่มนี้ได้ค่ะ (เฉพาะเด็กโตกลุ่ม 2)`
          : `${kid.nickname} is not in the Older Kids group (Group 2 only).`,
    };
  }
  const rule = settings?.commandPermissions?.[commandId];
  const hasPhone = doesKidHavePhone(kid.id, settings);
  if (rule?.phoneFilter === 'has_phone' && !hasPhone) {
    return {
      badgeTh: '📵 ไม่มีมือถือ',
      badgeEn: '📵 No Phone',
      title:
        lang === 'th'
          ? `น้อง${kid.nickname} ไม่มีมือถือ (ไม่ใช้ปุ่มนี้)`
          : `${kid.nickname} has no phone`,
      subtitle:
        lang === 'th'
          ? 'ปุ่มนี้เปิดเฉพาะเด็กที่มีมือถือค่ะ สามารถปรับรายชื่อได้ที่เมนู 👥 สิทธิ์ & มือถือ'
          : 'This command is enabled for kids with mobile phones only.',
    };
  }
  if (rule?.phoneFilter === 'no_phone' && hasPhone) {
    return {
      badgeTh: '📱 มีมือถือ',
      badgeEn: '📱 Has Phone',
      title:
        lang === 'th'
          ? `น้อง${kid.nickname} มีมือถือ (ปุ่มนี้สำหรับคนไม่มีมือถือ)`
          : `${kid.nickname} has a phone`,
      subtitle:
        lang === 'th'
          ? 'ปุ่มนี้กำหนดไว้เฉพาะเด็กที่ไม่มีมือถือค่ะ'
          : 'This command is set for kids without phones only.',
    };
  }
  return {
    badgeTh: '🚫 ไม่มีสิทธิ์',
    badgeEn: '🚫 Not Eligible',
    title:
      lang === 'th'
        ? `น้อง${kid.nickname} ยังไม่ได้เปิดสิทธิ์กดปุ่มนี้`
        : `${kid.nickname} is not enabled for this button`,
    subtitle:
      lang === 'th'
        ? 'สามารถติ๊กเพิ่มชื่อน้องได้ที่เมนู 👥 สิทธิ์ & มือถือ ค่ะ'
        : 'Enable this child in the Permissions & Phones editor.',
  };
}

export function getCommandAuthMode(
  commandId: string,
  settings?: Partial<AppSettings>
): CommandAuthMode {
  const mode = settings?.commandPermissions?.[commandId]?.authMode;
  if (mode === 'kid_pin' || mode === 'self_tap' || mode === 'staff_pin') {
    return mode;
  }
  const coreDefault = HOME_QUICK_ACTIONS.find((a) => a.id === commandId)?.defaultAuthMode;
  if (coreDefault) return coreDefault;
  return 'staff_pin';
}

export function getCommandAuthModeMeta(
  mode: CommandAuthMode,
  lang: Language
): { icon: string; shortLabel: string; detailLabel: string } {
  if (mode === 'kid_pin') {
    return {
      icon: '🔑',
      shortLabel: lang === 'th' ? 'น้องใส่ PIN เอง' : 'Kid PIN',
      detailLabel:
        lang === 'th'
          ? 'น้องกดเปิดปุ่มเองได้เลย ไม่ต้องรอพี่เลี้ยง · ใส่ PIN 4 หลักของตัวเอง'
          : 'Kids open directly · 4-digit kid PIN required',
    };
  }
  if (mode === 'self_tap') {
    return {
      icon: '👆',
      shortLabel: lang === 'th' ? 'กดชื่อได้เลย' : 'Direct Tap',
      detailLabel:
        lang === 'th'
          ? 'น้องกดชื่อตัวเองได้เลย ไม่ต้องรอพี่เลี้ยงและไม่ต้องใส่รหัส'
          : 'Kids tap their own name directly without a PIN',
    };
  }
  return {
    icon: '🔐',
    shortLabel: lang === 'th' ? 'พี่เลี้ยงใส่ PIN' : 'Staff PIN',
    detailLabel:
      lang === 'th'
        ? 'ต้องให้พี่เลี้ยงใส่รหัส PIN ก่อนจึงแสดงรายชื่อน้อง'
        : 'Staff PIN required before showing kids list',
  };
}

export function getCommandPermissionSummary(
  commandId: string,
  kids: Member[],
  lang: Language,
  settings?: Partial<AppSettings>
): { restricted: boolean; eligibleCount: number; badge: string; authMode: CommandAuthMode } {
  const rule = settings?.commandPermissions?.[commandId];
  const authMode = getCommandAuthMode(commandId, settings);
  const eligibleCount = kids.filter((k) => canKidUseCommand(commandId, k, settings)).length;
  if (!rule || ((rule.phoneFilter ?? 'all') === 'all' && !rule.restrictToKidIds)) {
    if (commandId === 'evening_computer_homework') {
      return {
        restricted: true,
        eligibleCount,
        badge:
          lang === 'th'
            ? `🌟 เฉพาะเด็กโต (${eligibleCount}/${kids.length})`
            : `🌟 Older Kids Only (${eligibleCount}/${kids.length})`,
        authMode,
      };
    }
    return {
      restricted: false,
      eligibleCount: kids.length,
      badge: lang === 'th' ? 'ทุกคน' : 'All',
      authMode,
    };
  }
  if (rule.phoneFilter === 'has_phone' && !rule.restrictToKidIds) {
    return {
      restricted: true,
      eligibleCount,
      badge:
        lang === 'th'
          ? `📱 เฉพาะมีมือถือ (${eligibleCount}/${kids.length})`
          : `📱 Phone Only (${eligibleCount}/${kids.length})`,
      authMode,
    };
  }
  if (rule.phoneFilter === 'no_phone' && !rule.restrictToKidIds) {
    return {
      restricted: true,
      eligibleCount,
      badge:
        lang === 'th'
          ? `📵 เฉพาะไม่มีมือถือ (${eligibleCount}/${kids.length})`
          : `📵 No Phone (${eligibleCount}/${kids.length})`,
      authMode,
    };
  }
  return {
    restricted: true,
    eligibleCount,
    badge:
      lang === 'th'
        ? `🎯 เลือกรายชื่อ (${eligibleCount}/${kids.length})`
        : `🎯 Custom (${eligibleCount}/${kids.length})`,
    authMode,
  };
}

export function evaluateOneTapHomeAction(
  actionId: HomeQuickActionId,
  kid: Member,
  now: Date,
  lang: Language,
  settings?: Partial<AppSettings>,
  isSickToday = false,
  detailOverride?: string
): KioskResult {
  const cfg = getEffectiveHomeQuickActions(settings).find((a) => a.id === actionId)!;
  if (!isHomeActionOpenAt(actionId, now, settings)) {
    return {
      success: false,
      emoji: '🔒',
      starsDelta: 0,
      bannerTitle:
        lang === 'th'
          ? `ปุ่ม "${cfg.titleTh}" ล็อกอยู่นอกเวลา`
          : `"${cfg.titleEn}" is Locked`,
      bannerSubtitle:
        lang === 'th'
          ? `เปิดให้กดเฉพาะช่วงเวลา ${cfg.windowLabelTh} เท่านั้นค่ะ`
          : `Only open during ${cfg.windowLabelEn}.`,
    };
  }

  if (!canKidUseCommand(actionId, kid, settings)) {
    const denied = getCommandDenialReason(actionId, kid, lang, settings);
    return {
      success: false,
      emoji: '🚫',
      starsDelta: 0,
      bannerTitle: denied.title,
      bannerSubtitle: denied.subtitle,
    };
  }

  if (actionId === 'morning_school') {
    return evaluateOneTapGoToSchool(kid, now, lang, settings, isSickToday);
  }

  const mins = getMinutesOfDay(now);
  const todayKey = getDateKey(now);
  const eco = getEconomyConfig(settings);
  const earlyBonus = eco.early15MinBonusStars;
  const isAwayToday = isKidAwayOnDate(kid, todayKey);

  const appendStarTx = (prev: Member, amount: number, reason: string, patch: Partial<Member>): Member => ({
    ...prev,
    ...patch,
    stars: Math.max(0, prev.stars + amount),
    starHistory: [
      {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: now.toISOString(),
        reason,
        amount,
      },
      ...prev.starHistory,
    ].slice(0, 60),
  });

  if (cfg.commandType === 'penalty' || actionId === 'daily_penalty') {
    const preset = cfg.penaltyPreset || 'deduct_free_day';
    const noteLabel = getPenaltySummaryText(preset, cfg.penaltyNote, lang);
    const tomorrow = getTomorrowDateKey(now);
    let penaltyPatch = { ...kid.penalty };
    let starsDelta = 0;
    let fineThb = 0;

    if (preset === 'deduct_free_day') {
      penaltyPatch = {
        ...penaltyPatch,
        fridayFreeDayDeductedCount: penaltyPatch.fridayFreeDayDeductedCount + 1,
      };
    } else if (preset === 'deduct_stars') {
      starsDelta = -5;
    } else if (preset === 'fixed_fine_thb') {
      fineThb = 20;
      penaltyPatch = { ...penaltyPatch, lateFineThb: penaltyPatch.lateFineThb + fineThb };
    } else if (preset === 'per_minute_fine_thb') {
      fineThb = 25;
      penaltyPatch = { ...penaltyPatch, lateFineThb: penaltyPatch.lateFineThb + fineThb };
    } else if (preset === 'no_phone_today_1830') {
      penaltyPatch = { ...penaltyPatch, phoneConfiscatedUntil1830Date: todayKey };
    } else if (preset === 'no_phone_tomorrow') {
      penaltyPatch = { ...penaltyPatch, noEveningPhoneTomorrowDate: tomorrow };
    }

    const updated = appendStarTx(
      kid,
      starsDelta,
      `${cfg.emoji} ${cfg.titleTh}: ${noteLabel}${detailOverride?.trim() ? ` (${detailOverride.trim()})` : ''}`,
      { penalty: penaltyPatch }
    );
    return {
      success: true,
      emoji: cfg.emoji || '⚖️',
      starsDelta,
      fineThb: fineThb > 0 ? fineThb : undefined,
      fineReason: noteLabel,
      penaltyAlert: {
        kidNickname: kid.nickname,
        kidEmoji: kid.emoji,
        headline:
          lang === 'th' ? `บันทึกบทลงโทษ: ${cfg.titleTh}` : `Penalty Recorded: ${cfg.titleEn}`,
        reasonLine:
          detailOverride?.trim() ||
          (lang === 'th' ? 'พี่เลี้ยงบันทึกบทลงโทษประจำวันให้เรียบร้อยแล้วค่ะ' : 'Penalty recorded by staff.'),
        penaltyText: noteLabel,
        clockNote:
          lang === 'th'
            ? `บันทึกเวลา ${minsToHHMM(mins)} น.`
            : `Recorded at ${minsToHHMM(mins)}`,
      },
      bannerTitle:
        lang === 'th'
          ? `บันทึกบทลงโทษ น้อง${kid.nickname} แล้ว`
          : `Penalty Recorded for ${kid.nickname}`,
      bannerSubtitle: `${noteLabel}${detailOverride?.trim() ? ` · ${detailOverride.trim()}` : ''}`,
      updatedKid: updated,
    };
  }

  if (actionId === 'morning_phone_pickup') {
    if (kid.daily.morningPhonePickupChecked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} มาขอรับมือถือเช้านี้แล้ว`
            : `${kid.nickname} Phone Already Collected`,
        bannerSubtitle:
          lang === 'th'
            ? 'บันทึกการขอรับมือถือรอบเช้าเรียบร้อยแล้วค่ะ'
            : 'Already collected phone this morning.',
      };
    }

    if (!kid.penalty.phonePrivilegeActive) {
      return {
        success: false,
        emoji: '📵',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ถูกระงับสิทธิ์ใช้มือถือชั่วคราว`
            : `${kid.nickname} Phone Privilege Suspended`,
        bannerSubtitle:
          lang === 'th'
            ? 'หากต้องการเปิดสิทธิ์คืน ให้พี่เลี้ยงกด "เคลียร์โทษ" ในหน้าพี่เลี้ยงก่อนนะคะ'
            : 'Ask staff to clear penalties in Staff View first.',
      };
    }

    if (kid.penalty.noEveningPhoneTomorrowDate === todayKey) {
      return {
        success: false,
        emoji: '📵',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ติดโทษงดใช้มือถือวันนี้`
            : `${kid.nickname} Phone Suspended Today`,
        bannerSubtitle:
          lang === 'th'
            ? 'ติดโทษคืนมือถือเกินเวลาเมื่อคืน วันนี้จึงงดรับมือถือ 1 วันค่ะ'
            : 'Phone use is suspended today due to late return.',
      };
    }

    if (kid.penalty.phoneConfiscatedUntil1830Date === todayKey && mins < 18 * 60 + 30) {
      return {
        success: false,
        emoji: '⏳📵',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ติดโทษยึดมือถือถึง 18:30 น.`
            : `${kid.nickname} Phone Held Until 18:30`,
        bannerSubtitle:
          lang === 'th'
            ? 'ไม่สามารถรับมือถือรอบเช้าได้ รอรับหลัง 18:30 น. นะคะ'
            : 'Phone is held until 18:30 today.',
      };
    }

    const pickupStars = Math.max(0, Math.round(cfg.rewardStars ?? 5));
    const updated = appendStarTx(
      kid,
      pickupStars,
      `📱 ปุ่มด่วน "${cfg.titleTh}" (${cfg.windowLabelTh})${pickupStars > 0 ? ` +${pickupStars} ⭐` : ''}`,
      {
        daily: { ...kid.daily, morningPhonePickupChecked: true },
      }
    );
    return {
      success: true,
      emoji: '📱✨',
      starsDelta: pickupStars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ${cfg.titleTh}เรียบร้อยแล้ว!${pickupStars > 0 ? ` +${pickupStars} ⭐` : ''}`
          : `${kid.nickname} Morning Phone Pickup Confirmed!${pickupStars > 0 ? ` +${pickupStars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? `บันทึกขอรับมือถือรอบเช้า (${cfg.windowLabelTh}) เรียบร้อยค่ะ`
          : `Morning phone pickup (${cfg.windowLabelEn}) recorded.`,
      updatedKid: updated,
    };
  }

  if (actionId === 'morning_breakfast') {
    if (kid.daily.breakfastChecked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} เช็คกินข้าวเช้าแล้ว` : `${kid.nickname} Breakfast OK`,
        bannerSubtitle: lang === 'th' ? 'เช็คชื่อมื้อเช้าเรียบร้อยแล้วค่ะ' : 'Already checked breakfast today.',
      };
    }
    const onTime = mins <= (cfg.deadlineMins ?? 6 * 60 + 40);
    const streakUpdate = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const baseStars = Math.max(0, Math.round(cfg.rewardStars ?? 5));
    const stars = (onTime ? baseStars : 0) + (streakUpdate?.milestoneBonusStars ?? 0);
    const updated = appendStarTx(
      kid,
      stars,
      onTime
        ? `🍚 ปุ่มด่วน "${cfg.titleTh}" (≤${minsToHHMM(cfg.deadlineMins)} น. +${stars} ⭐)`
        : `🍚 ปุ่มด่วน "${cfg.titleTh}" (หลัง ${minsToHHMM(cfg.deadlineMins)} น.)`,
      {
        avatar: { ...kid.avatar, outfitMode: 'uniform' },
        streak: streakUpdate ? streakUpdate.nextStreak : kid.streak,
        daily: { ...kid.daily, breakfastChecked: true },
      }
    );
    return {
      success: true,
      emoji: '🍚✨',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} กินข้าวเช้าแล้ว! ${stars > 0 ? `+${stars} ⭐` : ''}`
          : `${kid.nickname} Ate Breakfast! ${stars > 0 ? `+${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? streakUpdate?.streakTextTh ?? 'บันทึกมื้อเช้าและเปลี่ยนชุดนักเรียนเรียบร้อยค่ะ'
          : 'Breakfast recorded & uniform equipped.',
      updatedKid: updated,
    };
  }

  if (actionId === 'afternoon_home') {
    if (kid.daily.returnedHomeChecked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle: lang === 'th' ? `น้อง${kid.nickname} เช็คกลับบ้านวันนี้แล้ว` : `${kid.nickname} Already Home`,
        bannerSubtitle: lang === 'th' ? 'เช็คอินกลับบ้านเรียบร้อยแล้วค่ะ' : 'Already checked return home.',
      };
    }
    const onTimeHome = mins <= (cfg.deadlineMins ?? 17 * 60);
    const baseHomeStars = Math.max(0, Math.round(cfg.rewardStars ?? 5));
    const hasCustomStars = settings?.timedCommandSchedule?.[actionId]?.rewardStars !== undefined;
    const stars = !onTimeHome
      ? 0
      : hasCustomStars
      ? baseHomeStars
      : kid.group === 3
      ? Math.max(20, baseHomeStars)
      : baseHomeStars;
    const isEarly15 = stars > 0 && mins <= 15 * 60 + 45 && earlyBonus > 0 ? 0 : 0;
    const totalStars = stars + isEarly15;
    const updated = appendStarTx(
      kid,
      totalStars,
      `🏡 ปุ่มด่วน "${cfg.titleTh}"${totalStars > 0 ? ` (+${totalStars} ⭐)` : ' (เริ่ม Speedy Ninja 20 นาที)'}`,
      {
        avatar: { ...kid.avatar, outfitMode: 'lounge' },
        daily: {
          ...kid.daily,
          returnedHomeChecked: true,
          ...(kid.group === 1 ? { speedyNinjaStartMs: now.getTime() } : {}),
        },
      }
    );
    return {
      success: true,
      emoji: kid.group === 1 ? '🥷🏡' : '🏡✨',
      starsDelta: totalStars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} กลับบ้านแล้ว! ${totalStars > 0 ? `+${totalStars} ⭐` : ''}`
          : `${kid.nickname} Back Home! ${totalStars > 0 ? `+${totalStars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? kid.group === 1
            ? 'เปลี่ยนเป็นชุดอยู่บ้านและเริ่มภารกิจ Speedy Ninja 20 นาที!'
            : 'เปลี่ยนเป็นชุดอยู่บ้านเรียบร้อย เตรียมซักชุดนักเรียนตามคิวได้เลยค่ะ'
          : 'Returned home & changed into lounge wear.',
      updatedKid: updated,
    };
  }

  if (actionId === 'evening_uniform_phone') {
    if (kid.daily.eveningPhoneUnlocked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ตรวจชุด & รับมือถือวันนี้แล้ว`
            : `${kid.nickname} Already Checked Uniform & Phone`,
        bannerSubtitle: lang === 'th' ? 'เรียบร้อยแล้วค่ะ' : 'Already completed today.',
      };
    }

    if (kid.penalty.noEveningPhoneTomorrowDate === todayKey) {
      const updated = {
        ...kid,
        daily: {
          ...kid.daily,
          eveningChecklist: [
            kid.daily.eveningChecklist[0],
            kid.daily.eveningChecklist[1],
            true,
            kid.daily.eveningChecklist[3],
          ] as [boolean, boolean, boolean, boolean],
        },
      };
      return {
        success: false,
        emoji: '📵',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ตรวจชุดแล้ว (แต่งดรับมือถือวันนี้)`
            : `${kid.nickname} Uniform Checked (Phone Suspended Today)`,
        bannerSubtitle:
          lang === 'th'
            ? 'ติดโทษคืนมือถือเกินเวลาเมื่อคืน วันนี้งดรับมือถือรอบเย็น 1 วันค่ะ'
            : 'Suspended from evening phone today due to late return.',
        updatedKid: updated,
      };
    }

    if (kid.penalty.phoneConfiscatedUntil1830Date === todayKey && mins < 18 * 60 + 30) {
      const updated = {
        ...kid,
        daily: {
          ...kid.daily,
          eveningChecklist: [
            kid.daily.eveningChecklist[0],
            kid.daily.eveningChecklist[1],
            true,
            kid.daily.eveningChecklist[3],
          ] as [boolean, boolean, boolean, boolean],
        },
      };
      return {
        success: false,
        emoji: '⏳📵',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ตรวจชุดแล้ว (มือถือรับได้หลัง 18:30 น.)`
            : `${kid.nickname} Uniform Checked (Phone Held Until 18:30)`,
        bannerSubtitle:
          lang === 'th'
            ? 'ติดโทษยึดมือถือถึง 18:30 น. หลัง 18:30 น. ค่อยกดรับอีกครั้งนะคะ'
            : 'Phone is held until 18:30 today.',
        updatedKid: updated,
      };
    }

    const onTimeUniform = mins <= (cfg.deadlineMins ?? 19 * 60 + 30);
    const stars = onTimeUniform ? Math.max(0, Math.round(cfg.rewardStars ?? 10)) : 0;
    const updated = appendStarTx(
      kid,
      stars,
      `👕 ปุ่มด่วน "${cfg.titleTh}"${stars > 0 ? ` (+${stars} ⭐)` : ' (หลังเส้นตาย 0 ⭐)'}`,
      {
        daily: {
          ...kid.daily,
          choresChecked: true,
          eveningChecklist: [true, true, true, true],
          eveningPhoneUnlocked: true,
        },
      }
    );
    return {
      success: true,
      emoji: '👔📱✨',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ตรวจชุด & รับมือถือสำเร็จ! +${stars} ⭐`
          : `${kid.nickname} Uniform OK & Phone Released! +${stars} ⭐`,
      bannerSubtitle:
        lang === 'th'
          ? 'ตรวจชุดนักเรียนเรียบร้อย และบันทึกขอรับโทรศัพท์มือถือรอบค่ำแล้วค่ะ'
          : 'Uniform checked and evening phone released!',
      updatedKid: updated,
    };
  }

  if (actionId === 'evening_computer_homework') {
    if (kid.group !== 2) {
      return {
        success: false,
        emoji: '🌟',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `ปุ่มขอใช้คอมทำการบ้านเปิดเฉพาะรุ่นเด็กโตค่ะ`
            : `Computer Homework is for Older Kids Only`,
        bannerSubtitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ไม่ได้อยู่ในรุ่นเด็กโต (กลุ่ม 2) จึงไม่สามารถกดคำสั่งนี้ได้ค่ะ`
            : `${kid.nickname} is not in Group 2 (Older Kids).`,
      };
    }

    if (kid.daily.computerHomeworkChecked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ขออนุญาตใช้คอมทำการบ้านวันนี้แล้ว`
            : `${kid.nickname} Computer Homework Already Approved`,
        bannerSubtitle:
          lang === 'th' ? 'บันทึกสิทธิ์ใช้คอมทำการบ้านเรียบร้อยแล้วค่ะ' : 'Already approved today.',
      };
    }

    const prereq = getComputerHomeworkPrereqStatus(kid);
    if (!prereq.ready) {
      return {
        success: false,
        emoji: '🧺⏳',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ยังทำเงื่อนไขก่อนใช้คอมไม่ครบค่ะ`
            : `${kid.nickname}: Checklist Incomplete`,
        bannerSubtitle:
          lang === 'th'
            ? `ยังขาด: ${prereq.missingLabelsTh.join(' · ')} (ต้องซักผ้า/ตากผ้า/รีดผ้า/อาบน้ำ/ตรวจชุด ให้เรียบร้อยก่อนนะคะ)`
            : `Missing: ${prereq.missingLabelsEn.join(', ')} (wash, hang dry, iron, shower & uniform check required).`,
      };
    }

    const onTimeComputer = mins <= (cfg.deadlineMins ?? 20 * 60);
    const stars = onTimeComputer ? Math.max(0, Math.round(cfg.rewardStars ?? 10)) : 0;
    const updated = appendStarTx(
      kid,
      stars,
      `💻 ปุ่มด่วน "${cfg.titleTh}" (ซัก/ตาก/รีด/อาบน้ำ/ตรวจชุดครบ${stars > 0 ? ` +${stars} ⭐` : ''})`,
      {
        daily: {
          ...kid.daily,
          computerHomeworkChecked: true,
          computerHomeworkAt: now.toISOString(),
        },
      }
    );
    return {
      success: true,
      emoji: '💻✨',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ขออนุญาตใช้คอมทำการบ้านสำเร็จ!${stars > 0 ? ` +${stars} ⭐` : ''}`
          : `${kid.nickname} Computer for Homework Approved!${stars > 0 ? ` +${stars} ⭐` : ''}`,
      bannerSubtitle:
        lang === 'th'
          ? 'ซักผ้า ตากผ้า รีดผ้า อาบน้ำ และตรวจชุดเรียบร้อย อนุญาตใช้คอมทำการบ้านได้ค่ะ'
          : 'All 5 requirements completed — approved to use computer for homework!',
      updatedKid: updated,
    };
  }

  if (actionId === 'evening_unlock_cartoon') {
    if (kid.daily.bossStageUnlocked) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ปลดล็อคดูการ์ตูนวันนี้แล้ว`
            : `${kid.nickname} Cartoons Already Unlocked`,
        bannerSubtitle:
          lang === 'th'
            ? 'ดูการ์ตูนได้ถึง 20:40 น. แล้วดื่มน้ำก่อนเข้านอน 21:00 น. นะคะ'
            : 'Watch until 20:40, drink water, and bedtime at 21:00.',
      };
    }

    if (!kid.penalty.cartoonPrivilegeActive) {
      return {
        success: false,
        emoji: '🚫📺',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ถูกระงับสิทธิ์ดูการ์ตูนชั่วคราว`
            : `${kid.nickname} Cartoon Privilege Suspended`,
        bannerSubtitle:
          lang === 'th'
            ? 'หากต้องการเปิดสิทธิ์คืน ให้พี่เลี้ยงกด "เคลียร์โทษ" ในหน้าพี่เลี้ยงก่อนนะคะ'
            : 'Ask staff to clear penalties in Staff View first.',
      };
    }

    const onTimeCartoon = mins <= (cfg.deadlineMins ?? 20 * 60 + 40);
    const stars = onTimeCartoon ? Math.max(0, Math.round(cfg.rewardStars ?? 10)) : 0;
    const updated = appendStarTx(
      kid,
      stars,
      `📺 ปุ่มด่วน "${cfg.titleTh}" (ด่านบอส 20:00 น.${stars > 0 ? ` +${stars} ⭐` : ''})`,
      {
        daily: {
          ...kid.daily,
          bossStageUnlocked: true,
        },
      }
    );
    return {
      success: true,
      emoji: '📺🎉',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ปลดล็อคดูการ์ตูนสำเร็จ! +${stars} ⭐`
          : `${kid.nickname} Cartoons Unlocked! +${stars} ⭐`,
      bannerSubtitle:
        lang === 'th'
          ? 'ดูการ์ตูนได้ถึง 20:40 น. แล้วอย่าลืมดื่มน้ำและเข้านอน 21:00 น. นะคะ'
          : 'Watch until 20:40, drink water, and bedtime at 21:00!',
      updatedKid: updated,
    };
  }

  if (actionId === 'night_homework_permission') {
    const autoRule = getAutoReturnPhoneRuleConfig(settings);
    const curfewMins = autoRule.homeworkExtendedDeadlineMins;
    const curfewTh = formatThaiCurfewClock(curfewMins);
    const curfewEn = minsToHHMM(curfewMins);
    const hwLateSummary = getPenaltySummaryText(
      autoRule.homeworkExtendedPenaltyPreset,
      autoRule.homeworkExtendedPenaltyNote,
      lang
    );
    if (kid.daily.homeworkRegisteredSubject && !detailOverride?.trim()) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ขออนุญาตทำการบ้านวันนี้แล้ว`
            : `${kid.nickname} Homework Already Permitted`,
        bannerSubtitle:
          lang === 'th'
            ? `บันทึกขออนุญาตไว้เรียบร้อยแล้วค่ะ (ใช้เพิ่มได้ถึง ${curfewTh} · เกินเวลาลงโทษทันที: ${hwLateSummary})`
            : `Already registered today (until ${curfewEn}).`,
      };
    }
    const cleanChoice = (detailOverride ?? '').trim().slice(0, 100) || 'ทำการบ้าน';
    const updated = appendStarTx(
      kid,
      0,
      `📝 ปุ่มด่วนหน้าแรก "ขออนุญาตทำการบ้าน": ${cleanChoice}`,
      {
        daily: {
          ...kid.daily,
          homeworkRegisteredSubject: cleanChoice,
        },
      }
    );
    return {
      success: true,
      emoji: '📝✨',
      starsDelta: 0,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ขออนุญาต "${cleanChoice}" สำเร็จ!`
          : `${kid.nickname}: "${cleanChoice}" Approved!`,
      bannerSubtitle:
        lang === 'th'
          ? `ใช้เพิ่มได้จนถึงเวลา ${curfewTh} · หากคืนหลัง ${curfewTh} จะถูกลงโทษทันที (${hwLateSummary})`
          : `Extended until ${curfewEn} (returning past ${curfewEn} triggers penalty: ${hwLateSummary}).`,
      updatedKid: updated,
    };
  }

  // 'night_return_phone' (single smart button with automatic per-kid deadline calculation)
  if (kid.daily.phoneReturnedChecked) {
    return {
      success: true,
      emoji: '✅',
      starsDelta: 0,
      bannerTitle: lang === 'th' ? `น้อง${kid.nickname} คืนมือถือวันนี้แล้ว` : `${kid.nickname} Phone Returned`,
      bannerSubtitle: lang === 'th' ? 'คืนเข้าตู้พี่เลี้ยงเรียบร้อยแล้วค่ะ ฝันดีนะ' : 'Already returned today.',
    };
  }

  const returnEval = evaluateKidReturnPhoneSchedule(kid, now, settings, lang);
  const {
    caseKind,
    deadlineMins,
    deadlineTh: curfewTh,
    deadlineEn: curfewEn,
    penaltyPreset: preset,
    penaltyNote: rawPenaltyNote,
  } = returnEval;
  const onTime = mins <= deadlineMins;

  if (onTime) {
    const stars = Math.max(0, Math.round(cfg.rewardStars ?? 5));
    const onTimeDetail =
      caseKind === 'homework_registered'
        ? 'ขออนุญาตทำการบ้าน · คืนตรงเวลา'
        : caseKind === 'no_homework_21_rule'
        ? 'ไม่ได้ขอทำการบ้าน · คืนทันก่อน ' + curfewEn + ' น.'
        : 'คืนตรงเวลา';
    const updated = appendStarTx(
      kid,
      stars,
      `${cfg.emoji} ปุ่มด่วน "${cfg.titleTh}" (${onTimeDetail} ≤${curfewEn} น. +${stars} ⭐)`,
      {
        daily: { ...kid.daily, phoneReturnedChecked: true },
      }
    );
    return {
      success: true,
      emoji: '🌙📱💚',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} คืนมือถือเรียบร้อย! +${stars} ⭐`
          : `${kid.nickname} Phone Returned! +${stars} ⭐`,
      bannerSubtitle:
        lang === 'th'
          ? caseKind === 'homework_registered'
            ? `ขอทำการบ้านไว้ · ส่งคืนทันภายใน ${curfewTh} ฝันดีนะคะ!`
            : caseKind === 'no_homework_21_rule'
            ? `ไม่ได้ขอทำการบ้าน · คืนทันก่อน ${curfewTh} ฝันดีนะคะ!`
            : `ส่งคืนมือถือเข้าตู้พี่เลี้ยงตรงเวลาภายใน ${curfewTh} ฝันดีนะคะ!`
          : `Returned phone on time (before ${curfewEn}). Good night!`,
      updatedKid: updated,
    };
  }

  const tomorrow = getTomorrowDateKey(now);
  const penaltySummary = getPenaltySummaryText(preset, rawPenaltyNote, lang);
  let latePenaltyPatch = { ...kid.penalty };
  let lateStarsDelta = 0;
  let lateFineThb = 0;

  if (!isSickToday && !isAwayToday) {
    if (preset === 'deduct_free_day') {
      latePenaltyPatch = {
        ...latePenaltyPatch,
        fridayFreeDayDeductedCount: latePenaltyPatch.fridayFreeDayDeductedCount + 1,
      };
    } else if (preset === 'deduct_stars') {
      lateStarsDelta = -5;
    } else if (preset === 'fixed_fine_thb') {
      lateFineThb = 20;
      latePenaltyPatch = { ...latePenaltyPatch, lateFineThb: latePenaltyPatch.lateFineThb + lateFineThb };
    } else if (preset === 'per_minute_fine_thb') {
      const lateMins = Math.max(1, mins - deadlineMins);
      lateFineThb = Math.min(50, lateMins * 5);
      latePenaltyPatch = { ...latePenaltyPatch, lateFineThb: latePenaltyPatch.lateFineThb + lateFineThb };
    } else if (preset === 'no_phone_today_1830') {
      latePenaltyPatch = { ...latePenaltyPatch, phoneConfiscatedUntil1830Date: todayKey };
    } else if (preset === 'no_phone_tomorrow') {
      latePenaltyPatch = { ...latePenaltyPatch, noEveningPhoneTomorrowDate: tomorrow };
    }
  }

  const lateReasonText =
    isSickToday || isAwayToday
      ? 'ยกเว้นโทษป่วย/ลาพัก'
      : caseKind === 'homework_registered'
      ? `ขอทำการบ้านไว้ & คืนเกิน ${curfewEn} น. (${penaltySummary})`
      : caseKind === 'no_homework_21_rule'
      ? `ไม่ได้ขอทำการบ้าน & คืนเกิน ${curfewEn} น. (${penaltySummary})`
      : `เกิน ${curfewEn} น. (${penaltySummary})`;

  const updated = appendStarTx(
    kid,
    lateStarsDelta,
    `${cfg.emoji} ${cfg.titleTh}: ${lateReasonText}`,
    {
      penalty: latePenaltyPatch,
      daily: { ...kid.daily, phoneReturnedChecked: true },
    }
  );
  const minsLateReturn = Math.max(1, mins - deadlineMins);
  const latePenaltyAlert: KioskPenaltyAlert | undefined =
    isSickToday || isAwayToday
      ? undefined
      : {
          kidNickname: kid.nickname,
          kidEmoji: kid.emoji,
          headline:
            lang === 'th'
              ? 'เลยกำหนดเวลาคืนมือถือแล้ว!'
              : 'Past Phone Return Deadline!',
          reasonLine:
            lang === 'th'
              ? caseKind === 'homework_registered'
                ? `ขออนุญาตทำการบ้านไว้ → กำหนดคืนไม่เกิน ${curfewEn} น. (เกินเวลามา ${minsLateReturn} นาที)`
                : caseKind === 'no_homework_21_rule'
                ? `ไม่ได้กดขออนุญาตทำการบ้านก่อนเวลา → เล่นได้ถึง ${curfewEn} น. (เกินเวลามา ${minsLateReturn} นาที)`
                : `กำหนดคืนมือถือไม่เกิน ${curfewEn} น. (เกินเวลามา ${minsLateReturn} นาที)`
              : caseKind === 'homework_registered'
              ? `Homework extended until ${curfewEn} (${minsLateReturn} min overdue)`
              : caseKind === 'no_homework_21_rule'
              ? `No homework permission registered — limit ${curfewEn} (${minsLateReturn} min overdue)`
              : `Return phone deadline ${curfewEn} (${minsLateReturn} min overdue)`,
          penaltyText: penaltySummary,
          clockNote:
            lang === 'th'
              ? `กดคืนมือถือเวลา ${minsToHHMM(mins)} น.`
              : `Returned at ${minsToHHMM(mins)}`,
        };

  return {
    success: true,
    emoji: isSickToday || isAwayToday ? '💚📱' : '⚖️📵',
    starsDelta: lateStarsDelta,
    fineThb: lateFineThb > 0 ? lateFineThb : undefined,
    fineReason: isSickToday || isAwayToday ? undefined : lateReasonText,
    penaltyAlert: latePenaltyAlert,
    bannerTitle:
      isSickToday || isAwayToday
        ? lang === 'th'
          ? `น้อง${kid.nickname} คืนมือถือแล้ว (ยกเว้นโทษป่วย/ลาพัก)`
          : `${kid.nickname} Phone Returned (Waived)`
        : caseKind === 'no_homework_21_rule' || caseKind === 'homework_registered'
        ? lang === 'th'
          ? `น้อง${kid.nickname} คืนมือถือหลัง ${curfewTh} (ลงโทษทันที)`
          : `${kid.nickname} Returned Past ${curfewEn} (Penalized)`
        : lang === 'th'
        ? `น้อง${kid.nickname} คืนมือถือเกิน ${curfewTh}`
        : `${kid.nickname} Returned Past ${curfewEn}`,
    bannerSubtitle:
      isSickToday || isAwayToday
        ? lang === 'th'
          ? `บันทึกคืนมือถือเรียบร้อย (วันหยุด/ป่วยไม่หักสิทธิ์, พรุ่งนี้ ${tomorrow})`
          : 'Recorded without penalty.'
        : caseKind === 'homework_registered'
        ? lang === 'th'
          ? `ขออนุญาตทำการบ้านถึง ${curfewTh} → คืนเกินเวลา บันทึกคืนมือถือและลงโทษทันที (${penaltySummary})`
          : `Homework extended to ${curfewEn} → returned late and penalized (${penaltySummary}).`
        : caseKind === 'no_homework_21_rule'
        ? lang === 'th'
          ? `ไม่ได้กดขอทำการบ้านตามเวลา → เกิน ${curfewTh} บันทึกคืนมือถือและลงโทษทันที (${penaltySummary})`
          : `No homework registered → past ${curfewEn}, returned and penalized (${penaltySummary}).`
        : lang === 'th'
        ? `บันทึกคืนมือถือแล้ว · เลย ${curfewTh} (${penaltySummary})`
        : `Phone return recorded · Past ${curfewEn} (${penaltySummary})`,
    updatedKid: updated,
  };
}

export const DEFAULT_EXTRA_QUICK_COMMANDS: CustomQuickCommand[] = [];

export function getEffectiveCustomQuickCommands(
  settings?: Partial<AppSettings>
): CustomQuickCommand[] {
  if (Array.isArray(settings?.customQuickCommands)) {
    return [...settings.customQuickCommands].sort(compareLoginCommandsByTime);
  }
  return DEFAULT_EXTRA_QUICK_COMMANDS;
}

export function isCustomCommandOpenAt(cmd: CustomQuickCommand, now: Date): boolean {
  if (cmd.enabled === false) return false;
  if (cmd.alwaysOpen) return true;
  if (typeof cmd.startMins !== 'number' || typeof cmd.endMins !== 'number') return true;
  return isActionWithinTimeWindow(
    cmd.startMins,
    cmd.endMins,
    cmd.earlyGraceMins ?? 0,
    cmd.deadlineMins,
    cmd.penaltyPreset,
    now
  );
}

export function isCustomCommandExpiredAt(cmd: CustomQuickCommand, now: Date): boolean {
  if (cmd.enabled === false) return true;
  if (cmd.alwaysOpen) return false;
  if (typeof cmd.startMins !== 'number' || typeof cmd.endMins !== 'number') return false;
  return isActionPastCloseTime(
    cmd.startMins,
    cmd.endMins,
    cmd.earlyGraceMins ?? 0,
    cmd.deadlineMins,
    cmd.penaltyPreset,
    now
  );
}

function fmtMinsClock(totalMins: number): string {
  const safe = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = String(Math.floor(safe / 60)).padStart(2, '0');
  const m = String(safe % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatCustomCommandWindow(cmd: CustomQuickCommand, lang: Language): string {
  if (cmd.alwaysOpen) {
    return lang === 'th' ? 'เปิดกดได้ตลอดเวลา (ตอนรีบ/ด่วน)' : 'Open Anytime (Quick Mode)';
  }
  const s = fmtMinsClock(cmd.startMins ?? 0);
  const e = fmtMinsClock(cmd.endMins ?? 23 * 60 + 59);
  return lang === 'th' ? `${s}–${e} น.` : `${s}–${e}`;
}

export function isCustomCommandDoneForKid(
  cmd: CustomQuickCommand,
  kid: Member,
  now: Date
): boolean {
  if (cmd.kind === 'penalty') {
    return false;
  }
  if (cmd.kind === 'homework_permission') {
    return Boolean(kid.daily.homeworkRegisteredSubject);
  }
  const todayKey = getDateKey(now);
  const marker = `[cmd:${cmd.id}]`;
  return (kid.starHistory ?? []).some(
    (tx) => tx.timestamp.slice(0, 10) === todayKey && tx.reason.includes(marker)
  );
}

export function evaluateOneTapCustomCommand(
  cmd: CustomQuickCommand,
  kid: Member,
  now: Date,
  lang: Language,
  subjectOrNoteOverride?: string,
  settings?: Partial<AppSettings>
): KioskResult {
  if (!isCustomCommandOpenAt(cmd, now)) {
    return {
      success: false,
      emoji: '🔒',
      starsDelta: 0,
      bannerTitle:
        lang === 'th'
          ? `คำสั่ง "${cmd.titleTh}" ล็อกอยู่นอกเวลา`
          : `"${cmd.titleEn}" is Locked`,
      bannerSubtitle:
        lang === 'th'
          ? `เปิดให้กดช่วงเวลา ${formatCustomCommandWindow(cmd, lang)} ค่ะ`
          : `Open during ${formatCustomCommandWindow(cmd, lang)}.`,
    };
  }

  if (!canKidUseCommand(cmd.id, kid, settings)) {
    const denied = getCommandDenialReason(cmd.id, kid, lang, settings);
    return {
      success: false,
      emoji: '🚫',
      starsDelta: 0,
      bannerTitle: denied.title,
      bannerSubtitle: denied.subtitle,
    };
  }

  const noteText = (subjectOrNoteOverride ?? cmd.defaultNote ?? '').trim().slice(0, 100);
  const stars = Math.max(0, Math.min(50, Math.round(Number(cmd.starsDelta ?? 0))));

  if (cmd.kind === 'penalty') {
    const preset = cmd.penaltyPreset || 'deduct_free_day';
    const noteLabel = getPenaltySummaryText(preset, cmd.penaltyNote, lang);
    const todayKey = getDateKey(now);
    const tomorrow = getTomorrowDateKey(now);
    let penaltyPatch = { ...kid.penalty };
    let penaltyStarsDelta = 0;
    let fineThb = 0;
    if (preset === 'deduct_free_day') {
      penaltyPatch = {
        ...penaltyPatch,
        fridayFreeDayDeductedCount: penaltyPatch.fridayFreeDayDeductedCount + 1,
      };
    } else if (preset === 'deduct_stars') {
      penaltyStarsDelta = -5;
    } else if (preset === 'fixed_fine_thb') {
      fineThb = 20;
      penaltyPatch = { ...penaltyPatch, lateFineThb: penaltyPatch.lateFineThb + fineThb };
    } else if (preset === 'per_minute_fine_thb') {
      fineThb = 25;
      penaltyPatch = { ...penaltyPatch, lateFineThb: penaltyPatch.lateFineThb + fineThb };
    } else if (preset === 'no_phone_today_1830') {
      penaltyPatch = { ...penaltyPatch, phoneConfiscatedUntil1830Date: todayKey };
    } else if (preset === 'no_phone_tomorrow') {
      penaltyPatch = { ...penaltyPatch, noEveningPhoneTomorrowDate: tomorrow };
    }
    const updated: Member = {
      ...kid,
      stars: Math.max(0, kid.stars + penaltyStarsDelta),
      penalty: penaltyPatch,
      starHistory: [
        {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: now.toISOString(),
          reason: `${cmd.emoji} บทลงโทษ "${cmd.titleTh}": ${noteLabel}${noteText ? ` (${noteText})` : ''} [cmd:${cmd.id}]`,
          amount: penaltyStarsDelta,
        },
        ...(kid.starHistory ?? []),
      ].slice(0, 60),
    };
    return {
      success: true,
      emoji: cmd.emoji || '⚖️',
      starsDelta: penaltyStarsDelta,
      fineThb: fineThb > 0 ? fineThb : undefined,
      fineReason: noteLabel,
      penaltyAlert: {
        kidNickname: kid.nickname,
        kidEmoji: kid.emoji,
        headline:
          lang === 'th' ? `บันทึกบทลงโทษ: ${cmd.titleTh}` : `Penalty Recorded: ${cmd.titleEn}`,
        reasonLine:
          noteText ||
          (lang === 'th' ? 'บันทึกบทลงโทษทันทีตามคำสั่งที่กำหนดค่ะ' : 'Penalty recorded immediately.'),
        penaltyText: noteLabel,
        clockNote:
          lang === 'th'
            ? `บันทึกเวลา ${minsToHHMM(getMinutesOfDay(now))} น.`
            : `Recorded at ${minsToHHMM(getMinutesOfDay(now))}`,
      },
      bannerTitle:
        lang === 'th'
          ? `บันทึกบทลงโทษ "${cmd.titleTh}" · น้อง${kid.nickname}`
          : `Penalty "${cmd.titleEn}" · ${kid.nickname}`,
      bannerSubtitle: `${noteLabel}${noteText ? ` · ${noteText}` : ''}`,
      updatedKid: updated,
    };
  }

  if (cmd.kind === 'homework_permission') {
    const subjectLabel = noteText || 'ทำการบ้าน';
    if (kid.daily.homeworkRegisteredSubject && !subjectOrNoteOverride?.trim()) {
      return {
        success: true,
        emoji: '✅',
        starsDelta: 0,
        bannerTitle:
          lang === 'th'
            ? `น้อง${kid.nickname} ขออนุญาตไว้แล้ว (${kid.daily.homeworkRegisteredSubject})`
            : `${kid.nickname} Already Registered Homework`,
        bannerSubtitle:
          lang === 'th'
            ? 'ใช้เพิ่มได้อีก 15 นาที ถึง 21:00 น. (3 ทุ่ม) · หากเกิน 21:00 น. ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วันค่ะ'
            : 'Extension active until 21:00 (past 21:00 forfeits 1 Free Day phone privilege).',
      };
    }

    const updated: Member = {
      ...kid,
      stars: Math.max(0, kid.stars + stars),
      daily: {
        ...kid.daily,
        homeworkRegisteredSubject: subjectLabel,
      },
      starHistory: [
        {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: now.toISOString(),
          reason: `${cmd.emoji} คีย์ลัด "${cmd.titleTh}": ${subjectLabel}${
            stars > 0 ? ` (+${stars} ⭐)` : ''
          } [cmd:${cmd.id}]`,
          amount: stars,
        },
        ...(kid.starHistory ?? []),
      ].slice(0, 60),
    };

    return {
      success: true,
      emoji: cmd.emoji || '📝',
      starsDelta: stars,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} ${cmd.titleTh}สำเร็จ! (${subjectLabel})${
              stars > 0 ? ` +${stars} ⭐` : ''
            }`
          : `${kid.nickname}: ${cmd.titleEn} (${subjectLabel})`,
      bannerSubtitle:
        lang === 'th'
          ? 'ใช้เพิ่มได้อีก 15 นาที ถึงเวลา 21:00 น. (3 ทุ่ม) · หากเกิน 21:00 น. ยังไม่นำมือถือมาเก็บ ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน'
          : 'Extended +15 min until 21:00 (past 21:00 forfeits 1 Free Day phone privilege).',
      updatedKid: updated,
    };
  }

  const mins = getMinutesOfDay(now);
  const pastDeadline =
    typeof cmd.deadlineMins === 'number' &&
    Number.isFinite(cmd.deadlineMins) &&
    mins > cmd.deadlineMins;
  const effectiveStars = pastDeadline ? 0 : stars;

  const updated: Member = {
    ...kid,
    stars: Math.max(0, kid.stars + effectiveStars),
    starHistory: [
      {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: now.toISOString(),
        reason: `${cmd.emoji} คำสั่ง "${cmd.titleTh}"${noteText ? `: ${noteText}` : ''}${
          effectiveStars > 0 ? ` (+${effectiveStars} ⭐)` : pastDeadline ? ' (เลยเส้นตาย 0 ⭐)' : ''
        } [cmd:${cmd.id}]`,
        amount: effectiveStars,
      },
      ...(kid.starHistory ?? []),
    ].slice(0, 60),
  };

  const customPenaltySummary =
    pastDeadline && cmd.penaltyPreset && cmd.penaltyPreset !== 'lock_after_deadline'
      ? getPenaltySummaryText(cmd.penaltyPreset, cmd.penaltyNote, lang)
      : '';

  return {
    success: true,
    emoji: cmd.emoji || '⚡',
    starsDelta: effectiveStars,
    penaltyAlert:
      pastDeadline && customPenaltySummary
        ? {
            kidNickname: kid.nickname,
            kidEmoji: kid.emoji,
            headline:
              lang === 'th'
                ? `เลยกำหนดเวลา "${cmd.titleTh}" แล้ว!`
                : `Past "${cmd.titleEn}" Deadline!`,
            reasonLine:
              lang === 'th'
                ? `กำหนดไม่เกิน ${minsToHHMM(cmd.deadlineMins!)} น. (เกินเวลามา ${Math.max(1, mins - cmd.deadlineMins!)} นาที)`
                : `${Math.max(1, mins - cmd.deadlineMins!)} min past ${minsToHHMM(cmd.deadlineMins!)} deadline`,
            penaltyText: customPenaltySummary,
            clockNote:
              lang === 'th'
                ? `บันทึกเวลา ${minsToHHMM(mins)} น.`
                : `Recorded at ${minsToHHMM(mins)}`,
          }
        : undefined,
    bannerTitle:
      lang === 'th'
        ? `น้อง${kid.nickname}: ${cmd.titleTh} เรียบร้อย!${effectiveStars > 0 ? ` +${effectiveStars} ⭐` : ''}`
        : `${kid.nickname}: ${cmd.titleEn} Recorded!${effectiveStars > 0 ? ` +${effectiveStars} ⭐` : ''}`,
    bannerSubtitle:
      noteText ||
      (pastDeadline && cmd.penaltyNote
        ? cmd.penaltyNote
        : lang === 'th'
        ? 'บันทึกลงประวัติคีย์ลัดประจำวันเรียบร้อยแล้วค่ะ'
        : 'Recorded via custom quick command.'),
    updatedKid: updated,
  };
}


