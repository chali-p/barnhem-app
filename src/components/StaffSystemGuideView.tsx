import React, { useMemo, useState } from 'react';
import {
  getMorningStaffInfo,
  getStaffScheduleForDate,
  parseRosterNames,
  WEEKLY_STAFF_SCHEDULE,
} from '../data/staffSchedule';
import { Language, StaffLeaveRecord } from '../types/barnhem';
import { formatDigitalClock, getDateKey } from '../utils/timeRules';

type ShiftFilter = 'all' | 'morning' | 'evening' | 'night';

interface StaffSystemGuideViewProps {
  orgName?: string;
  now: Date;
  lang: Language;
  staffLeaves?: StaffLeaveRecord[];
  isPublicHolidayToday?: boolean;
  onBackHome: () => void;
}

function detectCurrentShift(now: Date): 'morning' | 'evening' | 'night' {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 12 * 60) return 'morning';
  if (mins < 18 * 60 + 30) return 'evening';
  return 'night';
}

function resolveEffectivePerson(
  scheduledName: string,
  dateKey: string,
  leaves: StaffLeaveRecord[],
  forMorning: boolean,
  dayIndex: number
): { label: string; isLeaveAdjusted: boolean } {
  const cleanNames = parseRosterNames(scheduledName);
  const activeLeave = leaves.find(
    (l) =>
      l.status === 'active' &&
      l.dateKey === dateKey &&
      cleanNames.includes(l.staffName) &&
      (l.span === 'full_day' ||
        (forMorning ? l.span === 'morning' : l.span === 'afternoon_from_time'))
  );
  if (!activeLeave) {
    return { label: scheduledName, isLeaveAdjusted: false };
  }
  const sub = activeLeave.substituteName?.trim();
  if (sub) {
    return {
      label: `${sub} (แทน ${activeLeave.staffName})`,
      isLeaveAdjusted: true,
    };
  }
  if (forMorning) {
    const autoSub = dayIndex === 4 ? 'พี่กุ๊ก' : 'พี่กิ๊ก';
    return {
      label: `${autoSub} (แทน ${activeLeave.staffName})`,
      isLeaveAdjusted: true,
    };
  }
  return {
    label: `${scheduledName} (แจ้งลา — รอระบุผู้แทน)`,
    isLeaveAdjusted: true,
  };
}

export const StaffSystemGuideView: React.FC<StaffSystemGuideViewProps> = ({
  orgName = 'Barnhem Care & Kids',
  now,
  lang,
  staffLeaves = [],
  isPublicHolidayToday = false,
  onBackHome,
}) => {
  const liveShift = useMemo(() => detectCurrentShift(now), [now]);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [showWeeklyPairTable, setShowWeeklyPairTable] = useState(true);

  const todayKey = getDateKey(now);
  const tomorrowDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }, [now]);
  const tomorrowKey = getDateKey(tomorrowDate);

  const todayRow = useMemo(() => getStaffScheduleForDate(now), [now]);
  const tomorrowRow = useMemo(() => getStaffScheduleForDate(tomorrowDate), [tomorrowDate]);

  const todayMorningBase = useMemo(
    () =>
      getMorningStaffInfo(todayRow, {
        lang: 'th',
        isHolidayOrSchoolBreak: isPublicHolidayToday,
      }),
    [todayRow, isPublicHolidayToday]
  );
  const tomorrowMorningBase = useMemo(
    () =>
      getMorningStaffInfo(tomorrowRow, {
        lang: 'th',
        isHolidayOrSchoolBreak: false,
      }),
    [tomorrowRow]
  );

  const todayMorningEffective = useMemo(
    () =>
      resolveEffectivePerson(
        todayMorningBase.regularStaff,
        todayKey,
        staffLeaves,
        true,
        todayRow.dayIndex
      ),
    [todayMorningBase.regularStaff, todayKey, staffLeaves, todayRow.dayIndex]
  );

  const todayNightWatchEffective = useMemo(
    () =>
      resolveEffectivePerson(
        todayRow.nightWatchTh,
        todayKey,
        staffLeaves,
        false,
        todayRow.dayIndex
      ),
    [todayRow.nightWatchTh, todayKey, staffLeaves, todayRow.dayIndex]
  );

  const tomorrowMorningEffective = useMemo(
    () =>
      resolveEffectivePerson(
        tomorrowMorningBase.regularStaff,
        tomorrowKey,
        staffLeaves,
        true,
        tomorrowRow.dayIndex
      ),
    [tomorrowMorningBase.regularStaff, tomorrowKey, staffLeaves, tomorrowRow.dayIndex]
  );

  const weeklyPairs = useMemo(() => {
    return WEEKLY_STAFF_SCHEDULE.map((row, idx) => {
      const nextRow = WEEKLY_STAFF_SCHEDULE[(idx + 1) % WEEKLY_STAFF_SCHEDULE.length];
      const morningName = row.shiftATh !== '—' ? row.shiftATh : row.shiftBTh;
      const nextMorningName = nextRow.shiftATh !== '—' ? nextRow.shiftATh : nextRow.shiftBTh;
      const isToday = row.dayIndex === todayRow.dayIndex;
      return {
        dayTh: row.dayTh,
        dayEn: row.dayEn,
        morningName,
        nightWatchName: row.nightWatchTh,
        nextDayTh: nextRow.dayTh,
        nextMorningName,
        isToday,
      };
    });
  }, [todayRow.dayIndex]);

  const shiftButtons: Array<{
    id: ShiftFilter;
    emoji: string;
    labelTh: string;
    labelEn: string;
    activeCls: string;
  }> = [
    {
      id: 'all',
      emoji: '📋',
      labelTh: 'ดูครบทุกช่วงเวลา',
      labelEn: 'All Shifts',
      activeCls: 'border-[#4A3E38] bg-[#3D322C] text-white',
    },
    {
      id: 'morning',
      emoji: '🌅',
      labelTh: 'ช่วงเช้า (คนเข้าเช้า)',
      labelEn: 'Morning (Morning Shift)',
      activeCls: 'border-[#D97706] bg-[#FEF3C7] text-[#78350F]',
    },
    {
      id: 'evening',
      emoji: '🌇',
      labelTh: 'ช่วงเย็น',
      labelEn: 'Evening',
      activeCls: 'border-[#DB2777] bg-[#FCE7F3] text-[#831843]',
    },
    {
      id: 'night',
      emoji: '🌙',
      labelTh: 'ช่วงค่ำ (ไนท์วอช)',
      labelEn: 'Night (Night Watch)',
      activeCls: 'border-[#4F46E5] bg-[#E0E7FF] text-[#312E81]',
    },
  ];

  const showMorning = shiftFilter === 'all' || shiftFilter === 'morning';
  const showEvening = shiftFilter === 'all' || shiftFilter === 'evening';
  const showNight = shiftFilter === 'all' || shiftFilter === 'night';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#BEDBF0] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#BEDBF0] bg-[#EEF6FF] px-3 py-1 text-xs font-extrabold text-[#1D4D73]">
                <span>🔑 PIN 0009</span>
                <span>·</span>
                <span>
                  {lang === 'th' ? 'คู่มือการทำงานของพี่เลี้ยง & ระบบ' : 'Staff & System Workflow'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl border border-[#C9E7E0] bg-[#EEFBF8] px-2.5 py-1 text-[11px] font-bold text-[#114A42] tabular-nums">
                <span>🕒</span>
                <span>
                  {lang === 'th'
                    ? `เวลาปัจจุบัน ${formatDigitalClock(now)} น. (${
                        liveShift === 'morning'
                          ? 'ช่วงเช้า'
                          : liveShift === 'evening'
                          ? 'ช่วงเย็น'
                          : 'ช่วงค่ำ'
                      })`
                    : `Now ${formatDigitalClock(now)}`}
                </span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              📋{' '}
              {lang === 'th'
                ? `ตารางสรุปการทำงานของพี่เลี้ยงและระบบ — ${orgName}`
                : `Staff & System Summary Table — ${orgName}`}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'สรุปผู้รับผิดชอบ (คนเข้าเช้า / ไนท์วอช) หน้าที่ของพี่เลี้ยง และวิธีที่น้องใช้งานระบบในแต่ละช่วงเวลา'
                : 'Overview of assigned staff (Morning Shift / Night Watch), duties, and how kids use the system.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] text-[#3D322C] px-4 py-2 text-xs font-extrabold cursor-pointer shrink-0"
          >
            ← {lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
          </button>
        </div>

        {/* Live Duty Highlight Strip: Morning Shift Today + Night Watch Tonight -> Tomorrow Morning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-2xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg bg-[#D97706] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                🌅 {lang === 'th' ? 'คนทำงานช่วงเช้าวันนี้' : 'Morning Shift Today'}
              </span>
              <span className="text-[11px] font-bold text-[#92400E] tabular-nums">
                วัน{todayRow.dayTh} · {todayMorningBase.shiftTime}
              </span>
            </div>
            <div className="text-base font-extrabold text-[#451A03] pt-0.5">
              👩‍🏫 {todayMorningEffective.label}
            </div>
            <p className="text-[11px] text-[#78350F] font-semibold">
              {lang === 'th'
                ? 'รับผิดชอบปลดล็อกเปิดหน้าจอกิจกรรมช่วงเช้า (กินข้าว & ไปโรงเรียน)'
                : 'Responsible for unlocking morning check-in screens (Breakfast & School).'}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#818CF8] bg-[#EEF2FF] p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg bg-[#4F46E5] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                🌙 {lang === 'th' ? 'คนทำงานระบบช่วงค่ำ (ไนท์วอช)' : 'Night Watch System Duty'}
              </span>
              <span className="text-[11px] font-bold text-[#312E81]">
                คืนวัน{todayRow.dayTh}
              </span>
            </div>
            <div className="text-base font-extrabold text-[#1E1B4B] pt-0.5">
              🛡️ {todayNightWatchEffective.label}
            </div>
            <p className="text-[11px] text-[#312E81] font-semibold">
              {lang === 'th'
                ? `ดูแลระบบช่วงค่ำ & เตรียมเก็บมือถือให้ครบ เพื่อเข้าเช้าวันพรุ่งนี้ (วัน${tomorrowRow.dayTh}: ${tomorrowMorningEffective.label})`
                : `Supervises night check-in & collects phones to prepare for tomorrow morning (${tomorrowRow.dayEn}: ${tomorrowMorningEffective.label}).`}
            </p>
          </div>
        </div>

        {/* Shift Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFE6DC]">
          {shiftButtons.map((btn) => {
            const active = shiftFilter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setShiftFilter(btn.id)}
                className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold cursor-pointer transition-all ${
                  active
                    ? `${btn.activeCls} shadow-2xs`
                    : 'border-[#E6DDD3] bg-[#FAF8F5] hover:bg-[#EFE9E1] text-[#5E4E45]'
                }`}
              >
                {btn.emoji} {lang === 'th' ? btn.labelTh : btn.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {/* Desktop / Tablet Structured Table View */}
      <section className="hidden md:block rounded-[26px] border-2 border-[#E2D6C9] bg-white overflow-hidden pastel-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#FAF5EE] border-b-2 border-[#E6DACD] text-[#3D322C]">
                <th className="py-3.5 px-4 font-extrabold w-[16%] border-r border-[#EDE3D8]">
                  {lang === 'th' ? 'ช่วงเวลา' : 'Shift'}
                </th>
                <th className="py-3.5 px-4 font-extrabold w-[26%] border-r border-[#EDE3D8]">
                  {lang === 'th' ? 'กิจกรรม' : 'Activity'}
                </th>
                <th className="py-3.5 px-4 font-extrabold w-[31%] border-r border-[#EDE3D8]">
                  👩‍🏫 {lang === 'th' ? 'หน้าที่ของพี่เลี้ยง & ผู้รับผิดชอบ' : 'Staff Duty & Assignee'}
                </th>
                <th className="py-3.5 px-4 font-extrabold w-[27%]">
                  🧒 {lang === 'th' ? 'วิธีที่น้องใช้งานระบบ' : 'How Kids Use System'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE0D6]">
              {/* 🌅 ช่วงเช้า */}
              {showMorning && (
                <tr className="bg-[#FFFDF7] hover:bg-[#FFF9E8]/70 transition-colors">
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] bg-[#FFF8E1]/65 space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#D97706] px-3 py-1 text-xs font-extrabold text-white">
                      <span>🌅</span>
                      <span>{lang === 'th' ? 'ช่วงเช้า' : 'Morning'}</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-[#92400E] leading-snug">
                      {lang === 'th'
                        ? 'ตามตารางงานคนเข้าเช้า'
                        : 'Morning Shift Roster'}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] font-bold text-[#3D322C]">
                    <ol className="space-y-1.5">
                      <li>
                        1.{' '}
                        {lang === 'th'
                          ? 'กินข้าว (ทีมเด็กเล็ก)'
                          : 'Breakfast (Younger Kids)'}
                      </li>
                      <li>
                        2.{' '}
                        {lang === 'th'
                          ? 'เช็คชื่อไปโรงเรียน (ทีมเด็กเล็ก)'
                          : 'School Check-In (Younger Kids)'}
                      </li>
                      <li>
                        3.{' '}
                        {lang === 'th'
                          ? 'เช็คชื่อไปโรงเรียน (ทีมเด็กโต)'
                          : 'School Check-In (Older Kids)'}
                      </li>
                    </ol>
                  </td>
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] text-[#1E3A5F] space-y-2">
                    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-2.5 py-1 text-xs font-extrabold text-[#78350F]">
                      <span>👤 {lang === 'th' ? 'ผู้รับผิดชอบ:' : 'Assigned:'}</span>
                      <span>
                        {lang === 'th'
                          ? `คนเข้าเช้า (วันนี้: ${todayMorningEffective.label})`
                          : `Morning Staff (Today: ${todayMorningEffective.label})`}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-3.5 py-2.5 font-bold leading-relaxed">
                      🔐{' '}
                      {lang === 'th'
                        ? 'ปลดล็อกเปิดหน้าจอให้ 1 ครั้ง ต่อรอบกิจกรรม (ใส่รหัสพี่เลี้ยง)'
                        : 'Unlock screen once per activity session (enter Staff PIN)'}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top text-[#114A42]">
                    <div className="rounded-xl border border-[#8FD4C6] bg-[#EEFBF8] px-3.5 py-2.5 font-bold leading-relaxed">
                      👆{' '}
                      {lang === 'th'
                        ? 'กดเลือกชื่อตัวเองบนหน้าจอได้เลย (ไม่ต้องใส่รหัส)'
                        : 'Tap their own name directly on screen (no PIN required)'}
                    </div>
                  </td>
                </tr>
              )}

              {/* 🌇 ช่วงเย็น */}
              {showEvening && (
                <>
                  <tr className="bg-[#FFF9FB] hover:bg-[#FFF0F5]/70 transition-colors">
                    <td
                      rowSpan={3}
                      className="py-4 px-4 align-top border-r border-[#EDE3D8] bg-[#FCE7F3]/55"
                    >
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#DB2777] px-3 py-1 text-xs font-extrabold text-white">
                        <span>🌇</span>
                        <span>{lang === 'th' ? 'ช่วงเย็น' : 'Evening'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] font-bold text-[#3D322C]">
                      1. {lang === 'th' ? 'เช็คชื่อกลับบ้าน' : 'Return Home Check-In'}
                    </td>
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] text-[#1E3A5F]">
                      <div className="rounded-xl border border-[#F472B6] bg-[#FDF2F8] px-3.5 py-2.5 font-bold leading-relaxed">
                        🔐{' '}
                        {lang === 'th'
                          ? 'ปลดล็อกเปิดหน้าจอให้ 1 ครั้ง (ใส่รหัสพี่เลี้ยง)'
                          : 'Unlock screen once (enter Staff PIN)'}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-[#114A42]">
                      <div className="rounded-xl border border-[#8FD4C6] bg-[#EEFBF8] px-3.5 py-2.5 font-bold leading-relaxed">
                        👆{' '}
                        {lang === 'th'
                          ? 'กดเลือกชื่อตัวเองบนหน้าจอได้เลย'
                          : 'Tap their own name directly on screen'}
                      </div>
                    </td>
                  </tr>

                  <tr className="bg-[#FFF9FB] hover:bg-[#FFF0F5]/70 transition-colors">
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] font-bold text-[#3D322C]">
                      2.{' '}
                      {lang === 'th'
                        ? 'ตรวจชุดนักเรียนและรับมือถือคืน'
                        : 'Uniform Check & Phone Pickup'}
                    </td>
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] text-[#1E3A5F]">
                      <div className="rounded-xl border border-[#38BDF8] bg-[#F0F9FF] px-3.5 py-2.5 font-bold leading-relaxed">
                        📱{' '}
                        {lang === 'th'
                          ? 'ตั้งแท็บเล็ตวางไว้ประจำจุด'
                          : 'Place tablet at the check-in station'}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-[#1E336B]">
                      <div className="rounded-xl border border-[#818CF8] bg-[#EEF2FF] px-3.5 py-2.5 font-bold leading-relaxed">
                        🔑{' '}
                        {lang === 'th'
                          ? 'กดชื่อ + ใส่รหัส PIN 4 หลักส่วนตัว เพื่อยืนยันตัวตน'
                          : 'Tap name + enter personal 4-digit PIN to verify'}
                      </div>
                    </td>
                  </tr>

                  <tr className="bg-[#FFF9FB] hover:bg-[#FFF0F5]/70 transition-colors">
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] font-bold text-[#3D322C]">
                      3.{' '}
                      {lang === 'th'
                        ? 'ใช้คอมพิวเตอร์ทำการบ้าน'
                        : 'Computer for Homework'}
                    </td>
                    <td className="py-4 px-4 align-top border-r border-[#EDE3D8] text-[#1E3A5F]">
                      <div className="rounded-xl border border-[#34D399] bg-[#ECFDF5] px-3.5 py-2.5 font-bold leading-relaxed">
                        💻{' '}
                        {lang === 'th'
                          ? 'เปิดระบบ/อนุญาตใช้งานคอมพิวเตอร์'
                          : 'Open system / allow computer usage'}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-[#064E3B]">
                      <div className="rounded-xl border border-[#34D399] bg-[#ECFDF5] px-3.5 py-2.5 font-bold leading-relaxed">
                        ✅{' '}
                        {lang === 'th'
                          ? 'เข้าใช้งานตามสิทธิ์'
                          : 'Access according to granted permission'}
                      </div>
                    </td>
                  </tr>
                </>
              )}

              {/* 🌙 ช่วงค่ำ */}
              {showNight && (
                <tr className="bg-[#F9FAFF] hover:bg-[#EFF3FF]/70 transition-colors">
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] bg-[#E0E7FF]/55 space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 py-1 text-xs font-extrabold text-white">
                      <span>🌙</span>
                      <span>{lang === 'th' ? 'ช่วงค่ำ' : 'Night'}</span>
                    </div>
                    <div className="text-[11px] font-extrabold text-[#312E81] leading-snug">
                      {lang === 'th'
                        ? 'เวรไนท์วอช (Night Watch)'
                        : 'Night Watch Duty'}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] font-bold text-[#3D322C]">
                    <ol className="space-y-1.5">
                      <li>
                        1.{' '}
                        {lang === 'th'
                          ? 'ขอลงทะเบียนทำการบ้าน'
                          : 'Homework Registration'}
                      </li>
                      <li>
                        2. {lang === 'th' ? 'คืนมือถือ' : 'Return Phone'}
                      </li>
                    </ol>
                  </td>
                  <td className="py-4 px-4 align-top border-r border-[#EDE3D8] text-[#1E336B] space-y-2">
                    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#E0E7FF] border border-[#6366F1] px-2.5 py-1 text-xs font-extrabold text-[#312E81]">
                      <span>🛡️ {lang === 'th' ? 'ผู้รับผิดชอบ:' : 'Assigned:'}</span>
                      <span>
                        {lang === 'th'
                          ? `คนที่ไนท์วอช (คืนนี้: ${todayNightWatchEffective.label})`
                          : `Night Watch (Tonight: ${todayNightWatchEffective.label})`}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] px-3.5 py-2.5 font-bold leading-relaxed space-y-1.5">
                      <div>
                        👀{' '}
                        {lang === 'th'
                          ? 'เปิดระบบทิ้งไว้ และ คอยเฝ้าสังเกตการณ์ ไม่ให้น้องกดรหัสแทนกัน'
                          : 'Keep system open and supervise so kids do not enter PINs for each other'}
                      </div>
                      <div className="rounded-lg bg-white border border-[#C7D2FE] px-2.5 py-1.5 text-xs text-[#312E81]">
                        📦{' '}
                        {lang === 'th'
                          ? `เตรียมเก็บมือถือให้เรียบร้อย เพื่อเข้าเช้าในวันถัดไป (วัน${tomorrowRow.dayTh}: ${tomorrowMorningEffective.label})`
                          : `Collect & organize phones to prepare for next morning (${tomorrowRow.dayEn}: ${tomorrowMorningEffective.label})`}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top text-[#1E336B]">
                    <div className="rounded-xl border border-[#818CF8] bg-[#EEF2FF] px-3.5 py-2.5 font-bold leading-relaxed">
                      🔑{' '}
                      {lang === 'th'
                        ? 'กดชื่อ + ใส่รหัส PIN 4 หลักส่วนตัว เพื่อยืนยันตัวตน'
                        : 'Tap name + enter personal 4-digit PIN to verify'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {showMorning && (
          <section className="rounded-[24px] border-2 border-[#F59E0B] bg-white overflow-hidden shadow-xs">
            <div className="bg-[#FEF3C7] border-b border-[#F59E0B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-[#D97706] px-2.5 py-0.5 text-xs font-extrabold text-white">
                🌅 {lang === 'th' ? 'ช่วงเช้า · คนเข้าเช้า' : 'Morning · Morning Shift'}
              </span>
              <span className="text-xs font-extrabold text-[#78350F]">
                👤 {todayMorningEffective.label}
              </span>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DDD3] p-3 space-y-1 font-bold text-[#3D322C]">
                <div className="text-[11px] text-[#7B695F]">
                  {lang === 'th' ? 'กิจกรรม' : 'Activities'}
                </div>
                <div>1. {lang === 'th' ? 'กินข้าว (ทีมเด็กเล็ก)' : 'Breakfast (Younger Kids)'}</div>
                <div>
                  2. {lang === 'th' ? 'เช็คชื่อไปโรงเรียน (ทีมเด็กเล็ก)' : 'School Check-In (Younger)'}
                </div>
                <div>
                  3. {lang === 'th' ? 'เช็คชื่อไปโรงเรียน (ทีมเด็กโต)' : 'School Check-In (Older)'}
                </div>
              </div>
              <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] p-3 space-y-1">
                <div className="text-[11px] font-extrabold text-[#92400E]">
                  👩‍🏫 {lang === 'th' ? 'หน้าที่ของพี่เลี้ยง (คนเข้าเช้า)' : 'Staff Duty (Morning Shift)'}
                </div>
                <div className="font-bold text-[#451A03]">
                  🔐{' '}
                  {lang === 'th'
                    ? 'ปลดล็อกเปิดหน้าจอให้ 1 ครั้ง ต่อรอบกิจกรรม (ใส่รหัสพี่เลี้ยง)'
                    : 'Unlock screen once per session (Staff PIN)'}
                </div>
              </div>
              <div className="rounded-xl border border-[#8FD4C6] bg-[#EEFBF8] p-3 space-y-1">
                <div className="text-[11px] font-extrabold text-[#114A42]">
                  🧒 {lang === 'th' ? 'วิธีที่น้องใช้งานระบบ' : 'How Kids Use System'}
                </div>
                <div className="font-bold text-[#114A42]">
                  👆{' '}
                  {lang === 'th'
                    ? 'กดเลือกชื่อตัวเองบนหน้าจอได้เลย (ไม่ต้องใส่รหัส)'
                    : 'Tap own name on screen (no PIN required)'}
                </div>
              </div>
            </div>
          </section>
        )}

        {showEvening && (
          <section className="rounded-[24px] border-2 border-[#F472B6] bg-white overflow-hidden shadow-xs">
            <div className="bg-[#FCE7F3] border-b border-[#F472B6] px-4 py-2.5 flex items-center gap-2">
              <span className="rounded-lg bg-[#DB2777] px-2.5 py-0.5 text-xs font-extrabold text-white">
                🌇 {lang === 'th' ? 'ช่วงเย็น' : 'Evening'}
              </span>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="rounded-2xl border border-[#F9A8D4] bg-[#FFF9FB] p-3 space-y-2">
                <div className="font-extrabold text-[#831843]">
                  1. {lang === 'th' ? 'เช็คชื่อกลับบ้าน' : 'Return Home Check-In'}
                </div>
                <div className="rounded-xl bg-white border border-[#F472B6] p-2.5 font-bold text-[#4C1D3D]">
                  👩‍🏫{' '}
                  {lang === 'th'
                    ? 'ปลดล็อกเปิดหน้าจอให้ 1 ครั้ง (ใส่รหัสพี่เลี้ยง)'
                    : 'Unlock screen once (Staff PIN)'}
                </div>
                <div className="rounded-xl bg-[#EEFBF8] border border-[#8FD4C6] p-2.5 font-bold text-[#114A42]">
                  🧒{' '}
                  {lang === 'th'
                    ? 'กดเลือกชื่อตัวเองบนหน้าจอได้เลย'
                    : 'Tap own name directly'}
                </div>
              </div>

              <div className="rounded-2xl border border-[#7DD3FC] bg-[#F0F9FF] p-3 space-y-2">
                <div className="font-extrabold text-[#0C4A6E]">
                  2.{' '}
                  {lang === 'th'
                    ? 'ตรวจชุดนักเรียนและรับมือถือคืน'
                    : 'Uniform Check & Phone Pickup'}
                </div>
                <div className="rounded-xl bg-white border border-[#38BDF8] p-2.5 font-bold text-[#0C4A6E]">
                  👩‍🏫{' '}
                  {lang === 'th'
                    ? 'ตั้งแท็บเล็ตวางไว้ประจำจุด'
                    : 'Place tablet at the station'}
                </div>
                <div className="rounded-xl bg-[#EEF2FF] border border-[#818CF8] p-2.5 font-bold text-[#1E336B]">
                  🧒{' '}
                  {lang === 'th'
                    ? 'กดชื่อ + ใส่รหัส PIN 4 หลักส่วนตัว เพื่อยืนยันตัวตน'
                    : 'Tap name + personal 4-digit PIN'}
                </div>
              </div>

              <div className="rounded-2xl border border-[#6EE7B7] bg-[#ECFDF5] p-3 space-y-2">
                <div className="font-extrabold text-[#064E3B]">
                  3.{' '}
                  {lang === 'th'
                    ? 'ใช้คอมพิวเตอร์ทำการบ้าน'
                    : 'Computer for Homework'}
                </div>
                <div className="rounded-xl bg-white border border-[#34D399] p-2.5 font-bold text-[#064E3B]">
                  👩‍🏫{' '}
                  {lang === 'th'
                    ? 'เปิดระบบ/อนุญาตใช้งานคอมพิวเตอร์'
                    : 'Open system / allow computer usage'}
                </div>
                <div className="rounded-xl bg-white border border-[#34D399] p-2.5 font-bold text-[#064E3B]">
                  🧒{' '}
                  {lang === 'th'
                    ? 'เข้าใช้งานตามสิทธิ์'
                    : 'Access according to granted permission'}
                </div>
              </div>
            </div>
          </section>
        )}

        {showNight && (
          <section className="rounded-[24px] border-2 border-[#818CF8] bg-white overflow-hidden shadow-xs">
            <div className="bg-[#E0E7FF] border-b border-[#818CF8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-[#4F46E5] px-2.5 py-0.5 text-xs font-extrabold text-white">
                🌙 {lang === 'th' ? 'ช่วงค่ำ · ไนท์วอช' : 'Night · Night Watch'}
              </span>
              <span className="text-xs font-extrabold text-[#312E81]">
                🛡️ {todayNightWatchEffective.label}
              </span>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DDD3] p-3 space-y-1 font-bold text-[#3D322C]">
                <div className="text-[11px] text-[#7B695F]">
                  {lang === 'th' ? 'กิจกรรม' : 'Activities'}
                </div>
                <div>1. {lang === 'th' ? 'ขอลงทะเบียนทำการบ้าน' : 'Homework Registration'}</div>
                <div>2. {lang === 'th' ? 'คืนมือถือ' : 'Return Phone'}</div>
              </div>
              <div className="rounded-xl border border-[#A5B4FC] bg-[#EEF2FF] p-3 space-y-1.5">
                <div className="text-[11px] font-extrabold text-[#312E81]">
                  👩‍🏫 {lang === 'th' ? 'หน้าที่ของพี่เลี้ยง (คนที่ไนท์วอช)' : 'Staff Duty (Night Watch)'}
                </div>
                <div className="font-bold text-[#1E336B]">
                  👀{' '}
                  {lang === 'th'
                    ? 'เปิดระบบทิ้งไว้ และ คอยเฝ้าสังเกตการณ์ ไม่ให้น้องกดรหัสแทนกัน'
                    : 'Keep system open and supervise against entering PINs for others'}
                </div>
                <div className="rounded-lg bg-white border border-[#C7D2FE] px-2.5 py-1.5 font-bold text-[#312E81]">
                  📦{' '}
                  {lang === 'th'
                    ? `เตรียมเก็บมือถือให้เรียบร้อย เพื่อเข้าเช้าในวันถัดไป (วัน${tomorrowRow.dayTh}: ${tomorrowMorningEffective.label})`
                    : `Collect phones to prepare for next morning (${tomorrowRow.dayEn}: ${tomorrowMorningEffective.label})`}
                </div>
              </div>
              <div className="rounded-xl border border-[#818CF8] bg-[#EEF2FF] p-3 space-y-1">
                <div className="text-[11px] font-extrabold text-[#312E81]">
                  🧒 {lang === 'th' ? 'วิธีที่น้องใช้งานระบบ' : 'How Kids Use System'}
                </div>
                <div className="font-bold text-[#1E336B]">
                  🔑{' '}
                  {lang === 'th'
                    ? 'กดชื่อ + ใส่รหัส PIN 4 หลักส่วนตัว เพื่อยืนยันตัวตน'
                    : 'Tap name + personal 4-digit PIN'}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Weekly Morning Shift & Night Watch Pairing Table */}
      <section className="rounded-[26px] border-2 border-[#D4C7EA] bg-white p-4 sm:p-5 space-y-3 pastel-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#3E2B63]">
              📅{' '}
              {lang === 'th'
                ? 'ตารางจับคู่เวรคนเข้าเช้า & ไนท์วอช (เพื่อเตรียมเก็บมือถือสำหรับเช้าวันถัดไป)'
                : 'Weekly Morning Shift & Night Watch Pairing'}
            </h2>
            <p className="text-xs text-[#5B4782]">
              {lang === 'th'
                ? 'ผู้ที่อยู่เวรไนท์วอชช่วงค่ำ จะเป็นผู้เตรียมเก็บมือถือให้เรียบร้อยสำหรับคนเข้าเช้าในวันถัดไปค่ะ'
                : 'Night Watch staff oversees evening phone return & preps the phone box for the next morning shift.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWeeklyPairTable((p) => !p)}
            className="rounded-xl border border-[#D4C7EA] bg-[#F7F3FC] hover:bg-[#EDE5FA] px-3 py-1.5 text-xs font-extrabold text-[#3E2B63] cursor-pointer"
          >
            {showWeeklyPairTable
              ? lang === 'th'
                ? 'ซ่อนตาราง 7 วัน ⌃'
                : 'Hide 7-Day Table ⌃'
              : lang === 'th'
              ? 'ดูตาราง 7 วัน ⌄'
              : 'Show 7-Day Table ⌄'}
          </button>
        </div>

        {showWeeklyPairTable && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {weeklyPairs.map((pair) => (
              <div
                key={pair.dayTh}
                className={`rounded-2xl border-2 p-3 space-y-1.5 text-xs ${
                  pair.isToday
                    ? 'border-[#6366F1] bg-[#EEF2FF] shadow-xs'
                    : 'border-[#E6DDD3] bg-[#FCFBF9]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-sm text-[#3D322C]">
                    วัน{pair.dayTh}
                  </span>
                  {pair.isToday && (
                    <span className="rounded-md bg-[#4F46E5] px-2 py-0.5 text-[10px] font-extrabold text-white">
                      {lang === 'th' ? 'วันนี้' : 'TODAY'}
                    </span>
                  )}
                </div>
                <div className="rounded-lg bg-[#FFFBEB] border border-[#F59E0B] px-2.5 py-1.5 font-bold text-[#78350F]">
                  🌅 เข้าเช้า: {pair.morningName}
                </div>
                <div className="rounded-lg bg-[#F5F3FF] border border-[#A78BFA] px-2.5 py-1.5 font-bold text-[#4C1D95] space-y-0.5">
                  <div>🌙 ไนท์วอชค่ำ: {pair.nightWatchName}</div>
                  <div className="text-[11px] font-semibold text-[#5B4782]">
                    ↳ เตรียมมือถือเข้าเช้าวัน{pair.nextDayTh} ({pair.nextMorningName})
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
