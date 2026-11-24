import { AppSettings, CommandAuthMode, CustomQuickCommand, Language, Member } from '../types/barnhem';
import { applyMorningStreakOnTime } from './houseChores';
import { applyDailySchoolDeduction, getEconomyConfig, isKidAwayOnDate } from './piggyBank';
import { getDateKey, getMinutesOfDay, getTomorrowDateKey, isPublicHoliday } from './timeRules';

export interface KioskResult {
  success: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  starsDelta: number;
  emoji: string;
  updatedKid?: Member;
  fineThb?: number;
  fineReason?: string;
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

  // Group 2 (High school - On time <= 07:21, late ceiling 08:00)
  const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
  if (mins <= 7 * 60 + 21) {
    const isEarly15 = mins <= 7 * 60 + 6 && earlyBonus > 0;
    const streakUpdate = applyMorningStreakOnTime(kid, now);
    const stars = 10 + (isEarly15 ? earlyBonus : 0) + streakUpdate.milestoneBonusStars;
    const updated = appendStarTx(
      kid,
      stars,
      `🚌 ปุ่มด่วน "ไปโรงเรียน": ตรงเวลา (≤07:21 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐)` : ''}${streakUpdate.streakTextTh ? ` · ${streakUpdate.streakTextTh}` : ''}`,
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
          ? `น้อง${kid.nickname} ไปโรงเรียนแล้ว! +${stars} ⭐`
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

  const SCHOOL_LATE_CEILING = 8 * 60;
  const cappedMins = Math.min(mins, SCHOOL_LATE_CEILING);
  const minsLate = Math.max(1, cappedMins - (7 * 60 + 21));
  const pastCeiling = mins > SCHOOL_LATE_CEILING;
  const fine = isSickToday || isAwayToday ? 0 : Math.min(minsLate * 5, 50);
  const fineReason = `ไปโรงเรียนสาย ${minsLate} นาที${pastCeiling ? ' (เพดานสาย 08:00 น.)' : ''}`;
  const updated = appendStarTx(
    kid,
    0,
    isSickToday || isAwayToday
      ? `🚌 ปุ่มด่วน "ไปโรงเรียน" (${fineReason} · ยกเว้นค่าปรับเพราะ${isSickToday ? 'ป่วย' : 'ลาพัก'})`
      : `🚌 ปุ่มด่วน "ไปโรงเรียน" (${fineReason} · หักกระปุกหมู ${fine} ฿ → เข้ากระปุกทองคำ)`,
    {
      avatar: { ...kid.avatar, outfitMode: 'uniform' },
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
  );
  return {
    success: true,
    emoji: fine > 0 ? '🚌⏰' : '💚🚌',
    starsDelta: 0,
    fineThb: fine,
    fineReason,
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
  | 'evening_unlock_cartoon'
  | 'night_homework_permission'
  | 'night_return_phone';

export interface HomeQuickActionConfig {
  id: HomeQuickActionId;
  emoji: string;
  startMins: number;
  endMins: number;
  windowLabelTh: string;
  windowLabelEn: string;
  titleTh: string;
  titleEn: string;
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
    windowLabelTh: '06:00–07:00 น.',
    windowLabelEn: '06:00–07:00',
    titleTh: 'มาขอรับมือถือ',
    titleEn: 'Morning Phone Pickup',
    tapLabelTh: '📱 มาขอรับมือถือ',
    tapLabelEn: '📱 Get Phone',
    doneLabelTh: '✅ รับมือถือแล้ว',
    doneLabelEn: '✅ Phone Collected',
  },
  {
    id: 'morning_breakfast',
    emoji: '🍚',
    startMins: 6 * 60 + 30,
    endMins: 7 * 60 + 30,
    windowLabelTh: '06:30–07:30 น.',
    windowLabelEn: '06:30–07:30',
    titleTh: 'กินข้าวเช้า',
    titleEn: 'Breakfast',
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
    windowLabelTh: '06:30–07:30 น.',
    windowLabelEn: '06:30–07:30',
    titleTh: 'ไปโรงเรียน',
    titleEn: 'Go to School',
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
    windowLabelTh: '15:00–17:00 น.',
    windowLabelEn: '15:00–17:00',
    titleTh: 'กลับบ้านแล้ว',
    titleEn: 'Returned Home',
    tapLabelTh: '🏡 กลับบ้านแล้ว',
    tapLabelEn: '🏡 Home Now',
    doneLabelTh: '✅ กลับบ้านแล้ว',
    doneLabelEn: '✅ Back Home',
  },
  {
    id: 'evening_uniform_phone',
    emoji: '👔📱',
    startMins: 18 * 60,
    endMins: 20 * 60 + 30,
    windowLabelTh: '18:00–20:30 น.',
    windowLabelEn: '18:00–20:30',
    titleTh: 'ตรวจชุด & รับมือถือ',
    titleEn: 'Uniform & Get Phone',
    tapLabelTh: '📱 ตรวจชุด & รับมือถือ',
    tapLabelEn: '📱 Uniform & Phone',
    doneLabelTh: '✅ รับมือถือแล้ว',
    doneLabelEn: '✅ Phone Collected',
  },
  {
    id: 'evening_unlock_cartoon',
    emoji: '📺',
    startMins: 20 * 60,
    endMins: 20 * 60 + 40,
    windowLabelTh: '20:00–20:40 น.',
    windowLabelEn: '20:00–20:40',
    titleTh: 'ปลดล็อคดูการ์ตูน',
    titleEn: 'Unlock Cartoons',
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
    windowLabelTh: '20:30–20:45 น.',
    windowLabelEn: '20:30–20:45',
    titleTh: 'ขออนุญาตทำการบ้าน',
    titleEn: 'Homework Permission',
    tapLabelTh: '📝 ขออนุญาตทำการบ้าน',
    tapLabelEn: '📝 Homework Permission',
    doneLabelTh: '✅ ขออนุญาตแล้ว',
    doneLabelEn: '✅ Permitted',
  },
  {
    id: 'night_return_phone',
    emoji: '🌙',
    startMins: 20 * 60 + 30,
    endMins: 23 * 60,
    windowLabelTh: '20:30–23:00 น. (Curfew 21:00)',
    windowLabelEn: '20:30–23:00 (21:00 Curfew)',
    titleTh: 'คืนมือถือ',
    titleEn: 'Return Phone',
    tapLabelTh: '🌙 คืนมือถือ',
    tapLabelEn: '🌙 Return Phone',
    doneLabelTh: '✅ คืนมือถือแล้ว',
    doneLabelEn: '✅ Phone Returned',
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

export function getEffectiveHomeQuickActions(
  settings?: Partial<AppSettings>
): HomeQuickActionConfig[] {
  const overrides = settings?.timedCommandSchedule;
  const curfewHHMM = minsToHHMM(getEffectiveHomeworkCurfewMins(settings));
  return HOME_QUICK_ACTIONS.map((action) => {
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
    const sStr = minsToHHMM(startMins);
    const eStr = minsToHHMM(endMins);
    const isReturn = action.id === 'night_return_phone';
    return {
      ...action,
      startMins,
      endMins,
      windowLabelTh: isReturn
        ? `${sStr}–${eStr} น. (Curfew ${curfewHHMM})`
        : `${sStr}–${eStr} น.`,
      windowLabelEn: isReturn ? `${sStr}–${eStr} (${curfewHHMM} Curfew)` : `${sStr}–${eStr}`,
    };
  });
}

export function getEffectiveHomeworkPermissionWindow(settings?: Partial<AppSettings>): {
  startMins: number;
  endMins: number;
  labelTh: string;
  labelEn: string;
} {
  const found =
    getEffectiveHomeQuickActions(settings).find((a) => a.id === 'night_homework_permission') ??
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
    getEffectiveHomeQuickActions(settings).find((a) => a.id === 'morning_phone_pickup') ??
    HOME_QUICK_ACTIONS.find((a) => a.id === 'morning_phone_pickup')!;
  return {
    startMins: found.startMins,
    endMins: found.endMins,
    labelTh: found.windowLabelTh,
    labelEn: found.windowLabelEn,
  };
}

export function isHomeActionOpenAt(
  actionId: HomeQuickActionId,
  now: Date,
  settings?: Partial<AppSettings>
): boolean {
  const cfg = getEffectiveHomeQuickActions(settings).find((a) => a.id === actionId);
  if (!cfg) return false;
  const mins = getMinutesOfDay(now);
  if (cfg.startMins <= cfg.endMins) {
    return mins >= cfg.startMins && mins <= cfg.endMins;
  }
  return mins >= cfg.startMins || mins <= cfg.endMins;
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
    case 'evening_unlock_cartoon':
      return Boolean(kid.daily.bossStageUnlocked);
    case 'night_homework_permission':
      return Boolean(kid.daily.homeworkRegisteredSubject);
    case 'night_return_phone':
      return Boolean(kid.daily.phoneReturnedChecked);
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

export function getCommandDenialReason(
  commandId: string,
  kid: Member,
  lang: Language,
  settings?: Partial<AppSettings>
): { title: string; subtitle: string; badgeTh: string; badgeEn: string } {
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

    const updated = appendStarTx(
      kid,
      0,
      `📱 ปุ่มด่วน "มาขอรับมือถือ" (${cfg.windowLabelTh})`,
      {
        daily: { ...kid.daily, morningPhonePickupChecked: true },
      }
    );
    return {
      success: true,
      emoji: '📱✨',
      starsDelta: 0,
      bannerTitle:
        lang === 'th'
          ? `น้อง${kid.nickname} มาขอรับมือถือเรียบร้อยแล้ว!`
          : `${kid.nickname} Morning Phone Pickup Confirmed!`,
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
    const onTime = mins < 6 * 60 + 40;
    const streakUpdate = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const stars = (onTime ? 5 : 0) + (streakUpdate?.milestoneBonusStars ?? 0);
    const updated = appendStarTx(
      kid,
      stars,
      onTime
        ? `🍚 ปุ่มด่วน "กินข้าวเช้า" (ก่อน 06:40 น. +${stars} ⭐)`
        : '🍚 ปุ่มด่วน "กินข้าวเช้า" (06:40–07:30 น.)',
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
    const stars = kid.group === 3 ? 20 : kid.group === 2 ? 5 : 0;
    const isEarly15 = stars > 0 && mins <= 15 * 60 + 45 && earlyBonus > 0 ? 0 : 0;
    const totalStars = stars + isEarly15;
    const updated = appendStarTx(
      kid,
      totalStars,
      `🏡 ปุ่มด่วน "กลับบ้านแล้ว"${totalStars > 0 ? ` (+${totalStars} ⭐)` : ' (เริ่ม Speedy Ninja 20 นาที)'}`,
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

    const stars = 10;
    const updated = appendStarTx(
      kid,
      stars,
      '👔📱 ปุ่มด่วน "ตรวจชุดนักเรียน & ขอรับมือถือ" (+10 ⭐)',
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

    const stars = 10;
    const updated = appendStarTx(
      kid,
      stars,
      '📺 ปุ่มด่วน "ปลดล็อคดูการ์ตูน" (ด่านบอส 20:00 น. +10 ⭐)',
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
            ? `บันทึกขออนุญาตไว้เรียบร้อยแล้วค่ะ (ใช้เพิ่มได้ถึง ${formatThaiCurfewClock(getEffectiveHomeworkCurfewMins(settings))})`
            : 'Already registered today.',
      };
    }
    const cleanChoice = (detailOverride ?? '').trim().slice(0, 100) || 'ทำการบ้าน';
    const curfewMins = getEffectiveHomeworkCurfewMins(settings);
    const curfewTh = formatThaiCurfewClock(curfewMins);
    const curfewEn = minsToHHMM(curfewMins);
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
          ? `ใช้เพิ่มได้จนถึงเวลา ${curfewTh} · หากเกิน ${curfewTh} ยังไม่นำมือถือมาเก็บ ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน`
          : `Extended until ${curfewEn} (past ${curfewEn} forfeits 1 Free Day phone privilege).`,
      updatedKid: updated,
    };
  }

  // 'night_return_phone'
  if (kid.daily.phoneReturnedChecked) {
    return {
      success: true,
      emoji: '✅',
      starsDelta: 0,
      bannerTitle: lang === 'th' ? `น้อง${kid.nickname} คืนมือถือวันนี้แล้ว` : `${kid.nickname} Phone Returned`,
      bannerSubtitle: lang === 'th' ? 'คืนเข้าตู้พี่เลี้ยงเรียบร้อยแล้วค่ะ ฝันดีนะ' : 'Already returned today.',
    };
  }

  const curfewMins = getEffectiveHomeworkCurfewMins(settings);
  const curfewTh = formatThaiCurfewClock(curfewMins);
  const curfewEn = minsToHHMM(curfewMins);
  const use21Curfew = kid.group === 1 || kid.group === 2 || Boolean(kid.daily.homeworkRegisteredSubject);
  const deadlineMins = use21Curfew ? curfewMins : 22 * 60 + 45;
  const onTime = mins <= deadlineMins;

  if (onTime) {
    const stars = 5;
    const updated = appendStarTx(
      kid,
      stars,
      '🌙 ปุ่มด่วน "คืนมือถือ" ตรงเวลา (+5 ⭐)',
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
          ? 'ส่งคืนมือถือเข้าตู้พี่เลี้ยงตรงเวลา ฝันดีนะคะ!'
          : 'Returned phone on time. Good night!',
      updatedKid: updated,
    };
  }

  const tomorrow = getTomorrowDateKey(now);
  const updated: Member = {
    ...kid,
    penalty:
      isSickToday || isAwayToday
        ? kid.penalty
        : use21Curfew
        ? { ...kid.penalty, fridayFreeDayDeductedCount: kid.penalty.fridayFreeDayDeductedCount + 1 }
        : { ...kid.penalty, noEveningPhoneTomorrowDate: tomorrow },
    daily: { ...kid.daily, phoneReturnedChecked: true },
  };
  return {
    success: true,
    emoji: isSickToday || isAwayToday ? '💚📱' : '⚖️📵',
    starsDelta: 0,
    bannerTitle:
      isSickToday || isAwayToday
        ? lang === 'th'
          ? `น้อง${kid.nickname} คืนมือถือแล้ว (ยกเว้นโทษป่วย/ลาพัก)`
          : `${kid.nickname} Phone Returned (Waived)`
        : use21Curfew
        ? lang === 'th'
          ? `น้อง${kid.nickname} คืนมือถือเกิน ${curfewTh}`
          : `${kid.nickname} Returned Past ${curfewEn}`
        : lang === 'th'
        ? `น้อง${kid.nickname} คืนมือถือเกิน 22:45 น.`
        : `${kid.nickname} Returned Past 22:45`,
    bannerSubtitle:
      isSickToday || isAwayToday
        ? lang === 'th'
          ? `บันทึกคืนมือถือเรียบร้อย (วันหยุด/ป่วยไม่หักสิทธิ์, พรุ่งนี้ ${tomorrow})`
          : 'Recorded without penalty.'
        : use21Curfew
        ? lang === 'th'
          ? `เลยเวลา ${curfewTh} แล้ว — ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วันค่ะ`
          : `Past ${curfewEn} — recorded as consent to forfeit 1 Free Day phone privilege.`
        : lang === 'th'
        ? 'เกิน 22:45 น. บันทึกงดใช้มือถือช่วงเย็นวันพรุ่งนี้ 1 วันค่ะ'
        : 'Past 22:45 — restricted from evening phone use tomorrow.',
    updatedKid: updated,
  };
}

export const DEFAULT_EXTRA_QUICK_COMMANDS: CustomQuickCommand[] = [];

export function getEffectiveCustomQuickCommands(
  settings?: Partial<AppSettings>
): CustomQuickCommand[] {
  if (Array.isArray(settings?.customQuickCommands)) {
    return settings.customQuickCommands;
  }
  return DEFAULT_EXTRA_QUICK_COMMANDS;
}

export function isCustomCommandOpenAt(cmd: CustomQuickCommand, now: Date): boolean {
  if (cmd.alwaysOpen) return true;
  if (typeof cmd.startMins !== 'number' || typeof cmd.endMins !== 'number') return true;
  const mins = getMinutesOfDay(now);
  if (cmd.startMins <= cmd.endMins) {
    return mins >= cmd.startMins && mins <= cmd.endMins;
  }
  return mins >= cmd.startMins || mins <= cmd.endMins;
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
  const stars = Math.max(0, Math.min(20, Math.round(Number(cmd.starsDelta ?? 0))));

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

  const updated: Member = {
    ...kid,
    stars: Math.max(0, kid.stars + stars),
    starHistory: [
      {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: now.toISOString(),
        reason: `${cmd.emoji} คีย์ลัด "${cmd.titleTh}"${noteText ? `: ${noteText}` : ''}${
          stars > 0 ? ` (+${stars} ⭐)` : ''
        } [cmd:${cmd.id}]`,
        amount: stars,
      },
      ...(kid.starHistory ?? []),
    ].slice(0, 60),
  };

  return {
    success: true,
    emoji: cmd.emoji || '⚡',
    starsDelta: stars,
    bannerTitle:
      lang === 'th'
        ? `น้อง${kid.nickname}: ${cmd.titleTh} เรียบร้อย!${stars > 0 ? ` +${stars} ⭐` : ''}`
        : `${kid.nickname}: ${cmd.titleEn} Recorded!${stars > 0 ? ` +${stars} ⭐` : ''}`,
    bannerSubtitle:
      noteText ||
      (lang === 'th'
        ? 'บันทึกลงประวัติคีย์ลัดประจำวันเรียบร้อยแล้วค่ะ'
        : 'Recorded via custom quick shortcut.'),
    updatedKid: updated,
  };
}


