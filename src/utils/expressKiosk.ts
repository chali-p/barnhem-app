import { AppSettings, Language, Member } from '../types/barnhem';
import { applyMorningStreakOnTime } from './houseChores';
import { applyDailySchoolDeduction, getEconomyConfig, isKidAwayOnDate } from './piggyBank';
import { getDateKey, getMinutesOfDay, isPublicHoliday } from './timeRules';

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
