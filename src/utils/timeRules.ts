import { Language } from '../types/barnhem';

// Thai National Holidays (MM-DD) for casual outfit allowance
const THAI_FIXED_HOLIDAYS = new Set([
  '01-01', // วันขึ้นปีใหม่
  '04-06', // วันจักรี
  '04-13', // วันสงกรานต์
  '04-14', // วันสงกรานต์
  '04-15', // วันสงกรานต์
  '05-01', // วันแรงงาน
  '05-04', // วันฉัตรมงคล
  '06-03', // วันเฉลิมฯ พระราชินี
  '07-28', // วันเฉลิมฯ ร.10
  '08-12', // วันแม่แห่งชาติ
  '10-13', // วันนวมินทรมหาราช
  '10-23', // วันปิยมหาราช
  '12-05', // วันพ่อแห่งชาติ
  '12-10', // วันรัฐธรรมนูญ
  '12-31', // วันสิ้นปี
]);

export function getEffectiveNow(simulatedTimeIso: string | null): Date {
  if (!simulatedTimeIso) return new Date();
  const parsed = new Date(simulatedTimeIso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTomorrowDateKey(date: Date): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return getDateKey(next);
}

export function formatDigitalClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatReadableDate(date: Date, lang: Language): string {
  if (lang === 'en') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getLaundryQueueInfo(date: Date, lang: Language): {
  type: 'boys' | 'girls' | 'all';
  label: string;
  emoji: string;
} {
  const day = date.getDate();
  if (day === 31) {
    return {
      type: 'all',
      emoji: '🧺✨',
      label: lang === 'th' ? 'วันที่ 31: คิวซักผ้าทุกคน (ชาย & หญิง)' : '31st: Laundry Day for Everyone!',
    };
  }
  if (day % 2 === 0) {
    return {
      type: 'boys',
      emoji: '👕💙',
      label: lang === 'th' ? `วันที่ ${day} (วันคู่): คิวซักผ้าผู้ชาย` : `Day ${day} (Even): Boys' Laundry Queue`,
    };
  }
  return {
    type: 'girls',
    emoji: '👚🩷',
    label: lang === 'th' ? `วันที่ ${day} (วันคี่): คิวซักผ้าผู้หญิง` : `Day ${day} (Odd): Girls' Laundry Queue`,
  };
}

export function isPublicHoliday(date: Date, manualHolidayFlag: boolean): boolean {
  if (manualHolidayFlag) return true;
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return THAI_FIXED_HOLIDAYS.has(mmdd);
}

export function canWearCasualOutfitNow(date: Date, manualHolidayFlag: boolean): {
  allowed: boolean;
  reasonTh: string;
  reasonEn: string;
} {
  const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
  const mins = date.getHours() * 60 + date.getMinutes();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      allowed: true,
      reasonTh: 'วันเสาร์-อาทิตย์ สามารถแต่งชุดใส่เที่ยวได้ตลอดวัน!',
      reasonEn: 'Weekend! Casual outfits are unlocked all day!',
    };
  }
  if (isPublicHoliday(date, manualHolidayFlag)) {
    return {
      allowed: true,
      reasonTh: 'วันหยุดนักขัตฤกษ์ สามารถแต่งชุดใส่เที่ยวได้!',
      reasonEn: 'Public Holiday! Casual outfits are unlocked!',
    };
  }
  if (mins >= 18 * 60 + 30) {
    return {
      allowed: true,
      reasonTh: 'หลังเวลา 18:30 น. สามารถเปลี่ยนชุดใส่เที่ยวได้แล้ว!',
      reasonEn: 'After 18:30! Casual outfits are now unlocked!',
    };
  }
  return {
    allowed: false,
    reasonTh: 'อยู่ในเวลาเรียน (ก่อน 18:30 น. วันจันทร์-ศุกร์) ยังไม่สามารถเปลี่ยนเป็นชุดใส่เที่ยวได้ (อนุญาตหลัง 18:30 น. หรือวันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)',
    reasonEn: 'During school hours (Mon-Fri before 18:30), casual outfits are locked. Unlocked after 18:30, weekends, or public holidays.',
  };
}

export function getMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getBossStageLanguageLesson(date: Date, lang: Language): string {
  const day = date.getDay();
  const mapTh: Record<number, string> = {
    1: '🇯🇵 วันจันทร์: เรียนภาษาญี่ปุ่น',
    2: '🇬🇧 วันอังคาร: เรียนภาษาอังกฤษ',
    3: '🇨🇳 วันพุธ: เรียนภาษาจีน',
    4: '🇬🇧 วันพฤหัสบดี: เรียนภาษาอังกฤษ',
    5: '🎨 วันศุกร์: กิจกรรมทบทวนประจำสัปดาห์',
    6: '🌟 วันเสาร์: กิจกรรมสร้างสรรค์วันหยุด',
    0: '📖 วันอาทิตย์: เตรียมความพร้อมก่อนเปิดเรียน',
  };
  const mapEn: Record<number, string> = {
    1: '🇯🇵 Monday: Japanese Class',
    2: '🇬🇧 Tuesday: English Class',
    3: '🇨🇳 Wednesday: Chinese Class',
    4: '🇬🇧 Thursday: English Class',
    5: '🎨 Friday: Weekly Review',
    6: '🌟 Saturday: Weekend Creativity',
    0: '📖 Sunday: School Prep',
  };
  return lang === 'th' ? mapTh[day] : mapEn[day];
}
